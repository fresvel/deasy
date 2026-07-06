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
// Dialecto: translateDialect() reescribe (protegiendo strings/comentarios)
// backticks->comillas, CURDATE/IFNULL/UNIX_TIMESTAMP, GROUP_CONCAT->string_agg,
// INSERT IGNORE->ON CONFLICT DO NOTHING, SET FOREIGN_KEY_CHECKS->session_replication_role.
// NO cubre ON DUPLICATE KEY UPDATE (requiere target de conflicto → fix en la query)
// ni diferencias de information_schema.
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

// Enlaza `?` -> `$n` Y expande parámetros array como hace mysql2:
//   IN (?)      con [1,2,3]        -> IN ($1, $2, $3)
//   VALUES ?    con [[1,2],[3,4]]  -> VALUES ($1, $2), ($3, $4)   (bulk insert)
//   IN (?)      con []             -> IN (NULL)                   (no matchea nada)
// Devuelve { text, values } con los valores aplanados en el orden correcto.
// Respeta strings/identificadores/comentarios (no toca `?` literales).
function bindParams(sql, params = []) {
  let out = "";
  let i = 0;
  let paramIndex = 0;
  let pg = 1;
  const values = [];
  let inSingle = false, inDouble = false, inBacktick = false, inLine = false, inBlock = false;

  const pushScalar = (v) => { values.push(v); return "$" + pg++; };

  while (i < sql.length) {
    const c = sql[i];
    const c2 = sql[i + 1];

    if (inLine) { out += c; if (c === "\n") inLine = false; i++; continue; }
    if (inBlock) { out += c; if (c === "*" && c2 === "/") { out += c2; i += 2; inBlock = false; continue; } i++; continue; }
    if (inSingle) { out += c; if (c === "'") { if (c2 === "'") { out += c2; i += 2; continue; } inSingle = false; } i++; continue; }
    if (inDouble) { out += c; if (c === '"') { if (c2 === '"') { out += c2; i += 2; continue; } inDouble = false; } i++; continue; }
    if (inBacktick) { out += c; if (c === "`") inBacktick = false; i++; continue; }

    if (c === "-" && c2 === "-") { inLine = true; out += c; i++; continue; }
    if (c === "/" && c2 === "*") { inBlock = true; out += c; i++; continue; }
    if (c === "'") { inSingle = true; out += c; i++; continue; }
    if (c === '"') { inDouble = true; out += c; i++; continue; }
    if (c === "`") { inBacktick = true; out += c; i++; continue; }

    if (c === "?") {
      const val = params[paramIndex++];
      if (Array.isArray(val)) {
        if (val.length === 0) {
          out += "NULL";
        } else if (Array.isArray(val[0])) {
          out += val.map((inner) => `(${inner.map(pushScalar).join(", ")})`).join(", ");
        } else {
          out += val.map(pushScalar).join(", ");
        }
      } else {
        out += pushScalar(val);
      }
      i++;
      continue;
    }

    out += c;
    i++;
  }
  return { text: out, values };
}

const isInsert = (sql) => /^\s*insert\b/i.test(sql);
const isWrite = (sql) => /^\s*(insert|update|delete|replace)\b/i.test(sql);
const hasReturning = (sql) => /\breturning\b/i.test(sql);

