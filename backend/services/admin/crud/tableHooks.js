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
import { assertPasswordPolicy } from "../../../utils/passwordPolicy.js";
import { isUniqueViolation, violatedConstraint } from "../../../errors/sqlErrors.js";
import { conflict } from "../../../errors/HttpError.js";
import {
  hydrateTaskFromDefinition,
  ensureProcessRun,
  ensureDocumentsForTask,
  ensureDocumentForTaskItem,
  ensureFillFlowForDocumentVersion,
  ensureSignatureFlowForDocumentVersion
} from "../TaskGenerationService.js";
import {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromFillRequest,
  syncDocumentProgressFromSignatureRequest,
} from "../../documents/DocumentProgressService.js";

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

// Las tres tablas HIJAS de una configuración (`process_definition_templates`, `process_target_rules`
// y `process_definition_period_types`) comparten dos reglas: solo se tocan con la configuración en
// BORRADOR, y la configuración a la que cuelgan es inmutable. Solo cambia la etiqueta del mensaje.
const definitionChildGuards = (entityLabel) => ({
  async beforeCreate(ctx) {
    await ctx.service.ensureDraftDefinitionContext(ctx.payload.process_definition_id, { entityLabel });
  },
  async beforeUpdate(ctx) {
    if (Object.hasOwn(ctx.updates, "process_definition_id")) {
      if (Number(ctx.updates.process_definition_id) !== Number(ctx.existing.process_definition_id)) {
        throw new Error("No se puede cambiar la configuracion asociada de este registro.");
      }
      delete ctx.updates.process_definition_id;
    }
    await ctx.service.ensureDraftDefinitionContext(ctx.existing.process_definition_id, { entityLabel });
  },
  // remove() no lee la fila antes de borrar (el motor solo necesita las claves), así que el hook
  // la busca él mismo: sin ella no se sabe de qué configuración cuelga.
  async beforeRemove(ctx) {
    const existing = await ctx.service.getByKeys(ctx.tableName, ctx.keyPayload);
    if (!existing) {
      throw new Error("Registro no encontrado.");
    }
    await ctx.service.ensureDraftDefinitionContext(existing.process_definition_id, { entityLabel });
  }
});

const TEMPLATE_CHILD_GUARDS = definitionChildGuards("las plantillas de configuracion");
const RULE_CHILD_GUARDS = definitionChildGuards("las reglas de alcance");
const PERIOD_CHILD_GUARDS = definitionChildGuards("los periodos del proceso");

