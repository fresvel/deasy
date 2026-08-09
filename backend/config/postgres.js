// Adaptador de PostgreSQL que ESPEJA la interfaz de mysql2/promise heredada de la
// migración, para no reescribir los ~881 call sites (SQL escrito estilo mysql2).
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

// --- Escáner de SQL ------------------------------------------------------------
//
// Recorrer SQL saltándose lo que NO es código es la operación que necesita `bindParams`
// (y que necesitaba también `translatePlaceholders`, ya retirada por muerta). Antes cada
// una llevaba su propia copia del autómata, con cinco banderas de estado
// (inSingle/inDouble/inBacktick/inLine/inBlock) y una rama por bandera. Aquí esas cinco
// banderas son cinco FILAS de una tabla:
//
//   open     el prefijo que abre el tramo protegido
//   close    lo que lo cierra; si no aparece, el tramo llega al final del SQL
//   doubled  el cierre repetido es un escape y NO cierra (los '' y "" de SQL)
//
// El tramo se copia literalmente a la salida: dentro no se traduce nada.
const PROTECTED_SPANS = [
  { open: "--", close: "\n", doubled: false }, // comentario de línea
  { open: "/*", close: "*/", doubled: false }, // comentario de bloque
  { open: "'", close: "'", doubled: true }, // literal de cadena
  { open: '"', close: '"', doubled: true }, // identificador entrecomillado (PostgreSQL)
  { open: "`", close: "`", doubled: false }, // identificador con backtick (MySQL)
];

// Fin (exclusivo) del tramo abierto en `start`. El cierre se busca desde el carácter
// SIGUIENTE al de apertura, no desde el final del `open`: por eso `/*/` cuenta como un
// bloque ya cerrado. Es SQL degenerado y ninguna consulta del repo lo escribe, pero el
// autómata anterior se comportaba así y la red lo fija.
function findSpanEnd(sql, start, span) {
  let from = start + 1;
  while (from < sql.length) {
    const at = sql.indexOf(span.close, from);
    if (at === -1) break;
    const after = at + span.close.length;
    if (span.doubled && sql[after] === span.close) {
      from = after + 1; // '' escapado: sigue dentro del tramo
      continue;
    }
    return after;
  }
  return sql.length; // tramo sin cerrar: se traga el resto del SQL
}

// Copia el SQL sustituyendo cada `?` de CÓDIGO por lo que devuelva `onPlaceholder()`.
// Los `?` que caen dentro de un tramo protegido salen intactos.
function scanSql(sql, onPlaceholder) {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const span = PROTECTED_SPANS.find((s) => sql.startsWith(s.open, i));
    if (span) {
      const end = findSpanEnd(sql, i, span);
      out += sql.slice(i, end);
      i = end;
    } else if (sql[i] === "?") {
      out += onPlaceholder();
      i++;
    } else {
      out += sql[i];
      i++;
    }
  }
  return out;
}

// Expansión mysql2 de UN parámetro, según su forma:
//   escalar        -> $n
//   []             -> NULL          (IN (NULL) no casa con nada)
//   [1,2,3]        -> $1, $2, $3    (IN (?))
//   [[1,2],[3,4]]  -> ($1, $2), ($3, $4)   (bulk insert; solo se mira el PRIMER elemento)
// `pushScalar` registra el valor y devuelve su `$n`.
function expandParam(value, pushScalar) {
  if (!Array.isArray(value)) return pushScalar(value);
  if (value.length === 0) return "NULL";
  if (Array.isArray(value[0])) {
    // La lambda explicita NO es ruido: `.map` pasa (elemento, indice, array), y aunque hoy
    // `pushScalar` tiene aridad 1 y los ignora, pasarla directa deja el fallo armado para el dia
    // que alguien le anada un segundo parametro. Sonar lo marca como BUG (S7727).
    return value.map((row) => `(${row.map((v) => pushScalar(v)).join(", ")})`).join(", ");
  }
  return value.map((v) => pushScalar(v)).join(", ");
}