// GROUP_CONCAT([DISTINCT] expr [ORDER BY cols] [SEPARATOR 's']) -> string_agg(...)
function rewriteGroupConcat(code) {
  let out = "";
  let i = 0;
  const re = /\bGROUP_CONCAT\s*\(/gi;
  let m;
  let last = 0;
  while ((m = re.exec(code))) {
    out += code.slice(last, m.index);
    // parseo balanceado del contenido
    let depth = 0;
    let j = m.index + m[0].length - 1;
    for (; j < code.length; j++) {
      if (code[j] === "(") depth++;
      else if (code[j] === ")") { depth--; if (depth === 0) break; }
    }
    let inner = code.slice(m.index + m[0].length, j).trim();
    let distinct = "";
    if (/^DISTINCT\s+/i.test(inner)) { distinct = "DISTINCT "; inner = inner.replace(/^DISTINCT\s+/i, ""); }
    let sep = "','";
    const sepM = inner.match(/\s+SEPARATOR\s+(\S+)\s*$/i);
    if (sepM) { sep = sepM[1]; inner = inner.slice(0, sepM.index); }
    let orderBy = "";
    const obM = inner.match(/\s+ORDER\s+BY\s+(.+)$/i);
    if (obM) { orderBy = ` ORDER BY ${obM[1].trim()}`; inner = inner.slice(0, obM.index); }
    const expr = inner.trim();
    // En PG, string_agg(DISTINCT x ORDER BY y) exige y == x. Cuando hay DISTINCT
    // se ordena por la propia expresión (MySQL ordenaba por y; el conjunto de
    // valores es el mismo, sólo puede variar el orden).
    const finalOrderBy = distinct ? ` ORDER BY (${expr})::text` : orderBy;
    out += `string_agg(${distinct}(${expr})::text, ${sep}${finalOrderBy})`;
    last = j + 1;
    re.lastIndex = last;
  }
  out += code.slice(last);
  return out;
}

// IF(cond, a, b) -> CASE WHEN cond THEN a ELSE b END (paren-balanceado, anidados ok).
function rewriteIf(code) {
  const re = /\bIF\s*\(/gi;
  let m;
  while ((m = re.exec(code))) {
    let depth = 0;
    let j = m.index + m[0].length - 1;
    const args = [];
    let cur = "";
    for (; j < code.length; j++) {
      const ch = code[j];
      if (ch === "(") { depth++; if (depth === 1) continue; }
      if (ch === ")") { depth--; if (depth === 0) { args.push(cur); break; } }
      if (ch === "," && depth === 1) { args.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (args.length === 3) {
      const repl = `CASE WHEN ${args[0].trim()} THEN ${args[1].trim()} ELSE ${args[2].trim()} END`;
      code = code.slice(0, m.index) + repl + code.slice(j + 1);
      re.lastIndex = m.index; // reescanea (permite IF anidados en los argumentos)
    } else {
      re.lastIndex = m.index + m[0].length;
    }
  }
  return code;
}

// YEAR/MONTH/DAY/HOUR/MINUTE/SECOND(x) -> EXTRACT(field FROM (x))::int (balanceado).
const DATE_PART_FNS = ["YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND"];
function rewriteDateParts(code) {
  for (const fn of DATE_PART_FNS) {
    const re = new RegExp(`\\b${fn}\\s*\\(`, "gi");
    let m;
    while ((m = re.exec(code))) {
      let depth = 0;
      let j = m.index + m[0].length - 1;
      let arg = "";
      for (; j < code.length; j++) {
        const ch = code[j];
        if (ch === "(") { depth++; if (depth === 1) continue; }
        if (ch === ")") { depth--; if (depth === 0) break; }
        arg += ch;
      }
      const repl = `EXTRACT(${fn} FROM (${arg.trim()}))::int`;
      code = code.slice(0, m.index) + repl + code.slice(j + 1);
      re.lastIndex = m.index + repl.length;
    }
  }
  return code;
}

// Reescribe dialecto MySQL->PG sobre segmentos de CÓDIGO (sin strings/comentarios).
function rewriteDialect(code) {
  let c = code;
  c = c.replace(/`([^`]*)`/g, '"$1"'); // identificadores backtick -> comillas dobles
  c = c.replace(/\bCURDATE\s*\(\s*\)/gi, "CURRENT_DATE");
  c = c.replace(/\bCURTIME\s*\(\s*\)/gi, "CURRENT_TIME");
  c = c.replace(/\bIFNULL\s*\(/gi, "COALESCE(");
  c = c.replace(/\bUNIX_TIMESTAMP\s*\(\s*\)/gi, "EXTRACT(EPOCH FROM now())::bigint");
  c = c.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*0/gi, "SET session_replication_role = replica");
  c = c.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*1/gi, "SET session_replication_role = origin");
  // INSERT IGNORE INTO ... -> INSERT INTO ... ON CONFLICT DO NOTHING
  if (/^\s*INSERT\s+IGNORE\b/i.test(c)) {
    c = c.replace(/^(\s*)INSERT\s+IGNORE\b/i, "$1INSERT") + " ON CONFLICT DO NOTHING";
  }
  if (/\b(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND)\s*\(/i.test(c)) c = rewriteDateParts(c);
  if (/\bGROUP_CONCAT\s*\(/i.test(c)) c = rewriteGroupConcat(c);
  if (/\bIF\s*\(/i.test(c)) c = rewriteIf(c);
  return c;
}

// Traduce dialecto protegiendo strings y comentarios (para no tocar literales).
function translateDialect(sql) {
  const masks = [];
  const masked = sql.replace(/'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\//g, (mm) => {
    masks.push(mm);
    return `@@@${masks.length - 1}@@@`;
  });
  const rewritten = rewriteDialect(masked);
  return restoreMasks(rewritten, masks);
}
function restoreMasks(text, masks) {
  return text.replace(/@@@(\d+)@@@/g, (_, k) => masks[Number(k)]);
}

// Cache de índices ÚNICOS por tabla (incluye PK, UNIQUE constraints y
// CREATE UNIQUE INDEX). Se usa para inferir el target de ON CONFLICT.
let uniqueColsCache = null;
async function ensureUniqueCols(executor) {
  if (uniqueColsCache) return uniqueColsCache;
  const res = await executor.query(
    `SELECT idx.indrelid::regclass::text AS tbl,
            array_agg(a.attname::text ORDER BY a.attnum) AS cols
       FROM pg_index idx
       JOIN pg_attribute a ON a.attrelid = idx.indrelid AND a.attnum = ANY(idx.indkey)
      WHERE idx.indisunique AND idx.indpred IS NULL
      GROUP BY idx.indexrelid, idx.indrelid`
  );
  const toArray = (v) =>
    Array.isArray(v) ? v : String(v).replace(/^{|}$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
  const map = new Map();
  for (const row of res.rows) {
    const tbl = row.tbl.replace(/^[^.]*\./, "").replace(/"/g, "").toLowerCase();
    if (!map.has(tbl)) map.set(tbl, []);
    map.get(tbl).push(toArray(row.cols).map((c) => String(c).toLowerCase()));
  }
  uniqueColsCache = map;
  return map;
}

// ON DUPLICATE KEY UPDATE <sets> -> ON CONFLICT (<target>) DO UPDATE SET <sets>.
// El target se infiere: el índice único cuyas columnas están TODAS en la lista
// de columnas del INSERT (prefiere el más corto que no sea sólo `id`).
async function rewriteOnDuplicate(sql, executor) {
  const m = sql.match(/INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*\(([^)]*)\)/i);
  if (!m) return sql;
  const table = m[1].toLowerCase();
  const insertCols = m[2].split(",").map((s) => s.trim().replace(/`/g, "").toLowerCase());
  const cache = await ensureUniqueCols(executor);
  const covered = (cache.get(table) || [])
    .filter((cols) => cols.every((c) => insertCols.includes(c)))
    .sort((a, b) => a.length - b.length);
  const target = covered.find((cols) => !(cols.length === 1 && cols[0] === "id")) || covered[0];
  if (!target) return sql;
  return sql.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]*?)$/i, (_full, sets) => {
    const conv = sets
      // VALUES(col) o VALUES(`col`) -> EXCLUDED.col
      .replace(/=\s*VALUES\(\s*[`"]?(\w+)[`"]?\s*\)/gi, "= EXCLUDED.$1")
      // idiom MySQL `id = LAST_INSERT_ID(id)` -> se elimina (en PG el id se
      // obtiene con RETURNING id, que el adaptador añade a los INSERT).
      .replace(/\bid\s*=\s*LAST_INSERT_ID\s*\([^)]*\)\s*,?\s*/gi, "")
      .replace(/^\s*,\s*/, "")
      .trim();
    return `ON CONFLICT (${target.join(", ")}) DO UPDATE SET ${conv}`;
  });
}

