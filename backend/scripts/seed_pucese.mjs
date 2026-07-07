import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SQL_TABLES } from "../config/sqlTables.js";
import { getPostgresPool } from "../config/postgres.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));

const envPath = path.join(backendRoot, ".env");
const defaultSeedName = "pucese";
const defaultSeedFile = path.join(__dirname, "seeds", `${defaultSeedName}.seed.json`);

const formatError = (error) => {
  if (!error) return "Error desconocido.";
  const parts = [];
  if (typeof error.message === "string" && error.message.trim()) parts.push(error.message.trim());
  if (error.code) parts.push(`code=${error.code}`);
  if (error.errno !== undefined && error.errno !== null) parts.push(`errno=${error.errno}`);
  if (error.sqlState) parts.push(`sqlState=${error.sqlState}`);
  if (!parts.length) return String(error);
  return parts.join(" | ");
};

const usage = () => {
  console.log("Uso:");
  console.log("  node backend/scripts/seed_pucese.mjs [apply] [--file <ruta>] [--full]");
  console.log("  node backend/scripts/seed_pucese.mjs capture [--file <ruta>]");
  console.log("");
  console.log("Por defecto 'apply' siembra solo el baseline estructural (organizacion, RBAC y");
  console.log("catalogo de procesos); las plantillas y los datos de ejecucion se omiten porque");
  console.log("las plantillas se crean desde la UI. Usa --full para sembrar el snapshot completo.");
  console.log("");
  console.log("Ejemplos:");
  console.log("  node backend/scripts/seed_pucese.mjs                 # baseline estructural");
  console.log("  node backend/scripts/seed_pucese.mjs apply --full    # snapshot completo (demo)");
  console.log("  node backend/scripts/seed_pucese.mjs apply --file backend/scripts/seeds/pucese.seed.json");
  console.log("  node backend/scripts/seed_pucese.mjs capture");
};

// Tablas excluidas del baseline estructural: contenido de plantillas (hoy se autora desde la
// UI, ver editor web Fase C) y todo el rastro de ejecucion (se genera al lanzar procesos).
// 'apply' por defecto vacia estas tablas pero NO inserta sus filas; con --full se siembran.
// Las kept (org, RBAC, processes/series/versions/triggers/rules, terms, catalogos) son
// FK-consistentes sin estas: la ejecucion depende de la estructura, no al reves.
const BASELINE_EXCLUDED_TABLES = new Set([
  // Plantillas (se crean/vinculan desde la UI)
  "template_artifacts",
  "template_seeds",
  "process_definition_templates",
  "fill_flow_templates",
  "fill_flow_steps",
  "signature_flow_templates",
  "signature_flow_steps",
  // Ejecucion (se materializa al lanzar procesos/tareas)
  "process_runs",
  "tasks",
  "task_assignments",
  "task_items",
  "documents",
  "document_versions",
  "document_fill_flows",
  "fill_requests",
  "signature_flow_instances",
  "signature_requests",
  "document_signatures"
]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  let mode = "apply";
  let startIndex = 0;
  if (args[0] && !args[0].startsWith("--")) {
    mode = args[0];
    startIndex = 1;
  }
  let file = defaultSeedFile;
  let includeAll = false;

  for (let i = startIndex; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--file") {
      const next = args[i + 1];
      if (!next) throw new Error("Falta el valor para --file.");
      file = path.isAbsolute(next) ? next : path.join(projectRoot, next);
      i += 1;
      continue;
    }
    if (arg === "--full") {
      includeAll = true;
      continue;
    }
    if (arg === "--baseline") {
      includeAll = false;
      continue;
    }
    throw new Error(`Parametro no soportado: ${arg}`);
  }

  if (!["capture", "apply"].includes(mode)) throw new Error(`Modo no soportado: ${mode}`);
  return { mode, file, includeAll };
};

const loadEnv = async () => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!process.env[key]) process.env[key] = value;
    });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    console.warn(`No se pudo leer ${envPath}: ${formatError(error)}`);
  }
};

const baseType = (mysqlType = "") => mysqlType.toLowerCase().split("(")[0];

