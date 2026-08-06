// Registro de hooks por tabla del CRUD admin (God #1, cut #7).
//
// PROBLEMA QUE RESUELVE
// --------------------
// `SqlAdminService.create()` y `.update()` son un motor genérico dirigido por `sqlTables.js`
// (bueno: `pickPayload` + `validateTableRules` + INSERT/UPDATE construido por metadatos) al que
// se le cosieron ~20 injertos `if (tableName === "X")` con la lógica particular de cada entidad.
// Eso es control-flow por-entidad inline: lo contrario de `FK_TABLE_MAP`, que es DATOS.
//
// Este módulo es el equivalente backend de `FK_TABLE_MAP`: la lógica por-tabla pasa a ser una
// entrada declarativa y localizable, y el motor queda genérico de verdad.
//
// LAS TRES ZONAS DE INJERTO (de ahí la forma de los hooks)
// -------------------------------------------------------
// Los injertos no vivían en un solo punto, sino en tres, y el orden respecto al código compartido
// es CONTRATO (lo fijan los goldens de error de `tests/characterization/flows/admin_crud.test.mjs`):
//
//   create():  beforeCreate -> [requeridos -> validateFieldTypes -> validateTableRules]
//              -> afterValidateCreate -> [INSERT (llano o en tx: beforeInsertTx/afterInsertTx)]
//              -> mapCreateError
//
//   update():  beforeUpdate -> [columnas -> validateFieldTypes -> validateTableRules]
//              -> [UPDATE en tx (beforeUpdateTx/afterUpdateTx) o llano (+ afterUpdate)]
//              -> mapUpdateError
//
// El orden RELATIVO entre tablas distintas es irrelevante (`tableName === A` y `tableName === B`
// son mutuamente excluyentes: en una llamada solo corre una rama), y por eso el registro puede
// despacharse desde un único punto por zona sin alterar ningún contrato.
//
// EL CONTEXTO (`ctx`)
// -------------------
// Cada hook recibe un único objeto mutable. Lo importante:
//   - `service`     el propio SqlAdminService, para llamar a sus delegadores (`wouldCreateUnitCycle`,
//                   `ensureDraftDefinitionContext`, `resolveProcessDefinitionSeries`...). Los cuts
//                   #1-#6 dejaron esos métodos como delegadores a los servicios extraídos, así que
//                   los hooks siguen viendo la misma superficie que veían los injertos.
//   - `pool`        atajo a `service.pool`.
//   - `connection`  la conexión de la transacción — SOLO dentro de los hooks `*Tx`.
//   - `payload`     (create) / `updates` (update): lo que se va a escribir. Los hooks lo MUTAN.
//   - `existing`    (update) la fila actual.
//   - `state`       cajón por-llamada; sustituye a las variables locales que antes cruzaban zonas
//                   (`cloneSourceDefinitionId`, `activateDraftVersion`, ...).
//   - `notice`      aviso al usuario que la respuesta devuelve como `__notice`.

import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { assertPasswordPolicy } from "../../utils/passwordPolicy.js";
import {
  hydrateTaskFromDefinition,
  ensureProcessRun,
  ensureDocumentsForTask,
  ensureDocumentForTaskItem,
  ensureFillFlowForDocumentVersion,
  ensureSignatureFlowForDocumentVersion
} from "./TaskGenerationService.js";
import {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromFillRequest,
  syncDocumentProgressFromSignatureRequest,
} from "../documents/DocumentProgressService.js";

/** Ejecuta una escritura dentro de una transacción, con hooks antes y después. */
export async function runInTransaction(pool, ctx, { before, after }, execute) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    ctx.connection = connection;
    if (before) {
      await before(ctx);
    }
    const result = await execute(connection);
    ctx.result = result;
    if (after) {
      await after(ctx);
    }
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    ctx.connection = null;
  }
}

/**
 * INSERT genérico. Recalcula columnas/valores desde `ctx.payload` en el momento de escribir porque
 * un `beforeInsertTx` puede haberlo mutado (p. ej. `tasks`, que resuelve su `process_run_id` dentro
 * de la transacción). Para las tablas que no lo mutan el resultado es idéntico.
 */
