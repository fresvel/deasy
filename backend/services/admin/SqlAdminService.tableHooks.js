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

// -------------------------------------------------------------------------------------------
// El registro. Una entrada por tabla con lógica propia; las demás pasan por el camino genérico.
// -------------------------------------------------------------------------------------------

export const TABLE_HOOKS = {};

const NO_HOOKS = Object.freeze({});

export function getTableHooks(tableName) {
  return TABLE_HOOKS[tableName] || NO_HOOKS;
}