const SEED_TABLE_ORDER = [
  "persons",
  "unit_types",
  "relation_unit_types",
  "units",
  "unit_relations",
  "cargos",
  "roles",
  "resources",
  "actions",
  "permissions",
  "role_permissions",
  "role_assignments",
  "role_assignment_relation_types",
  "cargo_role_map",
  "unit_positions",
  "position_assignments",
  "processes",
  "process_definition_series",
  "process_definition_versions",
  "process_definition_period_types",
  "process_target_rules",
  "term_types",
  "terms",
  "template_artifacts",
  "process_definition_templates",
  "tasks",
  "task_items",
  "task_assignments",
  "documents",
  "document_versions",
  "signature_types",
  "signature_statuses",
  "signature_request_statuses",
  "signature_flow_templates",
  "signature_flow_steps",
  "signature_flow_instances",
  "signature_requests",
  "document_signatures",
  "vacancies",
  "vacancy_visibility",
  "aplications",
  "offers",
  "contracts",
  "contract_origins",
  "contract_origin_recruitment",
  "contract_origin_renewal"
];

const getTableOrder = (tableNames) => {
  const seedOrderMap = new Map(SEED_TABLE_ORDER.map((table, idx) => [table, idx]));
  const configOrderMap = new Map(SQL_TABLES.map((table, idx) => [table.table, idx]));
  return [...tableNames].sort((a, b) => {
    const aIdx = seedOrderMap.has(a)
      ? seedOrderMap.get(a)
      : seedOrderMap.size + (configOrderMap.has(a) ? configOrderMap.get(a) : Number.MAX_SAFE_INTEGER / 4);
    const bIdx = seedOrderMap.has(b)
      ? seedOrderMap.get(b)
      : seedOrderMap.size + (configOrderMap.has(b) ? configOrderMap.get(b) : Number.MAX_SAFE_INTEGER / 4);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.localeCompare(b);
  });
};

const isNumericType = (type) =>
  ["int", "integer", "bigint", "smallint", "mediumint", "tinyint", "decimal", "numeric", "float", "double", "real"].includes(type);

const encodeValue = (value, mysqlType) => {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) return { __seed_type: "buffer", base64: value.toString("base64") };
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) {
    const type = baseType(mysqlType);
    if (type === "date") return value.toISOString().slice(0, 10);
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  return value;
};

const decodeValue = (value, mysqlType) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value.__seed_type === "buffer" && typeof value.base64 === "string") {
    return Buffer.from(value.base64, "base64");
  }
  const type = baseType(mysqlType);
  if (typeof value === "boolean" && type === "tinyint") return value ? 1 : 0;
  if (isNumericType(type) && value === "") return null;
  return value;
};

