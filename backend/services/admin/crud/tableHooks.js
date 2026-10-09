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
import { conflict, forbidden } from "../../../errors/HttpError.js";
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
 * Los hooks `*Tx` de la tabla con los de quien llama ALREDEDOR, en la misma transacción: `antes` corre
 * antes que el `before` de la tabla, y `despues` después de su `after`. Sin `extra`, devuelve los de la
 * tabla tal cual, así que para quien no lo pasa no cambia nada.
 *
 * Existe por la bitácora de accesos sensibles (`SqlAdminConBitacora`): la entrada de una escritura
 * tiene que confirmarse —o deshacerse— con la escritura, y eso sólo es verdad si va en su transacción.
 */
export function envolverEnTransaccion({ before, after } = {}, extra = null) {
  if (!extra) {
    return { before, after };
  }
  return {
    before: async (ctx) => {
      if (extra.antes) await extra.antes(ctx);
      if (before) await before(ctx);
    },
    after: async (ctx) => {
      if (after) await after(ctx);
      if (extra.despues) await extra.despues(ctx);
    }
  };
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

// `turnos` y `document_signatures` tienen el MISMO injerto en create y en update: escribir y
// reconciliar el progreso del documento dentro de la misma transacción. Solo cambia la función de
// reconciliación.
//
// ⚠️ ERAN TRES, `fill_requests` y `signature_requests` ENTRE ELLAS, y sus injertos se retiraron en el
// paso 3b de la fase 4 del frente 24. No por limpieza: esas dos tablas YA NO SON LA EJECUCIÓN, así
// que su `id` ya no identifica un turno — el injerto habría reconciliado el documento equivocado,
// que es peor que no reconciliar ninguno.
// ¿DE QUÉ LADO ES ESTE TURNO? Lo dice su recorrido, y de ahí sale a cuál de las dos
// reconciliaciones llamar. Es la única consulta que la unificación añade: antes la respuesta estaba
// en el NOMBRE DE LA TABLA que se acababa de editar.
const syncProgressFromTurno = async (connection, turnoId) => {
  const [rows] = await connection.query(
    `SELECT r.accion
       FROM turnos t
       INNER JOIN recorridos r ON r.id = t.recorrido_id
      WHERE t.id = ?
      LIMIT 1`,
    [turnoId]
  );
  const accion = String(rows?.[0]?.accion || "");
  if (accion === "firma") {
    return syncDocumentProgressFromSignatureRequest(connection, turnoId);
  }
  if (accion === "entrega") {
    return syncDocumentProgressFromFillRequest(connection, turnoId);
  }
  return null;
};

const syncProgressHooks = (syncProgress) => ({
  async afterInsertTx(ctx) {
    await syncProgress(ctx.connection, Number(ctx.insertId));
  },
  async afterUpdateTx(ctx) {
    await syncProgress(ctx.connection, Number(ctx.existing.id ?? ctx.keyPayload.id));
  }
});

// Las tres tablas HIJAS de una configuración (`vinculos`, `process_target_rules`
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

// EL ORIGEN DE UN PASO DECLARADO decide tambien POR QUE se rechaza editarlo. Son dos, excluyentes
// por `CHECK`, y cada uno da una respuesta distinta:
//
//   · `task_item_id` -> el recorrido se definio AL ENVIAR y pertenece a ese entregable. El editor
//     generico no lo toca, y lo que hay que decir es ESO.
//   · `edicion_id`   -> se edita mientras la edicion este en `draft`. Misma puerta que usa
//     `templateLifecycle` para publicar.
//
// ⚠️ AQUI HABIA UNA DEDUCCION Y SE FUE con las cabeceras viejas (paso 4 de la fase 4 del frente 24):
// `sqlTables.js` no catalogaba su `task_item_id`, asi que el portador de runtime no se podia leer de
// la fila y se deducia por descarte --si una fila que ya existe no tiene edicion, su portador es por
// fuerza el entregable--. En `pasos_declarados` las dos columnas estan catalogadas: la fila lo dice.
//
// En `create` el payload puede venir sin origen y se DEJA PASAR, y el orden de los pasos es el
// motivo: la cabecera de este fichero lo deja escrito --`beforeCreate -> [requeridos ->
// validateFieldTypes -> validateTableRules]`--, o sea que este hook corre ANTES de la validacion.
// Quien tiene que hablar de un origen ausente es el `CHECK` `ck_pasos_declarados_un_origen`, porque
// lo que esta mal no es que falte un campo: es que no haya EXACTAMENTE UNO. Adelantarse aqui con un
// mensaje campo a campo lo unico que haria es empeorarlo.
const exigirRecorridoEditable = async (ctx, fila, entityLabel, { creando = false } = {}) => {
  if (!fila?.edicion_id) {
    if (creando) {
      return;
    }
    throw new Error(
      `No se puede editar ${entityLabel}: este recorrido se definio al enviar un entregable y pertenece a el, no a una edicion.`
    );
  }
  await ctx.service.ensureDraftEdicionContext(fila.edicion_id, { entityLabel });
};


// La puerta de un PARTICIPANTE es la de su paso. Un paso que no existe lo rechaza aqui y no en la
// clave ajena: el mensaje de la base nombra una restriccion, no lo que el usuario hizo.
const exigirPasoEditable = async (ctx, pasoId) => {
  if (!pasoId) {
    return;
  }
  const paso = await ctx.service.getPasoDeclarado(pasoId);
  if (!paso) {
    throw new Error("El paso del recorrido seleccionado no existe.");
  }
  await exigirRecorridoEditable(ctx, paso, "los participantes del recorrido");
};


export const TABLE_HOOKS = {
  // ⚠️ LA BITACORA NO SE ESCRIBE DESDE /admin -- ni AdminSistema, que tiene `manage` de todo--. Una
  // entrada dada de alta a mano es una entrada FALSA con aspecto de verdadera. Las altas las hace
  // `AccesosSensiblesService`; modificar y borrar los rechaza ademas el trigger del esquema.
  accesos_sensibles: {
    async beforeCreate() {
      throw forbidden("La bitacora de accesos no admite altas desde el editor.");
    },
    async beforeUpdate() {
      throw forbidden("La bitacora de accesos no se modifica.");
    }
  },

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

      // ⚠️ AQUÍ SE DESVIABAN SEIS CAMPOS VIRTUALES —documento, correo y teléfono— a sus tablas.
      // Retirado el 2026-08-28, el mismo día que se puso: `beforeCreate` los trataba y
      // `beforeUpdate` NO, así que al EDITAR una persona el formulario los mostraba y los
      // DESCARTABA EN SILENCIO. Y de fondo rompían la premisa del editor genérico: una tabla, sus
      // columnas. Los satélites se gestionan en sus propias pestañas.
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

  vinculos: {
    async beforeCreate(ctx) {
      await TEMPLATE_CHILD_GUARDS.beforeCreate(ctx);
      // AQUI LLAMABA A `assertDeliverableBelongsToConfigLine` —"la pared"— hasta el 2026-10-04
      // (frente 23, F1.3). Rechazaba con 422 el vinculo cuyo entregable fuera de otra linea,
      // comparando `catalogo_documental.owner_process_id` / `owner_variation_key` con la definicion. Esas
      // dos columnas se retiraron en F1.2 porque este guardia era su UNICO lector, asi que la
      // comprobacion se va con ellas.
      //
      // LA SUSTITUYE LA BASE, y cubre mas: `trg_pdt_linea_unica` (final de `postgres_schema.sql`)
      // rechaza el vinculo cuyo entregable ya sirva a otra linea, venga de este hook, del clon, de
      // un script o de un INSERT a mano — por ahi no pasaba el guardia. No es un indice unico
      // porque la regla mira `(process_id, series_id)` y eso no cabe en un indice de esta tabla.
      // Su `RAISE EXCEPTION` llega al cliente como 400 con el mismo texto que daba el 422.
      //
      // Vínculo idempotente: si la plantilla ya está en esta configuración (p. ej. porque al crearla desde el
      // wizard ya se enlazó), no se duplica el registro (evita el conflicto de clave unica de
      // uq_vinculos); se devuelve el vínculo existente. `shortCircuit` corta el
      // create() sin llegar al INSERT.
      const [existingLinkRows] = await ctx.pool.query(
        `SELECT id, sort_order FROM vinculos
         WHERE process_definition_id = ? AND edicion_id = ? LIMIT 1`,
        [ctx.payload.process_definition_id, ctx.payload.edicion_id]
      );
      if (existingLinkRows?.length) {
        ctx.shortCircuit = {
          id: existingLinkRows[0].id,
          process_definition_id: Number(ctx.payload.process_definition_id),
          edicion_id: Number(ctx.payload.edicion_id),
          sort_order: existingLinkRows[0].sort_order,
          __notice: "La plantilla ya estaba vinculada a esta configuración."
        };
        return;
      }
      // El orden es interno (secuencia de la plantilla dentro de la configuración) y se asigna solo:
      // el usuario no debe elegirlo.
      if (ctx.payload.sort_order === undefined || ctx.payload.sort_order === null || ctx.payload.sort_order === "") {
        const [countRows] = await ctx.pool.query(
          "SELECT COUNT(*) AS c FROM vinculos WHERE process_definition_id = ?",
          [ctx.payload.process_definition_id]
        );
        ctx.payload.sort_order = Number(countRows?.[0]?.c || 0) + 1;
      }
    },

    // AQUÍ HABÍA UN `afterInsertTx` (y su gemelo `afterUpdateTx`, abajo) que proyectaba el flujo del
    // `meta.yaml` al vínculo recién creado. Eran los DOS llamadores del sync sin `catch`, y por eso
    // el sub-paso 7 del §0.8 dejó documentada una ventana abierta: `meta_object_key` apuntaba a un
    // objeto que ya no se subía. Retirado el sync, no hay nada que proyectar —el flujo cuelga del
    // ENTREGABLE, y vincularlo a una configuración más no lo cambia— y la ventana se cierra sola.
    //
    // Vincular un entregable ya NO toca ninguna tabla de flujo. Lo único que sigue haciéndolo por
    // este lado es `beforeRemoveTx`, que limpia lo que quedara colgando del vínculo que se borra.

    beforeUpdate: TEMPLATE_CHILD_GUARDS.beforeUpdate,

    beforeRemove: TEMPLATE_CHILD_GUARDS.beforeRemove,

    // AQUI HABIA UN `beforeRemoveTx` que borraba las cabeceras del vinculo y sus pasos antes del
    // DELETE, porque sus claves ajenas no eran ON DELETE CASCADE y el borrado fallaba sin eso.
    // Ya no hace falta: UN VINCULO NO ES DUENO DE NINGUNA CABECERA desde que murio el escalon 2
    // (fase 2 del frente 24). El recorrido autorado es de la EDICION y sobrevive al vinculo --que
    // es justo lo que se quiere: desenlazar una plantilla de una configuracion no puede borrar el
    // recorrido que esa plantilla tiene escrito--. Las cabeceras de runtime cuelgan del ENTREGABLE
    // con ON DELETE CASCADE, asi que se van con el; y un vinculo con entregables no se puede borrar
    // --su clave ajena es NO ACTION--, asi que cuando este borrado ya no queda ninguna.
    //
    // Un hook vacio es peor que ninguno: se lee como "aqui falta algo".
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

  ediciones: {
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
      // El guard de "no se puede cambiar el creador de una tarea" murio con la columna el
      // 2026-08-23: quien encarga vive ahora en el ENTREGABLE (`created_by_person_id`), y quien
      // lanza una corrida en `process_runs`.
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
      if (!ctx.payload.vinculo_id) {
        return;
      }
      const template = await ctx.service.getTaskTemplate(ctx.payload.vinculo_id);
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
      // Aqui se copiaba `template.edicion_id` al payload. La columna se retiro el
      // 2026-10-04 (frente 23, F2.1): el vinculo que ya lleva el payload lo dice.
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
      if (Object.hasOwn(updates, "vinculo_id")) {
        if (Number(updates.vinculo_id) !== Number(existing.vinculo_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un item.");
        }
        delete updates.vinculo_id;
      }
      // El guard gemelo de `edicion_id` —"No se puede cambiar el paquete asociado de un
      // item"— murio con la columna el 2026-10-04 (frente 23, F2.1). Era la misma regla dicha dos
      // veces: la de arriba ya impide cambiar el vinculo, y el paquete lo decide el vinculo.
    }
  },

  // El injerto de `documents` VIVIO AQUI hasta el 2026-08-23. Comprobaba que el entregable
  // existiera al crear un documento, y que no cambiara al editarlo. La tabla se retiro —era una
  // cascara 1:1 sin ni una columna propia— y con ella la regla: no puede haber documento sin
  // entregable porque el documento ES el entregable.
  document_versions: {
    // El artifact se hereda del ENTREGABLE cuando no viene explícito. Antes daba un rodeo por
    // `documents` para llegar hasta él; desde el 2026-08-23 la versión cuelga del entregable.
    async beforeCreate(ctx) {
      if (!ctx.payload.task_item_id) {
        return;
      }
      const taskItem = await ctx.service.getTaskItem(ctx.payload.task_item_id);
      if (!taskItem) {
        throw new Error("El entregable seleccionado no existe.");
      }
      if (!ctx.payload.edicion_id && taskItem.edicion_id) {
        ctx.payload.edicion_id = taskItem.edicion_id;
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

  // Las dos tablas de turnos/firmas comparten forma: escribir y reconciliar el progreso del
  // documento en la misma transacción, tanto al crear como al actualizar.
  //
  // Y en `turnos` la reconciliación se ELIGE, porque la tabla sirve a las dos acciones. Antes eran
  // dos entradas --una por tabla-- y el reparto lo hacía el nombre; hoy lo hace el recorrido.
  turnos: syncProgressHooks(syncProgressFromTurno),
  document_signatures: syncProgressHooks(syncDocumentProgressFromDocumentSignature),

  // ── LA RECETA: SE EDITA MIENTRAS LA EDICION ESTE EN BORRADOR ────────────────────────────────
  //
  // AQUI HABIA TRES ENTRADAS --`fill_flow_templates`, `fill_flow_steps` y `signature_flow_templates`--
  // y son DOS, porque la receta es una sola para los dos lados. Y el guard se simplifico de verdad,
  // no solo de nombre: un paso de entrega tenia que ir a buscar su CABECERA para saber de que edicion
  // era (`getFillFlowTemplate` -> `edicion_id`), y hoy el paso LLEVA SU ORIGEN. Un salto menos.
  //
  // ⚠️ Y LA DEDUCCION QUE `exigirRecorridoEditable` TENIA QUE HACER YA NO HACE FALTA. Su nota decia
  // que el ancla de runtime no se podia leer de la fila porque `sqlTables.js` no cataloga
  // `task_item_id` en las cabeceras viejas, asi que se deducia por descarte. En `pasos_declarados`
  // las DOS columnas de origen estan catalogadas: la fila dice cual es, sin deducir.
  pasos_declarados: {
    async beforeCreate(ctx) {
      await exigirRecorridoEditable(ctx, ctx.payload, "los pasos del recorrido", { creando: true });
    },

    async beforeUpdate(ctx) {
      // EL ORIGEN NO SE MUEVE. Cambiarlo no es editar un paso: es trasplantarlo a otra receta, con
      // los huecos de firma de la de destino ya ocupados. Lo mismo que las cabeceras prohibian.
      for (const columna of ["edicion_id", "task_item_id", "accion"]) {
        if (Object.hasOwn(ctx.updates, columna)) {
          if (String(ctx.updates[columna] ?? "") !== String(ctx.existing[columna] ?? "")) {
            throw new Error(`No se puede cambiar '${columna}' de un paso del recorrido.`);
          }
          delete ctx.updates[columna];
        }
      }
      await exigirRecorridoEditable(ctx, ctx.existing, "los pasos del recorrido");
    },

    async beforeRemove(ctx) {
      const existing = await ctx.service.getByKeys(ctx.tableName, ctx.keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      await exigirRecorridoEditable(ctx, existing, "los pasos del recorrido");
    }
  },

  participantes_declarados: {
    // El participante no lleva origen: lo lleva su paso, y de ahi sale la puerta. Es el unico salto
    // que queda, y es el que antes daban TAMBIEN los pasos.
    async beforeCreate(ctx) {
      await exigirPasoEditable(ctx, ctx.payload.paso_id);
    },

    async beforeUpdate(ctx) {
      if (Object.hasOwn(ctx.updates, "paso_id")) {
        if (Number(ctx.updates.paso_id) !== Number(ctx.existing.paso_id)) {
          throw new Error("No se puede cambiar el paso asociado de un participante.");
        }
        delete ctx.updates.paso_id;
      }
      await exigirPasoEditable(ctx, ctx.existing.paso_id);
    },

    async beforeRemove(ctx) {
      const existing = await ctx.service.getByKeys(ctx.tableName, ctx.keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      await exigirPasoEditable(ctx, existing.paso_id);
    }
  },
};

const NO_HOOKS = Object.freeze({});

export function getTableHooks(tableName) {
  return TABLE_HOOKS[tableName] || NO_HOOKS;
}