const writeHeader = (res, insertId) => [
  { affectedRows: res.rowCount, changedRows: res.rowCount, insertId },
  res.fields,
];

// Ejecuta contra un `executor` (pool o client de pg) y devuelve la forma mysql2.
async function runQuery(executor, sql, params = []) {
  // ON DUPLICATE KEY UPDATE necesita inferir el target de conflicto (async).
  const prepared = /ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(sql)
    ? await rewriteOnDuplicate(sql, executor)
    : sql;
  const { text, values } = bindParams(translateDialect(prepared), params);

  // insertId best-effort: se añade RETURNING id. Si la tabla no tiene columna
  // `id` (42703) se cae al INSERT normal. Dentro de una transacción, el fallo
  // abortaría el BEGIN, así que se aísla con SAVEPOINT.
  if (isInsert(sql) && !hasReturning(sql)) {
    const inTx = !!executor._adapterInTx;
    if (inTx) await executor.query("SAVEPOINT _adapter_insertid");
    try {
      const res = await executor.query(`${text} RETURNING id`, values);
      if (inTx) await executor.query("RELEASE SAVEPOINT _adapter_insertid");
      return writeHeader(res, res.rows?.[0]?.id);
    } catch (err) {
      if (inTx) await executor.query("ROLLBACK TO SAVEPOINT _adapter_insertid");
      if (err && err.code !== "42703") throw err; // 42703 = columna "id" inexistente
    }
  }

  const res = await executor.query(text, values);
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