// Enlaza `?` -> `$n` Y expande parámetros array como hace mysql2:
//   IN (?)      con [1,2,3]        -> IN ($1, $2, $3)
//   VALUES ?    con [[1,2],[3,4]]  -> VALUES ($1, $2), ($3, $4)   (bulk insert)
//   IN (?)      con []             -> IN (NULL)                   (no matchea nada)
// Devuelve { text, values } con los valores aplanados en el orden correcto.
// Respeta strings/identificadores/comentarios (no toca `?` literales).
//
// FALLA RUIDOSAMENTE SI FALTAN PARÁMETROS, y ese es el punto. Antes, un `?` sin su
// parámetro recibía `undefined`; pg lo manda como NULL y la consulta **no fallaba**: se
// ejecutaba con datos equivocados. Un `WHERE id = ?` sin parámetro no casa con nada (NULL
// no es igual a nada, ni siquiera a NULL) y un `UPDATE ... SET col = ?` machaca la columna
// con NULL. Los dos son silenciosos: ni excepción, ni log, ni fila de más o de menos que
// delate el fallo. Es preferible un 500 en el sitio exacto que una corrupción muda.
//
// Sobrar parámetros SÍ se tolera (mysql2 hacía lo mismo): los de más se ignoran y hay
// call sites que reutilizan un array de argumentos más largo que la consulta.
export function bindParams(sql, params = []) {
  const values = [];
  let paramIndex = 0;
  let placeholder = 1;
  const pushScalar = (v) => { values.push(v); return "$" + placeholder++; };

  const text = scanSql(sql, () => expandParam(params[paramIndex++], pushScalar));

  // `paramIndex` acabó valiendo el número de `?` de CÓDIGO (los de literales y comentarios
  // no consumen). Un `params` que no sea array no aporta ninguno: cuenta como cero.
  const provided = Array.isArray(params) ? params.length : 0;
  if (paramIndex > provided) {
    // El mensaje NO lleva el SQL: varios controllers responden `error.message` al cliente y
    // eso filtraría el esquema. El sitio exacto ya lo da el stack trace en el log.
    throw new Error(
      `bindParams: la consulta tiene ${paramIndex} placeholders "?" y solo se recibieron ` +
      `${provided} parametros. Faltan ${paramIndex - provided}: sin este error se enviarian ` +
      `como NULL y la consulta se ejecutaria con datos equivocados.`
    );
  }
  return { text, values };
}

const isInsert = (sql) => /^\s*insert\b/i.test(sql);
const isWrite = (sql) => /^\s*(insert|update|delete|replace)\b/i.test(sql);
const hasReturning = (sql) => /\breturning\b/i.test(sql);