// El remapeo de la unicidad "una sola activa por serie". Se compara `error.constraint`, que el
// driver de PostgreSQL da EXACTO, en vez de buscar la subcadena en el mensaje (que era lo que hacía
// el injerto original, y además contra un código de error de MySQL que ya no llega nunca).
const mapOneActivePerSeries = (error) => {
  if (
    isUniqueViolation(error)
    && violatedConstraint(error) === "uq_process_definition_one_active_series"
  ) {
    return conflict("Solo puede existir una configuracion activa por serie dentro del mismo proceso.");
  }
  return null;
};

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

  // --- Estado complejo: el árbol de configuraciones de proceso -------------------------------
  // Serie -> configuración (versionada) -> plantillas/reglas/periodos. Sus injertos encadenan
  // versionado, clonado y sincronización de flujos; todo eso ya vive en los servicios extraídos
  // en los cuts #3-#5, así que aquí solo queda la orquestación por-tabla.

  process_definition_series: {
    // La IDENTIDAD (code) no la elige el usuario: se deriva del origen (cargo o tipo de unidad).
    async beforeCreate(ctx) {
      const identity = await ctx.service.resolveProcessDefinitionSeriesIdentity(ctx.payload);
      Object.assign(ctx.payload, identity);
      const [dupRows] = await ctx.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
         LIMIT 1`,
        [identity.code]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe una serie con ese origen.");
      }
    },

    async beforeUpdate(ctx) {
      const candidateSeries = { ...ctx.existing, ...ctx.updates };
      const sourceType = String(candidateSeries.source_type || ctx.existing.source_type || "").trim();
      if (sourceType === "default") {
        throw new Error("La serie por defecto del sistema no se edita manualmente.");
      }
      const identity = await ctx.service.resolveProcessDefinitionSeriesIdentity(candidateSeries);
      Object.assign(ctx.updates, identity);
      const [dupRows] = await ctx.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
           AND id <> ?
         LIMIT 1`,
        [identity.code, Number(ctx.existing.id)]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe otra serie con ese origen.");
      }
    },

    // Si la identidad cambió, arrastra el `variation_key` de todas sus configuraciones y regenera
    // sus nombres. No es transaccional (no lo era antes).
    async afterUpdate(ctx) {
      if (!Object.hasOwn(ctx.updates, "code")) {
        return;
      }
      await ctx.pool.query(
        `UPDATE process_definition_versions
         SET variation_key = ?
         WHERE series_id = ?`,
        [ctx.updates.code, Number(ctx.existing.id)]
      );
      await ctx.service.refreshProcessDefinitionVersionNames({ seriesId: Number(ctx.existing.id) });
    }
  },

  process_definition_versions: {
    async beforeCreate(ctx) {
      // Se captura ANTES de nada porque es un campo virtual del request (no de la tabla) que el
      // hook transaccional necesita después.
      ctx.state.cloneSourceDefinitionId = (
        ctx.data?.source_process_definition_id !== undefined
        && ctx.data?.source_process_definition_id !== null
        && ctx.data?.source_process_definition_id !== ""
      )
        ? Number(ctx.data.source_process_definition_id)
        : null;

      if (typeof ctx.payload.definition_version === "string") {
        ctx.payload.definition_version = ctx.payload.definition_version.trim();
      }

      const requestedStatus = String(ctx.payload.status || "draft");
      if (requestedStatus !== "draft") {
        throw new Error("Las nuevas configuraciones solo pueden crearse en estado draft.");
      }
      const series = await ctx.service.resolveProcessDefinitionSeries(ctx.payload);
      ctx.payload.variation_key = String(series.code || "").trim();
      // El proceso por defecto es especial: SOLO admite la configuración "sin variación"
      // (source_type='default'). Puede versionarse (N versiones), pero no tener otra
      // variación por cargo/tipo de unidad.
      await ctx.service.ensureDefaultProcessSingleVariation(ctx.payload.process_id, series);
      ctx.payload.name = await ctx.service.resolveProcessDefinitionVersionName(
        ctx.payload.process_id,
        ctx.payload.series_id
      );
      ctx.payload.status = "draft";
      await ctx.service.ensureProcessDefinitionVersionAvailable(ctx.payload);
    },

    // Clonar los hijos va en la MISMA transacción que el INSERT: o se copia todo o no se crea nada.
    async afterInsertTx(ctx) {
      if (!ctx.state.cloneSourceDefinitionId) {
        return;
      }
      const cloneSummary = await ctx.service.cloneProcessDefinitionChildren({
        sourceDefinitionId: ctx.state.cloneSourceDefinitionId,
        targetDefinitionId: ctx.insertId,
        targetProcessId: ctx.payload.process_id,
        connection: ctx.connection
      });
      if (cloneSummary.clonedTemplates || cloneSummary.clonedRules || cloneSummary.clonedPeriodTypes) {
        ctx.notice =
          `Se clonaron ${cloneSummary.clonedTemplates} plantillas, ${cloneSummary.clonedRules} reglas`
          + ` y ${cloneSummary.clonedPeriodTypes} periodos del proceso desde la configuracion origen.`;
      }
      if (cloneSummary.templateWorkflowWarnings?.length) {
        ctx.notice = `${ctx.notice || ""} Atención: ${cloneSummary.templateWorkflowWarnings.length} plantilla(s) con flujo incompleto no se sincronizaron (revisa sus pasos de firma y vuelve a sincronizarlas).`.trim();
      }
    },

    mapCreateError: mapOneActivePerSeries,
    mapUpdateError: mapOneActivePerSeries,

    // El injerto más grande del fichero: máquina de estados (draft -> active -> retired) + campos
    // editables por estado + identidad inmutable. Deja decidido en `ctx.state` si el UPDATE necesita
    // transacción (solo la activación de un borrador la necesita).
    async beforeUpdate(ctx) {
      const { updates, existing, config } = ctx;

      if (typeof updates.definition_version === "string") {
        updates.definition_version = updates.definition_version.trim();
      }

      // La comparación "¿cambió de verdad?" tiene que normalizar por TIPO DE CAMPO: el driver
      // devuelve Date para las fechas y números para los enteros, y el request manda strings.
      const normalizeComparableValue = (fieldName, value) => {
        if (value === null || value === undefined || value === "") {
          return null;
        }
        const fieldMeta = config.fields.find((field) => field.name === fieldName);
        if (value instanceof Date) {
          if (fieldMeta?.type === "date") {
            return value.toISOString().slice(0, 10);
          }
          if (fieldMeta?.type === "datetime") {
            return value.toISOString().slice(0, 19).replace("T", " ");
          }
          return value.toISOString();
        }
        if (fieldMeta?.type === "number" || fieldMeta?.type === "boolean") {
          const numeric = Number(value);
          return Number.isNaN(numeric) ? String(value) : String(numeric);
        }
        return String(value);
      };

      const isSameValue = (fieldName, left, right) => {
        const normalizedLeft = normalizeComparableValue(fieldName, left);
        const normalizedRight = normalizeComparableValue(fieldName, right);
        return normalizedLeft === normalizedRight;
      };

      // Identidad inmutable. Reenviar el MISMO valor no es error: se descarta en silencio (el
      // formulario del admin manda la fila entera).
      if (Object.hasOwn(updates, "definition_version")) {
        if (!isSameValue("definition_version", updates.definition_version, existing.definition_version)) {
          throw new Error("No se puede modificar el numero de version de una configuracion.");
        }
        delete updates.definition_version;
      }
      if (Object.hasOwn(updates, "process_id")) {
        if (!isSameValue("process_id", updates.process_id, existing.process_id)) {
          throw new Error("No se puede cambiar el proceso de una configuracion.");
        }
        delete updates.process_id;
      }
      if (Object.hasOwn(updates, "series_id")) {
        if (!isSameValue("series_id", updates.series_id, existing.series_id)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.series_id;
      }
      if (Object.hasOwn(updates, "variation_key")) {
        if (!isSameValue("variation_key", updates.variation_key, existing.variation_key)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.variation_key;
      }
      if (Object.hasOwn(updates, "name")) {
        delete updates.name;
      }

      Object.keys(updates).forEach((key) => {
        if (isSameValue(key, updates[key], existing[key])) {
          delete updates[key];
        }
      });

      const currentStatus = String(existing.status || "draft");
      const nextStatus = Object.hasOwn(updates, "status")
        ? String(updates.status || "")
        : currentStatus;

      const allowedTransitions = {
        draft: new Set(["draft", "active", "retired"]),
        active: new Set(["active", "retired"]),
        retired: new Set(["retired"])
      };
      const currentAllowedTransitions = allowedTransitions[currentStatus] || new Set([currentStatus]);
      if (!currentAllowedTransitions.has(nextStatus)) {
        throw new Error(`No se permite cambiar una configuracion ${currentStatus} a ${nextStatus}.`);
      }

      let allowed;
      let errorMessage;
      if (currentStatus === "draft") {
        const generatedName = await ctx.service.resolveProcessDefinitionVersionName(
          existing.process_id,
          existing.series_id
        );
        if (generatedName && !isSameValue("name", generatedName, existing.name)) {
          updates.name = generatedName;
        }
        allowed = new Set([
          "name",
          "description",
          "status",
          "effective_from",
          "effective_to"
        ]);
        errorMessage = "Una configuracion en borrador solo permite cambios funcionales y de estado.";
      } else if (currentStatus === "active") {
        allowed = new Set(["status", "effective_to"]);
        errorMessage = "Una configuracion activa solo permite cambiar estado o vigencia final.";
      } else {
        allowed = new Set();
        errorMessage = "Una configuracion retirada es de solo lectura.";
      }

      const disallowed = Object.keys(updates).filter((key) => !allowed.has(key));
      if (disallowed.length) {
        throw new Error(errorMessage);
      }

      if (currentStatus === "draft" && nextStatus === "active") {
        ctx.state.activateDraftVersion = true;
        ctx.state.seriesContext = {
          processId: existing.process_id,
          variationKey: existing.variation_key,
          excludeId: existing.id ?? ctx.keyPayload.id
        };
      }
    },

    // Una configuración solo se elimina en borrador. Sus tablas hijas ya lo validan por su cuenta,
    // pero la definición en sí caía al DELETE genérico sin comprobar estado: una configuración
    // ACTIVA (con corridas en curso que la referencian) era borrable por API.
    async beforeRemove(ctx) {
      const definition = await ctx.service.getProcessDefinitionVersion(ctx.keyPayload.id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
      if (String(definition.status || "") !== "draft") {
        throw new Error("Solo se pueden eliminar configuraciones de proceso cuando estan en draft.");
      }
    },

    // Solo la ACTIVACIÓN necesita transacción; el resto de ediciones del borrador son un UPDATE llano.
    needsUpdateTransaction: (ctx) => ctx.state.activateDraftVersion === true,

    // Los guards de activación corren ANTES del UPDATE y dentro de la transacción: si uno falla, no
    // queda nada a medias (ni plantillas publicadas ni configuraciones retiradas).
    async beforeUpdateTx(ctx) {
      const definitionId = ctx.existing.id ?? ctx.keyPayload.id;
      await ctx.service.ensureDefinitionHasActiveRulesForActivation(definitionId, ctx.connection);
      await ctx.service.ensureDefinitionHasActivePeriodTypesForActivation(definitionId, ctx.connection);
      // Publica las plantillas borrador de la config (activa config + publica plantilla, juntas) antes de
      // validar que haya artefactos activos.
      await ctx.service.publishDraftTemplatesForDefinition(definitionId, ctx.connection);
      await ctx.service.ensureDefinitionHasArtifactsForActivation(definitionId, ctx.connection);
      const retiredCount = await ctx.service.retireActiveDefinitionsInSeries({
        ...ctx.state.seriesContext,
        connection: ctx.connection
      });
      if (retiredCount > 0) {
        // El injerto original fijaba este aviso TRAS el commit; da igual, porque si el commit falla
        // se propaga el error y la respuesta nunca se construye.
        ctx.notice = "La configuracion activa anterior de la misma serie fue retirada automaticamente.";
      }
    }
  },

  process_definition_templates: {
    async beforeCreate(ctx) {
      await TEMPLATE_CHILD_GUARDS.beforeCreate(ctx);
      // F3 — "la pared": solo se enlaza un entregable cuyo dueño = (proceso, variación) de la config.
      await ctx.service.assertDeliverableBelongsToConfigLine(
        ctx.payload.process_definition_id,
        ctx.payload.template_artifact_id
      );
      // Vínculo idempotente: si la plantilla ya está en esta configuración (p. ej. porque al crearla desde el
      // wizard ya se enlazó), no se duplica el registro (evita el ER_DUP_ENTRY de uq_process_definition_templates);
      // se devuelve el vínculo existente. `shortCircuit` corta el create() sin llegar al INSERT.
      const [existingLinkRows] = await ctx.pool.query(
        `SELECT id, sort_order FROM process_definition_templates
         WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
        [ctx.payload.process_definition_id, ctx.payload.template_artifact_id]
      );
      if (existingLinkRows?.length) {
        ctx.shortCircuit = {
          id: existingLinkRows[0].id,
          process_definition_id: Number(ctx.payload.process_definition_id),
          template_artifact_id: Number(ctx.payload.template_artifact_id),
          sort_order: existingLinkRows[0].sort_order,
          __notice: "La plantilla ya estaba vinculada a esta configuración."
        };
        return;
      }
      // El orden es interno (secuencia de la plantilla dentro de la configuración) y se asigna solo:
      // el usuario no debe elegirlo.
      if (ctx.payload.sort_order === undefined || ctx.payload.sort_order === null || ctx.payload.sort_order === "") {
        const [countRows] = await ctx.pool.query(
          "SELECT COUNT(*) AS c FROM process_definition_templates WHERE process_definition_id = ?",
          [ctx.payload.process_definition_id]
        );
        ctx.payload.sort_order = Number(countRows?.[0]?.c || 0) + 1;
      }
    },

    // ⚠️ VENTANA ABIERTA, sub-paso 7 → 8 del §0.8 (`docs/planes/plan-maestro-2026-08.md`).
    // Éste y su gemelo `afterUpdateTx` son los DOS únicos llamadores del sync que no capturan el
    // error, y el sync lee el `meta.yaml` del artifact desde MinIO. Desde que el sub-paso 7 retiró
    // `BASE_META_YAML` (`services/system/SystemBootstrapService.js`), la plantilla base del Proceso
    // por defecto tiene `meta_object_key` (NOT NULL) apuntando a un objeto que ya no se sube, así
    // que si la ejecución llega hasta aquí con ella, la transacción revienta con
    // «The specified key does not exist». **Está decidido y aceptado**; lo cierra el sub-paso 8
    // borrando `meta_object_key` y el `WorkflowSyncService` entero.
    //
    // MEDIDO el 2026-08-11, y sale MENOS grave de lo que anticipaba el plan: con la plantilla base
    // no se alcanza ninguno de los dos hooks, porque antes intercepta otro guard.
    //   · crear el vínculo por CRUD → 422 de `assertDeliverableBelongsToConfigLine`: el CRUD fuerza
    //     `variation_key = 'default'` en la configuración nueva y el entregable es de la `general`.
    //   · actualizar un vínculo existente → 400 «solo … cuando la configuracion esta en draft».
    //   · clonar una configuración (actualización guiada incluida) SÍ pasa la pared, pero ese camino
    //     va por `cloneProcessDefinitionChildren`, que convierte el fallo del sync en un aviso no
    //     bloqueante. Por eso la caracterización sigue en verde.
    // Lo único que falla de verdad es la acción explícita `POST /template_artifacts/:id/resync`,
    // con un 400 legible. Si mañana se relaja cualquiera de esos dos guards, esto empieza a reventar.
    //
    // NO envolver esto en un `catch`: los sub-pasos 4 y 5 quitaron a propósito los `catch {}` mudos
    // que convertían un fallo de almacenamiento en «esta plantilla no define flujo».
    async afterInsertTx(ctx) {
      if (ctx.payload.template_artifact_id) {
        await ctx.service.syncArtifactWorkflowsForTemplateArtifactId(
          Number(ctx.payload.template_artifact_id),
          ctx.connection
        );
      }
    },

    beforeUpdate: TEMPLATE_CHILD_GUARDS.beforeUpdate,

    beforeRemove: TEMPLATE_CHILD_GUARDS.beforeRemove,

    // Quitar una plantilla de la configuración: sus flujos derivados (entrega/firma) cuelgan del
    // vínculo y sus FKs NO son ON DELETE CASCADE, así que hay que borrarlos ANTES, en la misma
    // transacción. Solo aplica en draft (lo garantiza beforeRemove); en draft no existen instancias
    // de runtime (requests/firmas), por eso basta con templates + pasos.
    async beforeRemoveTx(ctx) {
      const templateId = Number(ctx.keyPayload.id);
      const [fillTemplates] = await ctx.connection.query(
        "SELECT id FROM fill_flow_templates WHERE process_definition_template_id = ?",
        [templateId]
      );
      for (const template of fillTemplates) {
        await ctx.connection.query("DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?", [template.id]);
      }
      await ctx.connection.query(
        "DELETE FROM fill_flow_templates WHERE process_definition_template_id = ?",
        [templateId]
      );
      const [signatureTemplates] = await ctx.connection.query(
        "SELECT id FROM signature_flow_templates WHERE process_definition_template_id = ?",
        [templateId]
      );
      for (const template of signatureTemplates) {
        await ctx.connection.query("DELETE FROM signature_flow_steps WHERE template_id = ?", [template.id]);
      }
      await ctx.connection.query(
        "DELETE FROM signature_flow_templates WHERE process_definition_template_id = ?",
        [templateId]
      );
    },

    // Al reenlazar hay que resincronizar los flujos del artifact. El id sale de lo que se actualiza,
    // de la fila existente o de la propia clave, en ese orden.
    // ⚠️ El otro extremo de la ventana del sub-paso 7 → 8: ver el aviso de `afterInsertTx`.
    async afterUpdateTx(ctx) {
      const rawArtifactId =
        ctx.updates.template_artifact_id
        ?? ctx.existing.template_artifact_id
        ?? ctx.keyPayload.template_artifact_id
        ?? 0;
      const artifactId = Number(rawArtifactId);
      if (artifactId) {
        await ctx.service.syncArtifactWorkflowsForTemplateArtifactId(artifactId, ctx.connection);
      }
    }
  },

  process_target_rules: {
    async beforeCreate(ctx) {
      await RULE_CHILD_GUARDS.beforeCreate(ctx);
      await ctx.service.applyTargetRuleSeriesConstraints(ctx.payload.process_definition_id, ctx.payload);
    },

    // La serie BLINDA el cargo/tipo de unidad de la regla: si la restricción los cambia, ese cambio
    // se propaga a los updates (no se pierde).
    async beforeUpdate(ctx) {
      await RULE_CHILD_GUARDS.beforeUpdate(ctx);
      const mergedRule = { ...ctx.existing, ...ctx.updates };
      await ctx.service.applyTargetRuleSeriesConstraints(ctx.existing.process_definition_id, mergedRule);
      for (const key of ["cargo_id", "unit_type_id"]) {
        if (mergedRule[key] != null && Number(mergedRule[key]) !== Number(ctx.existing[key])) {
          ctx.updates[key] = mergedRule[key];
        }
      }
    },

    beforeRemove: RULE_CHILD_GUARDS.beforeRemove
  },

  process_definition_period_types: {
    async beforeCreate(ctx) {
      await PERIOD_CHILD_GUARDS.beforeCreate(ctx);
      const definition = await ctx.service.getProcessDefinitionVersion(ctx.payload.process_definition_id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
    },

    beforeUpdate: PERIOD_CHILD_GUARDS.beforeUpdate,

    beforeRemove: PERIOD_CHILD_GUARDS.beforeRemove
  },

  template_artifacts: {
    // Los artifacts no se crean por CRUD admin: entran por sincronización desde MinIO o por el
    // flujo de plantilla de documento.
    beforeCreate() {
      throw new Error("Los artifacts se registran por sincronizacion desde MinIO o mediante el flujo de plantilla de documento.");
    },

    beforeUpdate(ctx) {
      // Una versión publicada es inmutable; solo se edita en borrador. Para cambiar una publicada, versiónala.
      if (String(ctx.existing.lifecycle_state || "published") !== "draft") {
        throw new Error("Esta plantilla está publicada (inmutable). Crea una nueva versión para editarla.");
      }
    }
  },

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
      if (isUniqueViolation(error)) {
        return conflict("Ya existe una instancia de tarea con esa configuracion, periodo y criterio de lanzamiento.");
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
    // Un documento es el CONTENEDOR de un entregable: sin item de tarea no existe. El "documento
    // suelto" (`origin_type = standalone`, documento con dueño y sin entregable) se retiró: lo que
    // no pertenece a ningún proceso cuelga del Proceso por defecto, que crea su entregable como
    // cualquier otro. Aquí solo se comprueba que el item EXISTA; que venga es requisito de
    // `TABLE_RULES` (crud/validation.js), donde viven los campos obligatorios del resto de tablas.
    async beforeCreate(ctx) {
      if (!ctx.payload.task_item_id) {
        return;
      }
      const taskItem = await ctx.service.getTaskItem(ctx.payload.task_item_id);
      if (!taskItem) {
        throw new Error("El item de tarea seleccionado no existe.");
      }
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
    },

    // Cuelga de la configuración a través de su plantilla, no por `process_definition_id` directo,
    // así que no puede reutilizar el guard compartido de las tres hijas.
    async beforeRemove(ctx) {
      const existing = await ctx.service.getByKeys(ctx.tableName, ctx.keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      const template = await ctx.service.getTaskTemplate(existing.process_definition_template_id);
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