const getDatabaseTables = async (connection) => {
  const [rows] = await connection.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`
  );
  return rows.map((row) => row.table_name);
};

const getTableColumns = async (connection, tableName) => {
  const [rows] = await connection.query(
    `SELECT column_name AS name, data_type AS mysql_type, is_generated
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ?`,
    [tableName]
  );
  return rows.map((row) => ({
    name: row.name,
    mysql_type: row.mysql_type,
    extra: row.is_generated === "ALWAYS" ? "generated" : "",
    is_generated: row.is_generated === "ALWAYS"
  }));
};

const dedupeUnitRelationsRows = (rows) => {
  const keepByKey = new Map();
  const dropped = [];
  for (const row of rows) {
    const key = `${row?.child_unit_id ?? ""}-${row?.relation_type_id ?? ""}`;
    const current = keepByKey.get(key);
    if (!current) { keepByKey.set(key, row); continue; }
    const currentId = Number(current.id ?? 0);
    const nextId = Number(row.id ?? 0);
    const keepNext = Number.isFinite(nextId) && Number.isFinite(currentId) ? nextId > currentId : false;
    if (keepNext) { dropped.push(current); keepByKey.set(key, row); }
    else { dropped.push(row); }
  }
  return { rows: Array.from(keepByKey.values()), dropped };
};

// ─── Generación de tokens para persons ───────────────────────────────────────

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const generateRawToken = () => {
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  }
  return result;
};

const injectPersonTokens = (tables) => {
  const personsTable = tables.find((t) => t.table === "persons");
  if (!personsTable) return;

  if (!personsTable.columns.includes("token")) {
    personsTable.columns.push("token");
    personsTable.column_types["token"] = "varchar(14)";
  }

  const usedTokens = new Set();

  for (const row of personsTable.rows) {
    if (row.token) {
      usedTokens.add(row.token);
      continue;
    }

    let token;
    let attempts = 0;
    do {
      token = generateRawToken();
      attempts++;
      if (attempts > 1000) throw new Error("No se pudo generar token único para persons en el seed.");
    } while (usedTokens.has(token));

    usedTokens.add(token);
    row.token = token;
  }

  console.log(`✅ Tokens generados para ${personsTable.rows.length} persona(s) en el seed.`);
};

// ─────────────────────────────────────────────────────────────────────────────

const applyForwardCompatibilityDefaults = (tableData, tableMap) => {
  if (!tableData || tableData.table !== "task_items") {
    return;
  }

  const columns = Array.isArray(tableData.columns) ? tableData.columns : [];
  const rows = Array.isArray(tableData.rows) ? tableData.rows : [];
  if (!rows.length || columns.includes("start_date")) {
    return;
  }

  const tasksTable = tableMap.get("tasks");
  const taskRows = Array.isArray(tasksTable?.rows) ? tasksTable.rows : [];
  const tasksById = new Map(taskRows.map((row) => [String(row.id), row]));

  columns.push("start_date");
  tableData.column_types = {
    ...(tableData.column_types || {}),
    start_date: "date"
  };

  if (!columns.includes("end_date")) {
    columns.push("end_date");
    tableData.column_types.end_date = "date";
  }

  for (const row of rows) {
    const task = tasksById.get(String(row.task_id));
    row.start_date = row.start_date || task?.start_date || "2026-01-01";
    row.end_date = row.end_date ?? task?.end_date ?? null;
  }

  console.warn("[seed_pucese] task_items.start_date agregado desde tasks.start_date por compatibilidad de esquema.");
};

// ─────────────────────────────────────────────────────────────────────────────

const captureSeed = async (connection, filePath) => {
  const tables = getTableOrder(await getDatabaseTables(connection));
  const snapshot = {
    seed_name: defaultSeedName,
    source_database: process.env.POSTGRES_DB || "postgres",
    captured_at: new Date().toISOString(),
    tables: []
  };

  for (const tableName of tables) {
    const columns = await getTableColumns(connection, tableName);
    const columnNames = columns.map((col) => col.name);
    const columnTypeMap = Object.fromEntries(columns.map((col) => [col.name, col.mysql_type]));
    const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
    const encodedRows = rows.map((row) => {
      const encoded = {};
      for (const columnName of columnNames) {
        encoded[columnName] = encodeValue(row[columnName], columnTypeMap[columnName]);
      }
      return encoded;
    });
    snapshot.tables.push({ table: tableName, columns: columns.map((col) => col.name), column_types: columnTypeMap, rows: encodedRows });
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Semilla capturada: ${filePath}`);
  console.log(`Tablas: ${snapshot.tables.length}`);
};