// GROUP_CONCAT([DISTINCT] expr [ORDER BY cols] [SEPARATOR 's']) -> string_agg(...)
export function rewriteGroupConcat(code) {
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
export function rewriteIf(code) {
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

// FIELD(expr, a, b, c) -> posición 1-based de expr en la lista, 0 si no está.
// Es una función de MySQL usada para ordenar por un orden arbitrario
// (`ORDER BY FIELD(status,'active','draft','retired')`). PostgreSQL no la tiene:
// se traduce a un CASE que devuelve el mismo entero, preservando el 0 de "no
// encontrado" para que los NULL/desconocidos sigan ordenando igual que en MySQL.
export function rewriteField(code) {
  const re = /\bFIELD\s*\(/gi;
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
    if (args.length >= 2) {
      const needle = args[0].trim();
      const whens = args
        .slice(1)
        .map((value, index) => `WHEN ${value.trim()} THEN ${index + 1}`)
        .join(" ");
      const repl = `(CASE ${needle} ${whens} ELSE 0 END)`;
      code = code.slice(0, m.index) + repl + code.slice(j + 1);
      re.lastIndex = m.index + repl.length;
    } else {
      re.lastIndex = m.index + m[0].length;
    }
  }
  return code;
}

// YEAR/MONTH/DAY/HOUR/MINUTE/SECOND(x) -> EXTRACT(field FROM (x))::int (balanceado).
const DATE_PART_FNS = ["YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND"];
export function rewriteDateParts(code) {
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
export function rewriteDialect(code) {
  let c = code;
  c = c.replace(/`([^`]*)`/g, '"$1"'); // identificadores backtick -> comillas dobles
  c = c.replace(/\bCURDATE\s*\(\s*\)/gi, "CURRENT_DATE");
  c = c.replace(/\bCURTIME\s*\(\s*\)/gi, "CURRENT_TIME");
  c = c.replace(/\bIFNULL\s*\(/gi, "COALESCE(");
  c = c.replace(/\bUNIX_TIMESTAMP\s*\(\s*\)/gi, "EXTRACT(EPOCH FROM now())::bigint");
  // `SELECT ... FROM DUAL` es una tabla ficticia de MySQL/Oracle. PostgreSQL admite el
  // SELECT sin FROM, así que basta con eliminar la cláusula.
  c = c.replace(/\bFROM\s+DUAL\b/gi, "");
  // `<=>` es la igualdad NULL-safe de MySQL (NULL <=> NULL es TRUE). PostgreSQL no la
  // tiene: el equivalente es IS NOT DISTINCT FROM. Sin esto, `term_id <=> ?` explota con
  // "operator does not exist: integer <=> unknown" y tumbaba el lanzamiento de procesos.
  c = c.replace(/\s*<=>\s*/g, " IS NOT DISTINCT FROM ");
  c = c.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*0/gi, "SET session_replication_role = replica");
  c = c.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*1/gi, "SET session_replication_role = origin");
  // INSERT IGNORE INTO ... -> INSERT INTO ... ON CONFLICT DO NOTHING
  if (/^\s*INSERT\s+IGNORE\b/i.test(c)) {
    c = c.replace(/^(\s*)INSERT\s+IGNORE\b/i, "$1INSERT") + " ON CONFLICT DO NOTHING";
  }
  if (/\b(YEAR|MONTH|DAY|HOUR|MINUTE|SECOND)\s*\(/i.test(c)) c = rewriteDateParts(c);
  if (/\bGROUP_CONCAT\s*\(/i.test(c)) c = rewriteGroupConcat(c);
  // FIELD antes que IF: no colisionan, pero el CASE generado no debe reescanearse.
  if (/\bFIELD\s*\(/i.test(c)) c = rewriteField(c);
  if (/\bIF\s*\(/i.test(c)) c = rewriteIf(c);
  return c;
}

// Traduce dialecto protegiendo strings y comentarios (para no tocar literales).
export function translateDialect(sql) {
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
    const tbl = row.tbl.replace(/^[^.]*\./, "").replaceAll("\"", "").toLowerCase();
    if (!map.has(tbl)) map.set(tbl, []);
    map.get(tbl).push(toArray(row.cols).map((c) => String(c).toLowerCase()));
  }
  uniqueColsCache = map;
  return map;
}

// Columnas GENERADAS por tabla (STORED). Un índice único puede incluirlas
// (p.ej. uq_position_current sobre current_flag) y NUNCA aparecen en el INSERT,
// pero SÍ son un target válido de ON CONFLICT (PG las computa). Se usa para
// cubrir esos índices cuando ninguno es cubierto por columnas explícitas.
let generatedColsCache = null;
async function ensureGeneratedCols(executor) {
  if (generatedColsCache) return generatedColsCache;
  const res = await executor.query(
    `SELECT c.relname AS tbl, a.attname AS col
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE a.attgenerated <> '' AND a.attnum > 0 AND NOT a.attisdropped
        AND n.nspname = ANY (current_schemas(false))`
  );
  const map = new Map();
  for (const row of res.rows) {
    const tbl = String(row.tbl).toLowerCase();
    if (!map.has(tbl)) map.set(tbl, new Set());
    map.get(tbl).add(String(row.col).toLowerCase());
  }
  generatedColsCache = map;
  return map;
}

// ON DUPLICATE KEY UPDATE <sets> -> ON CONFLICT (<target>) DO UPDATE SET <sets>.
//
// Parte PURA: dado el catálogo de índices ya resuelto, infiere el target y reescribe
// el texto. No toca la base de datos, así que es testeable sin pg (ver
// postgres.dialect.test.js). `uniqueIndexes` es la lista de índices únicos de la tabla
// (cada uno un array de columnas); `generatedCols` el Set de columnas GENERADAS.
//
// El target es el índice único cuyas columnas están TODAS cubiertas por la lista del
// INSERT (o por columnas generadas, que PG computa aunque no vengan en el INSERT).
// Entre los cubiertos se prefiere el más corto que no sea sólo `id`.
export function applyOnConflict(sql, { uniqueIndexes = [], generatedCols = new Set() } = {}) {
  const m = sql.match(/INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*\(([^)]*)\)/i);
  if (!m) return sql;
  const insertCols = m[2].split(",").map((s) => s.trim().replaceAll("`", "").toLowerCase());

  const strict = uniqueIndexes.filter((cols) => cols.every((c) => insertCols.includes(c)));
  let pool = strict;
  if (!pool.length) {
    pool = uniqueIndexes.filter((cols) => cols.every((c) => insertCols.includes(c) || generatedCols.has(c)));
  }
  const covered = [...pool].sort((a, b) => a.length - b.length);
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

// Orquestador: resuelve el catálogo de índices desde pg (con caché) y delega en la
// parte pura. Solo la resolución de índices toca la base de datos.
async function rewriteOnDuplicate(sql, executor) {
  const m = sql.match(/INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*\(/i);
  if (!m) return sql;
  const table = m[1].toLowerCase();
  const uniqueIndexes = (await ensureUniqueCols(executor)).get(table) || [];
  const generatedCols = (await ensureGeneratedCols(executor)).get(table) || new Set();
  return applyOnConflict(sql, { uniqueIndexes, generatedCols });
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
