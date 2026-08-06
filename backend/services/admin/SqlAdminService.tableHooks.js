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
};

const NO_HOOKS = Object.freeze({});

export function getTableHooks(tableName) {
  return TABLE_HOOKS[tableName] || NO_HOOKS;
}