const applySeed = async (connection, filePath, { includeAll = false } = {}) => {
  const raw = await readFile(filePath, "utf8");
  const snapshot = JSON.parse(raw);
  const originalTables = Array.isArray(snapshot.tables) ? snapshot.tables : [];

  // Generar tokens para persons antes de insertar
  injectPersonTokens(originalTables);

  const tableMap = new Map(originalTables.map((table) => [table.table, table]));
  originalTables.forEach((tableData) => applyForwardCompatibilityDefaults(tableData, tableMap));
  const orderedTables = getTableOrder(originalTables.map((table) => table.table))
    .map((tableName) => tableMap.get(tableName))
    .filter(Boolean);

  if (!orderedTables.length) throw new Error("La semilla no contiene tablas.");

  const schemaTables = new Set(await getDatabaseTables(connection));
  const missingTables = orderedTables
    .map((tableData) => tableData.table)
    .filter((tableName) => !schemaTables.has(tableName));

  if (missingTables.length) {
    console.warn(
      `[seed_pucese] Se omitiran ${missingTables.length} tabla(s) inexistentes en la base actual: ${missingTables.join(", ")}`
    );
  }

  // Tablas presentes en el seed y en el esquema actual. Siempre se VACIAN todas (para dejar un
  // estado limpio), pero en modo baseline solo se INSERTAN las no excluidas: las plantillas se
  // crean desde la UI y la ejecucion se materializa al lanzar procesos.
  const tables = orderedTables.filter((tableData) => schemaTables.has(tableData.table));
  if (!tables.length) {
    throw new Error("Ninguna tabla de la semilla existe en la base de datos actual.");
  }

  const insertTables = includeAll
    ? tables
    : tables.filter((tableData) => !BASELINE_EXCLUDED_TABLES.has(tableData.table));
  const skippedTables = tables
    .filter((tableData) => !insertTables.includes(tableData))
    .map((tableData) => tableData.table);

  if (!includeAll && skippedTables.length) {
    console.log(
      `[seed_pucese] Modo baseline: se vaciaran pero NO se sembraran ${skippedTables.length} tabla(s) de plantillas/ejecucion: ${skippedTables.join(", ")}`
    );
    console.log("[seed_pucese] Usa --full para sembrar el snapshot completo (demo).");
  }

  await connection.beginTransaction();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (let i = tables.length - 1; i >= 0; i -= 1) {
      const tableName = tables[i].table;
      await connection.query(`DELETE FROM \`${tableName}\``);
    }

    for (const tableData of insertTables) {
      const tableName = tableData.table;
      const columns = Array.isArray(tableData.columns) ? tableData.columns : [];
      let rows = Array.isArray(tableData.rows) ? tableData.rows : [];
      const columnTypes = tableData.column_types || {};
      if (!columns.length || !rows.length) continue;

      if (tableName === "unit_relations") {
        const deduped = dedupeUnitRelationsRows(rows);
        rows = deduped.rows;
        if (deduped.dropped.length) {
          console.warn(`[seed_pucese] unit_relations: ${deduped.dropped.length} fila(s) descartadas por duplicar (child_unit_id, relation_type_id).`);
        }
      }

      const schemaColumns = await getTableColumns(connection, tableName);
      const schemaColumnMap = new Map(schemaColumns.map((column) => [column.name, column]));
      const generatedColumnSet = new Set(
        schemaColumns.filter((column) => column.is_generated).map((column) => column.name)
      );
      const missingColumns = columns.filter((column) => !schemaColumnMap.has(column));
      if (missingColumns.length) {
        console.warn(
          `[seed_pucese] ${tableName}: ${missingColumns.length} columna(s) omitida(s) por no existir en el esquema actual: ${missingColumns.join(", ")}`
        );
      }
      const insertColumns = columns.filter(
        (column) => schemaColumnMap.has(column) && !generatedColumnSet.has(column)
      );
      if (!insertColumns.length) continue;

      const escapedColumns = insertColumns.map((column) => `\`${column}\``).join(", ");
      const placeholders = insertColumns.map(() => "?").join(", ");
      const sql = `INSERT INTO \`${tableName}\` (${escapedColumns}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = insertColumns.map((column) => decodeValue(row[column], columnTypes[column]));
        await connection.query(sql, values);
      }
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();

    // PG: insertar ids explícitos en columnas IDENTITY NO avanza la secuencia,
    // así que el primer INSERT del app colisionaría (PK duplicada). Se
    // resincroniza cada secuencia a max(id). (En MySQL AUTO_INCREMENT se ajusta
    // solo.) Se ejecuta por el cliente crudo (bloque plpgsql, sin traducción).
    if (connection._client) {
      await connection._client.query(
        `DO $$
         DECLARE r record;
         BEGIN
           FOR r IN
             SELECT table_name FROM information_schema.columns
              WHERE table_schema = current_schema() AND column_name = 'id' AND is_identity = 'YES'
           LOOP
             EXECUTE format(
               'SELECT setval(pg_get_serial_sequence(%L, %L), GREATEST((SELECT COALESCE(max(id), 0) FROM %I), 1))',
               r.table_name, 'id', r.table_name
             );
           END LOOP;
         END $$;`
      );
    }

    console.log(`Semilla aplicada (${includeAll ? "completa" : "baseline estructural"}): ${filePath}`);
    console.log(`Tablas vaciadas: ${tables.length} | sembradas: ${insertTables.length}`);
    if (missingTables.length) {
      console.log(`Tablas omitidas (inexistentes en el esquema): ${missingTables.length}`);
    }
  } catch (error) {
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (restoreError) {
      console.warn(`No se pudo restaurar FOREIGN_KEY_CHECKS: ${formatError(restoreError)}`);
    }
    await connection.rollback();
    throw error;
  }
};

const run = async () => {
  let args;
  try {
    args = parseArgs();
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(1);
    return;
  }

  await loadEnv();
  // Conexión del adaptador pg (espeja la interfaz mysql2: query->[rows],
  // beginTransaction/commit/rollback).
  const connection = await getPostgresPool().getConnection();

  try {
    if (args.mode === "capture") {
      await captureSeed(connection, args.file);
      return;
    }
    await applySeed(connection, args.file, { includeAll: args.includeAll });
  } finally {
    connection.release();
  }
};

run().catch((error) => {
  console.error(`Error en seed_pucese: ${formatError(error)}`);
  process.exit(1);
});
