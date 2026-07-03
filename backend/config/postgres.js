// Adaptador de PostgreSQL que ESPEJA la interfaz de mysql2/promise usada hoy en
// config/mariadb.js, para migrar el motor sin reescribir los ~881 call sites.
//
// Qué traduce el adaptador (deliberadamente fino):
//   1. Placeholders `?` (mysql2) → `$1..$n` (pg), respetando strings y comentarios.
//   2. Forma del retorno: mysql2 devuelve `[rows, fields]`; para escrituras
//      devuelve `[ResultSetHeader, fields]` con `insertId`/`affectedRows`. Aquí
//      se reconstruye esa forma sobre el resultado de `pg`.
//   3. `getConnection()` con `beginTransaction/commit/rollback/release/ping`.
//
// Lo que NO hace (queda para la fase de portado de queries): traducir backticks,
// funciones de dialecto (NOW/CURDATE/GROUP_CONCAT), ON DUPLICATE KEY, etc.
//
// insertId: pg no expone un last-insert-id. Para INSERTs sin RETURNING se añade
// `RETURNING id` best-effort; si la tabla no tiene columna `id` (42703) se
// reintenta sin RETURNING y `insertId` queda undefined (igual que un INSERT
// multi-fila en mysql2 sólo garantiza el primer id).

import pg from "pg";

const { Pool } = pg;

const REQUIRED_ENV_VARS = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length) {
  console.warn(`⚠️  Configuración PostgreSQL incompleta. Variables faltantes: ${missingEnvVars.join(", ")}`);
}

const databaseName = process.env.POSTGRES_DB;

const pool = missingEnvVars.length
  ? null
  : new Pool({
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: databaseName,
      max: Number(process.env.POSTGRES_CONNECTION_LIMIT || 10),
    });

// --- Traducción de placeholders ?  ->  $1..$n (respeta strings/identificadores/comentarios) ---
export function translatePlaceholders(sql) {
  let out = "";
  let n = 1;
  let i = 0;
  let inSingle = false; // '...'
  let inDouble = false; // "..."
  let inBacktick = false; // `...` (identificadores mysql; se dejan tal cual aquí)
  let inLine = false; // -- ...
  let inBlock = false; // /* ... */

  while (i < sql.length) {
    const c = sql[i];
    const c2 = sql[i + 1];

    if (inLine) {
      out += c;
      if (c === "\n") inLine = false;
      i++;
      continue;
    }
    if (inBlock) {
      out += c;
      if (c === "*" && c2 === "/") { out += c2; i += 2; inBlock = false; continue; }
      i++;
      continue;
    }
    if (inSingle) {
      out += c;
      if (c === "'") { if (c2 === "'") { out += c2; i += 2; continue; } inSingle = false; }
      i++;
      continue;
    }
    if (inDouble) {
      out += c;
      if (c === '"') { if (c2 === '"') { out += c2; i += 2; continue; } inDouble = false; }
      i++;
      continue;
    }
    if (inBacktick) {
      out += c;
      if (c === "`") inBacktick = false;
      i++;
      continue;
    }

    if (c === "-" && c2 === "-") { inLine = true; out += c; i++; continue; }
    if (c === "/" && c2 === "*") { inBlock = true; out += c; i++; continue; }
    if (c === "'") { inSingle = true; out += c; i++; continue; }
    if (c === '"') { inDouble = true; out += c; i++; continue; }
    if (c === "`") { inBacktick = true; out += c; i++; continue; }
    if (c === "?") { out += "$" + n++; i++; continue; }

    out += c;
    i++;
  }
  return out;
}

const isInsert = (sql) => /^\s*insert\b/i.test(sql);
const isWrite = (sql) => /^\s*(insert|update|delete|replace)\b/i.test(sql);
const hasReturning = (sql) => /\breturning\b/i.test(sql);

const writeHeader = (res, insertId) => [
  { affectedRows: res.rowCount, changedRows: res.rowCount, insertId },
  res.fields,
];

// Ejecuta contra un `executor` (pool o client de pg) y devuelve la forma mysql2.
async function runQuery(executor, sql, params = []) {
  const text = translatePlaceholders(sql);

  // insertId best-effort: se añade RETURNING id. Si la tabla no tiene columna
  // `id` (42703) se cae al INSERT normal. Dentro de una transacción, el fallo
  // abortaría el BEGIN, así que se aísla con SAVEPOINT.
  if (isInsert(sql) && !hasReturning(sql)) {
    const inTx = !!executor._adapterInTx;
    if (inTx) await executor.query("SAVEPOINT _adapter_insertid");
    try {
      const res = await executor.query(`${text} RETURNING id`, params);
      if (inTx) await executor.query("RELEASE SAVEPOINT _adapter_insertid");
      return writeHeader(res, res.rows?.[0]?.id);
    } catch (err) {
      if (inTx) await executor.query("ROLLBACK TO SAVEPOINT _adapter_insertid");
      if (err && err.code !== "42703") throw err; // 42703 = columna "id" inexistente
    }
  }

  const res = await executor.query(text, params);
  if (isWrite(sql)) return writeHeader(res, undefined);
  // SELECT / WITH / SHOW-like: devolver filas como en mysql2.
  return [res.rows, res.fields];
}

function wrapConnection(client) {
  return {
    query: (sql, params) => runQuery(client, sql, params),
    execute: (sql, params) => runQuery(client, sql, params),
    beginTransaction: async () => { await client.query("BEGIN"); client._adapterInTx = true; },
    commit: async () => { await client.query("COMMIT"); client._adapterInTx = false; },
    rollback: async () => { await client.query("ROLLBACK"); client._adapterInTx = false; },
    ping: () => client.query("SELECT 1"),
    release: () => client.release(),
    _client: client,
  };
}

// Pool con interfaz mysql2: query/execute directos + getConnection().
const wrappedPool = pool
  ? {
      query: (sql, params) => runQuery(pool, sql, params),
      execute: (sql, params) => runQuery(pool, sql, params),
      getConnection: async () => wrapConnection(await pool.connect()),
      end: () => pool.end(),
      _pool: pool,
    }
  : null;

export const getPostgresPool = () => wrappedPool;
export const getPostgresDatabaseName = () => databaseName;

export const assertPostgresConnection = async () => {
  if (!wrappedPool) {
    throw new Error("La conexión a PostgreSQL no está configurada correctamente. Revisa las variables de entorno.");
  }
  const conn = await wrappedPool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
};

export const closePostgresPool = async () => {
  if (!pool) return;
  await pool.end();
};