export async function insertPayload(executor, ctx) {
  const columns = Object.keys(ctx.payload);
  const placeholders = columns.map(() => "?").join(", ");
  const values = columns.map((key) => ctx.payload[key]);
  const [insertResult] = await executor.query(
    `INSERT INTO ${ctx.tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
    values
  );
  ctx.insertId = insertResult.insertId;
  return insertResult;
}

// --- Credenciales de `persons` --------------------------------------------------------------
// Vivían como consts de módulo en SqlAdminService.js y sus ÚNICOS clientes eran los injertos de
// `persons`, así que se mudan con ellos.

const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$/;
const PERSON_TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const isBcryptHash = (value) => typeof value === "string" && BCRYPT_HASH_REGEX.test(value);

const hashPassword = async (password) => {
  assertPasswordPolicy(password);
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const generatePersonToken = () => {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (byte) => PERSON_TOKEN_CHARS[byte % PERSON_TOKEN_CHARS.length]).join("");
};

const resolveUniquePersonToken = async (pool) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const token = generatePersonToken();
    const [rows] = await pool.query("SELECT id FROM persons WHERE token = ? LIMIT 1", [token]);
    if (!rows?.length) return token;
  }
  throw new Error("No se pudo generar un token unico para el usuario.");
};

// `unit_types` y `cargos` comparten injerto: al renombrarlos hay que regenerar el nombre de las
// configuraciones de las series que los referencian. Solo cambia la columna por la que se busca.
const refreshSeriesNamesOnRename = (foreignKey) => async (ctx) => {
  if (!Object.hasOwn(ctx.updates, "name")) {
    return;
  }
  const [seriesRows] = await ctx.pool.query(
    `SELECT id FROM process_definition_series WHERE ${foreignKey} = ?`,
    [Number(ctx.existing.id ?? ctx.keyPayload.id)]
  );
  for (const seriesRow of seriesRows || []) {
    await ctx.service.refreshProcessDefinitionVersionNames({ seriesId: Number(seriesRow.id) });
  }
};

// `fill_requests`, `signature_requests` y `document_signatures` tienen el MISMO injerto en create
// y en update: escribir y reconciliar el progreso del documento dentro de la misma transacción.
// Solo cambia la función de reconciliación.
const syncProgressHooks = (syncProgress) => ({
  async afterInsertTx(ctx) {
    await syncProgress(ctx.connection, Number(ctx.insertId));
  },
  async afterUpdateTx(ctx) {
    await syncProgress(ctx.connection, Number(ctx.existing.id ?? ctx.keyPayload.id));
  }
});

// -------------------------------------------------------------------------------------------
// El registro. Una entrada por tabla con lógica propia; las demás pasan por el camino genérico.
// -------------------------------------------------------------------------------------------

export const TABLE_HOOKS = {
  persons: {
    // Graft de SEGURIDAD: la contraseña nunca se guarda en claro y cada persona tiene un token
    // único. `sanitizePersonRow` (en el motor) se encarga de que el hash no salga en la respuesta.
    async beforeCreate(ctx) {
      const rawPassword = typeof ctx.data?.password === "string" ? ctx.data.password : "";
      const rawToken = typeof ctx.data?.token === "string" ? ctx.data.token.trim() : "";
      ctx.payload.token = rawToken || await resolveUniquePersonToken(ctx.pool);
      if (rawPassword) {
        ctx.payload.password_hash = await hashPassword(rawPassword);
      } else if (typeof ctx.payload.password_hash === "string" && ctx.payload.password_hash) {
        if (!isBcryptHash(ctx.payload.password_hash)) {
          ctx.payload.password_hash = await hashPassword(ctx.payload.password_hash);
        }
      } else {
        throw new Error("Ingresa el password del usuario.");
      }
    },

    async beforeUpdate(ctx) {
      if (Object.hasOwn(ctx.data, "password")) {
        const rawPassword = typeof ctx.data.password === "string" ? ctx.data.password : "";
        if (rawPassword) {
          ctx.updates.password_hash = await hashPassword(rawPassword);
        }
      }
      // Un hash que llega ya hecho se respeta; cualquier otra cosa se hashea (defensa por si el
      // cliente manda `password_hash` en claro).
      if (typeof ctx.updates.password_hash === "string" && ctx.updates.password_hash) {
        if (!isBcryptHash(ctx.updates.password_hash)) {
          ctx.updates.password_hash = await hashPassword(ctx.updates.password_hash);
        }
      }
    }
  },

  unit_positions: {
    beforeCreate(ctx) {
      ctx.service.assertUnitHeadAllowed(ctx.payload.is_unit_head, ctx.payload.position_type || "real");
    },

    // En update se valida sobre los valores EFECTIVOS: lo que trae el PUT si viene, y si no lo que
    // ya tenía la fila. Validar solo `updates` dejaría pasar cambiar el tipo de una cabeza.
    beforeUpdate(ctx) {
      const effHead = ctx.updates.is_unit_head !== undefined
        ? ctx.updates.is_unit_head
        : ctx.existing.is_unit_head;
      const effType = ctx.updates.position_type !== undefined
        ? ctx.updates.position_type
        : ctx.existing.position_type;
      ctx.service.assertUnitHeadAllowed(effHead, effType);
    }
  },

  unit_relations: {
    // Integridad del organigrama: una unidad tiene UN padre por tipo de relación, y la jerarquía
    // no puede tener ciclos.
    async beforeCreate(ctx) {
      const parentId = Number(ctx.payload.parent_unit_id);
      const childId = Number(ctx.payload.child_unit_id);
      const relTypeId = Number(ctx.payload.relation_type_id);
      if (!parentId || !childId || !relTypeId) {
        throw new Error("La relación requiere unidad padre, unidad hija y tipo de relación.");
      }
      if (parentId === childId) {
        throw new Error("Una unidad no puede relacionarse consigo misma.");
      }
      const [existingParent] = await ctx.pool.query(
        "SELECT parent_unit_id FROM unit_relations WHERE child_unit_id = ? AND relation_type_id = ? LIMIT 1",
        [childId, relTypeId]
      );
      if (existingParent.length) {
        throw new Error("Esa unidad ya tiene un padre en este tipo de relación. Quita la relación actual antes de crear otra.");
      }
      if (await ctx.service.wouldCreateUnitCycle(parentId, childId, relTypeId)) {
        throw new Error("La relación crearía un ciclo en la jerarquía (la unidad padre ya depende de la hija).");
      }
    },

    // Mismas reglas, pero la fila se excluye a sí misma del chequeo de duplicado (si no, reasignar
    // el padre de una relación existente se rechazaría a sí misma).
    async beforeUpdate(ctx) {
      const parentId = Number(ctx.updates.parent_unit_id ?? ctx.existing.parent_unit_id);
      const childId = Number(ctx.updates.child_unit_id ?? ctx.existing.child_unit_id);
      const relTypeId = Number(ctx.updates.relation_type_id ?? ctx.existing.relation_type_id);
      if (parentId === childId) {
        throw new Error("Una unidad no puede relacionarse consigo misma.");
      }
      const [dupRel] = await ctx.pool.query(
        "SELECT id FROM unit_relations WHERE child_unit_id = ? AND relation_type_id = ? AND id <> ? LIMIT 1",
        [childId, relTypeId, Number(ctx.existing.id)]
      );
      if (dupRel.length) {
        throw new Error("Esa unidad ya tiene un padre en este tipo de relación. Quita la relación actual antes de reasignar.");
      }
      if (await ctx.service.wouldCreateUnitCycle(parentId, childId, relTypeId)) {
        throw new Error("La relación crearía un ciclo en la jerarquía (la unidad padre ya depende de la hija).");
      }
    }
  },

  vacancies: {
    // ÚNICO hook posterior a validateTableRules. El orden es contrato: con campos requeridos
    // ausentes gana el mensaje de "datos incompletos", no este.
    async afterValidateCreate(ctx) {
      await ctx.service.ensureContractablePosition(ctx.payload.position_id ?? ctx.data?.position_id);
    }
  },

  processes: {
    async afterUpdate(ctx) {
      if (Object.hasOwn(ctx.updates, "name")) {
        await ctx.service.refreshProcessDefinitionVersionNames({
          processId: Number(ctx.existing.id ?? ctx.keyPayload.id)
        });
      }
    }
  },

  unit_types: { afterUpdate: refreshSeriesNamesOnRename("unit_type_id") },

  cargos: { afterUpdate: refreshSeriesNamesOnRename("cargo_id") },

  // --- Runtime -------------------------------------------------------------------------------
  // Estas tablas NO las escriben los flujos de la app (TaskGenerationService y compañía hacen
  // INSERT directo): su CRUD admin es funcionalidad de borde. Aun así llevan hook, porque casi
  // todas transforman el payload o arrastran un efecto transaccional.

  tasks: {
    async beforeCreate(ctx) {
      const definition = await ctx.service.getProcessDefinitionVersion(ctx.payload.process_definition_id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
      if (String(definition.status || "") !== "active") {
        throw new Error("Solo se pueden instanciar tareas desde configuraciones activas.");
      }
      await ctx.service.ensureDefinitionRunsInTermPeriodType(
        ctx.payload.process_definition_id,
        ctx.payload.term_id
      );

      if (ctx.payload.process_run_id) {
        const processRun = await ctx.service.getProcessRun(ctx.payload.process_run_id);
        if (!processRun) {
          throw new Error("La corrida de proceso seleccionada no existe.");
        }
        if (Number(processRun.process_definition_id) !== Number(ctx.payload.process_definition_id)) {
          throw new Error("La corrida de proceso no pertenece a la configuracion seleccionada.");
        }
        if (Number(processRun.term_id || 0) !== Number(ctx.payload.term_id || 0)) {
          throw new Error("La corrida de proceso no pertenece al periodo seleccionado.");
        }
      }
    },

    // ÚNICO hook que muta el payload DENTRO de la transacción: la corrida se crea con la misma
    // conexión que la tarea. Por eso `insertPayload` recalcula columnas justo antes del INSERT.
    async beforeInsertTx(ctx) {
      if (!ctx.payload.process_run_id) {
        ctx.payload.process_run_id = await ensureProcessRun({
          connection: ctx.connection,
          processDefinitionId: Number(ctx.payload.process_definition_id),
          termId: Number(ctx.payload.term_id),
          runMode: "manual",
          createdByUserId: ctx.payload.created_by_user_id || null,
          status: "active"
        });
      }
    },

    async afterInsertTx(ctx) {
      await hydrateTaskFromDefinition({
        connection: ctx.connection,
        taskId: ctx.insertId,
        processDefinitionId: Number(ctx.payload.process_definition_id),
        termId: Number(ctx.payload.term_id)
      });
    },

    mapCreateError(error) {
      if (error?.code === "ER_DUP_ENTRY") {
        return new Error("Ya existe una instancia de tarea con esa configuracion, periodo y criterio de lanzamiento.");
      }
      return null;
    },

    // Una tarea instanciada es inmutable en su identidad: configuración, periodo, corrida y
    // creador no se cambian. Los campos que coinciden con lo existente se descartan en silencio.
    beforeUpdate(ctx) {
      const { updates, existing } = ctx;
      if (Object.hasOwn(updates, "process_definition_id")) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la configuracion de una tarea ya instanciada.");
        }
        delete updates.process_definition_id;
      }
      if (Object.hasOwn(updates, "term_id")) {
        if (Number(updates.term_id) !== Number(existing.term_id)) {
          throw new Error("No se puede cambiar el periodo de una tarea ya instanciada.");
        }
        delete updates.term_id;
      }
      if (Object.hasOwn(updates, "launch_mode")) {
        delete updates.launch_mode;
      }
      if (Object.hasOwn(updates, "created_by_user_id")) {
        if (Number(updates.created_by_user_id || 0) !== Number(existing.created_by_user_id || 0)) {
          throw new Error("No se puede cambiar el usuario creador de una tarea existente.");
        }
        delete updates.created_by_user_id;
      }
      if (Object.hasOwn(updates, "process_run_id")) {
        if (Number(updates.process_run_id || 0) !== Number(existing.process_run_id || 0)) {
          throw new Error("No se puede cambiar la corrida de proceso de una tarea existente.");
        }
        delete updates.process_run_id;
      }
    }
  },

  task_items: {
    // Los datos que no se piden se HEREDAN de la plantilla y de la tarea.
    async beforeCreate(ctx) {
      if (!ctx.payload.process_definition_template_id) {
        return;
      }
      const template = await ctx.service.getTaskTemplate(ctx.payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado seleccionada no existe.");
      }
      const task = await ctx.service.getByKeys("tasks", { id: ctx.payload.task_id });
      if (!task) {
        throw new Error("La tarea seleccionada no existe.");
      }
      if (Number(task.process_definition_id) !== Number(template.process_definition_id)) {
        throw new Error("La plantilla seleccionada no pertenece a la configuracion de proceso de la tarea.");
      }
      ctx.payload.template_artifact_id = template.template_artifact_id;
      if (!ctx.payload.start_date) {
        ctx.payload.start_date = task.start_date;
      }
      if (ctx.payload.end_date === undefined || ctx.payload.end_date === "") {
        ctx.payload.end_date = task.end_date ?? null;
      }
      if (ctx.payload.sort_order === undefined || ctx.payload.sort_order === null || ctx.payload.sort_order === "") {
        ctx.payload.sort_order = template.sort_order;
      }
    },

    // Todo item necesita su documento. Si el item recién insertado no se puede releer, se
    // reconcilian los de la tarea entera.
    async afterInsertTx(ctx) {
      const taskItem = await ctx.service.getTaskItem(ctx.insertId, ctx.connection);
      if (taskItem) {
        await ensureDocumentForTaskItem(ctx.connection, taskItem);
      } else {
        await ensureDocumentsForTask(ctx.connection, Number(ctx.payload.task_id));
      }
    },

    beforeUpdate(ctx) {
      const { updates, existing } = ctx;
      if (Object.hasOwn(updates, "task_id")) {
        if (Number(updates.task_id) !== Number(existing.task_id)) {
          throw new Error("No se puede cambiar la tarea asociada de un item.");
        }
        delete updates.task_id;
      }
      if (Object.hasOwn(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un item.");
        }
        delete updates.process_definition_template_id;
      }
      if (Object.hasOwn(updates, "template_artifact_id")) {
        if (Number(updates.template_artifact_id) !== Number(existing.template_artifact_id)) {
          throw new Error("No se puede cambiar el paquete asociado de un item.");
        }
        delete updates.template_artifact_id;
      }
    }
  },

  documents: {
    // El origen se DERIVA: con item de tarea es `task_item`; sin él es standalone y exige dueño.
    async beforeCreate(ctx) {
      if (ctx.payload.task_item_id) {
        const taskItem = await ctx.service.getTaskItem(ctx.payload.task_item_id);
        if (!taskItem) {
          throw new Error("El item de tarea seleccionado no existe.");
        }
        ctx.payload.origin_type = ctx.payload.origin_type || "task_item";
        return;
      }
      if (!ctx.payload.owner_person_id) {
        throw new Error("Los documentos standalone requieren un propietario.");
      }
      ctx.payload.origin_type = ctx.payload.origin_type || "standalone";
    },

    beforeUpdate(ctx) {
      if (Object.hasOwn(ctx.updates, "task_item_id")) {
        if (Number(ctx.updates.task_item_id) !== Number(ctx.existing.task_item_id)) {
          throw new Error("No se puede cambiar el item de tarea asociado de un documento.");
        }
        delete ctx.updates.task_item_id;
      }
    }
  },

  document_versions: {
    // El artifact se hereda del item de tarea del documento cuando no viene explícito.
    async beforeCreate(ctx) {
      if (!ctx.payload.document_id) {
        return;
      }
      const document = await ctx.service.getByKeys("documents", { id: ctx.payload.document_id });
      if (!document) {
        throw new Error("El documento seleccionado no existe.");
      }
      if (!ctx.payload.template_artifact_id && document.task_item_id) {
        const taskItem = await ctx.service.getTaskItem(document.task_item_id);
        if (taskItem?.template_artifact_id) {
          ctx.payload.template_artifact_id = taskItem.template_artifact_id;
        }
      }
    },

    async afterInsertTx(ctx) {
      await ensureFillFlowForDocumentVersion(ctx.connection, Number(ctx.insertId));
    },

    // Pasar a "listo para firma" arma el flujo de firma en la MISMA transacción que el UPDATE.
    // Que no se pueda armar no aborta el cambio de estado: se avisa por log (comportamiento
    // preexistente, deliberado).
    async afterUpdateTx(ctx) {
      if (!Object.hasOwn(ctx.updates, "status")) {
        return;
      }
      const nextStatus = String(ctx.updates.status || "").trim().toLowerCase();
      if (nextStatus !== "listo para firma") {
        return;
      }
      const documentVersionId = Number(ctx.existing.id ?? ctx.keyPayload.id);
      const signatureFlowResult = await ensureSignatureFlowForDocumentVersion(ctx.connection, documentVersionId);
      if (signatureFlowResult && !signatureFlowResult.ok) {
        console.warn(
          `[SqlAdminService] DocumentVersion ${documentVersionId} cannot enter signature: ${signatureFlowResult.reason}`
        );
      }
    }
  },

  // Las tres tablas de solicitudes/firmas comparten forma: escribir y reconciliar el progreso del
  // documento en la misma transacción, tanto al crear como al actualizar.
  fill_requests: syncProgressHooks(syncDocumentProgressFromFillRequest),
  signature_requests: syncProgressHooks(syncDocumentProgressFromSignatureRequest),
  document_signatures: syncProgressHooks(syncDocumentProgressFromDocumentSignature),

  fill_flow_templates: {
    // El flujo pertenece a la definición vía su plantilla; solo se edita con la definición en
    // borrador. En create la definición se resuelve a través de la plantilla del payload.
    //
    // NOTA: el injerto original hacía `payload.process_definition_id = ...` y lo borraba tres
    // líneas después. Era código muerto: `process_definition_id` no es campo de esta tabla en
    // `sqlTables.js`, así que `pickPayload` nunca lo pone en el payload y el delete no borraba
    // nada. No se traslada.
    async beforeCreate(ctx) {
      if (!ctx.payload.process_definition_template_id) {
        return;
      }
      const template = await ctx.service.getTaskTemplate(ctx.payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado seleccionada no existe.");
      }
      await ctx.service.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de entrega" }
      );
    },

    async beforeUpdate(ctx) {
      if (Object.hasOwn(ctx.updates, "process_definition_template_id")) {
        if (Number(ctx.updates.process_definition_template_id) !== Number(ctx.existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un flujo de entrega.");
        }
        delete ctx.updates.process_definition_template_id;
      }
      const template = await ctx.service.getTaskTemplate(ctx.existing.process_definition_template_id);
      if (template) {
        await ctx.service.ensureDraftDefinitionContext(
          template.process_definition_id,
          { entityLabel: "los flujos de entrega" }
        );
      }
    }
  },

  fill_flow_steps: {
    async beforeCreate(ctx) {
      if (!ctx.payload.fill_flow_template_id) {
        return;
      }
      const fillFlowTemplate = await ctx.service.getFillFlowTemplate(ctx.payload.fill_flow_template_id);
      if (!fillFlowTemplate) {
        throw new Error("La plantilla de entrega seleccionada no existe.");
      }
      const template = await ctx.service.getTaskTemplate(fillFlowTemplate.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definida asociada no existe.");
      }
      await ctx.service.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los pasos de entrega" }
      );
    },

    async beforeUpdate(ctx) {
      if (Object.hasOwn(ctx.updates, "fill_flow_template_id")) {
        if (Number(ctx.updates.fill_flow_template_id) !== Number(ctx.existing.fill_flow_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un paso de entrega.");
        }
        delete ctx.updates.fill_flow_template_id;
      }
      const fillFlowTemplate = await ctx.service.getFillFlowTemplate(ctx.existing.fill_flow_template_id);
      if (fillFlowTemplate) {
        const template = await ctx.service.getTaskTemplate(fillFlowTemplate.process_definition_template_id);
        if (template) {
          await ctx.service.ensureDraftDefinitionContext(
            template.process_definition_id,
            { entityLabel: "los pasos de entrega" }
          );
        }
      }
    }
  },

  signature_flow_templates: {
    async beforeCreate(ctx) {
      if (!ctx.payload.process_definition_template_id) {
        return;
      }
      const template = await ctx.service.getTaskTemplate(ctx.payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado seleccionada no existe.");
      }
      await ctx.service.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    },

    // Ojo a la asimetría con fill_flow_templates: aquí la plantilla ausente es ERROR, allí se
    // ignora en silencio. Es comportamiento preexistente, se preserva tal cual.
    async beforeUpdate(ctx) {
      if (Object.hasOwn(ctx.updates, "process_definition_template_id")) {
        if (Number(ctx.updates.process_definition_template_id) !== Number(ctx.existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un flujo de firma.");
        }
        delete ctx.updates.process_definition_template_id;
      }
      const template = await ctx.service.getTaskTemplate(ctx.existing.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado asociada al flujo ya no existe.");
      }
      await ctx.service.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }
  },
};

const NO_HOOKS = Object.freeze({});

export function getTableHooks(tableName) {
  return TABLE_HOOKS[tableName] || NO_HOOKS;
}
