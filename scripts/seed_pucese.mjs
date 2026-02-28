import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SQL_TABLES } from "../backend/config/sqlTables.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const mysql = require(path.join(repoRoot, "backend", "node_modules", "mysql2", "promise"));

const envPath = path.join(repoRoot, "backend", ".env");
const defaultSeedName = "pucese";
const defaultSeedFile = path.join(__dirname, "seeds", `${defaultSeedName}.seed.json`);

const formatError = (error) => {
  if (!error) {
    return "Error desconocido.";
  }

  const parts = [];
  if (typeof error.message === "string" && error.message.trim()) {
    parts.push(error.message.trim());
  }
  if (error.code) {
    parts.push(`code=${error.code}`);
  }
  if (error.errno !== undefined && error.errno !== null) {
    parts.push(`errno=${error.errno}`);
  }
  if (error.sqlState) {
    parts.push(`sqlState=${error.sqlState}`);
  }
  if (!parts.length) {
    return String(error);
  }
  return parts.join(" | ");
};

const usage = () => {
  console.log("Uso:");
  console.log("  node scripts/seed_pucese.mjs [apply] [--file <ruta>]");
  console.log("  node scripts/seed_pucese.mjs capture [--file <ruta>]");
  console.log("");
  console.log("Ejemplos:");
  console.log("  node scripts/seed_pucese.mjs");
  console.log("  node scripts/seed_pucese.mjs apply --file scripts/seeds/pucese.seed.json");
  console.log("  node scripts/seed_pucese.mjs capture");
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  let mode = "apply";
  let startIndex = 0;
  if (args[0] && !args[0].startsWith("--")) {
    mode = args[0];
    startIndex = 1;
  }
  let file = defaultSeedFile;

  for (let i = startIndex; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--file") {
      const next = args[i + 1];
      if (!next) {
        throw new Error("Falta el valor para --file.");
      }
      file = path.isAbsolute(next) ? next : path.join(repoRoot, next);
      i += 1;
      continue;
    }
    throw new Error(`Parametro no soportado: ${arg}`);
  }

  if (!["capture", "apply"].includes(mode)) {
    throw new Error(`Modo no soportado: ${mode}`);
  }

  return { mode, file };
};

const loadEnv = async () => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn(`No se pudo leer ${envPath}: ${formatError(error)}`);
  }
};

const ensureConfig = () => {
  const required = [
    "MARIADB_HOST",
    "MARIADB_PORT",
    "MARIADB_USER",
    "MARIADB_PASSWORD",
    "MARIADB_DATABASE"
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Configuracion MariaDB incompleta. Faltan: ${missing.join(", ")}`);
  }

  return {
    host: process.env.MARIADB_HOST,
    port: Number(process.env.MARIADB_PORT),
    user: process.env.MARIADB_USER,
    password: process.env.MARIADB_PASSWORD,
    database: process.env.MARIADB_DATABASE,
    timezone: process.env.MARIADB_TIMEZONE || "Z"
  };
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
  "process_definition_versions",
  "process_target_rules",
  "term_types",
  "terms",
  "template_artifacts",
  "process_definition_templates",
  "tasks",
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
    if (aIdx !== bIdx) {
      return aIdx - bIdx;
    }
    return a.localeCompare(b);
  });
};

const isNumericType = (type) =>
  [
    "int",
    "integer",
    "bigint",
    "smallint",
    "mediumint",
    "tinyint",
    "decimal",
    "numeric",
    "float",
    "double",
    "real"
  ].includes(type);

const encodeValue = (value, mysqlType) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    return {
      __seed_type: "buffer",
      base64: value.toString("base64")
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    const type = baseType(mysqlType);
    if (type === "date") {
      return value.toISOString().slice(0, 10);
    }
    return value.toISOString().slice(0, 19).replace("T", " ");
  }

  return value;
};

const decodeValue = (value, mysqlType) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "object"
    && value.__seed_type === "buffer"
    && typeof value.base64 === "string"
  ) {
    return Buffer.from(value.base64, "base64");
  }

  const type = baseType(mysqlType);
  if (typeof value === "boolean" && type === "tinyint") {
    return value ? 1 : 0;
  }

  if (isNumericType(type) && value === "") {
    return null;
  }

  return value;
};

const getDatabaseTables = async (connection, databaseName) => {
  const [rows] = await connection.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
    [databaseName]
  );
  return rows.map((row) => row.table_name);
};

const getTableColumns = async (connection, tableName) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((row) => ({
    name: row.Field,
    mysql_type: row.Type,
    extra: row.Extra,
    is_generated: /generated/i.test(String(row.Extra || ""))
  }));
};

const dedupeUnitRelationsRows = (rows) => {
  const keepByKey = new Map();
  const dropped = [];

  for (const row of rows) {
    const key = `${row?.child_unit_id ?? ""}-${row?.relation_type_id ?? ""}`;
    const current = keepByKey.get(key);
    if (!current) {
      keepByKey.set(key, row);
      continue;
    }

    const currentId = Number(current.id ?? 0);
    const nextId = Number(row.id ?? 0);
    const keepNext = Number.isFinite(nextId) && Number.isFinite(currentId)
      ? nextId > currentId
      : false;

    if (keepNext) {
      dropped.push(current);
      keepByKey.set(key, row);
    } else {
      dropped.push(row);
    }
  }

  return {
    rows: Array.from(keepByKey.values()),
    dropped
  };
};

const captureSeed = async (connection, config, filePath) => {
  const tables = getTableOrder(await getDatabaseTables(connection, config.database));
  const snapshot = {
    seed_name: defaultSeedName,
    source_database: config.database,
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

    snapshot.tables.push({
      table: tableName,
      columns: columns.map((col) => col.name),
      column_types: columnTypeMap,
      rows: encodedRows
    });
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Semilla capturada: ${filePath}`);
  console.log(`Tablas: ${snapshot.tables.length}`);
};

const applySeed = async (connection, filePath) => {
  const raw = await readFile(filePath, "utf8");
  const snapshot = JSON.parse(raw);
  const originalTables = Array.isArray(snapshot.tables) ? snapshot.tables : [];
  const tableMap = new Map(originalTables.map((table) => [table.table, table]));
  const tables = getTableOrder(originalTables.map((table) => table.table))
    .map((tableName) => tableMap.get(tableName))
    .filter(Boolean);
  if (!tables.length) {
    throw new Error("La semilla no contiene tablas.");
  }

  await connection.beginTransaction();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (let i = tables.length - 1; i >= 0; i -= 1) {
      const tableName = tables[i].table;
      await connection.query(`DELETE FROM \`${tableName}\``);
    }

    for (const tableData of tables) {
      const tableName = tableData.table;
      const columns = Array.isArray(tableData.columns) ? tableData.columns : [];
      let rows = Array.isArray(tableData.rows) ? tableData.rows : [];
      const columnTypes = tableData.column_types || {};
      if (!columns.length || !rows.length) {
        continue;
      }

      if (tableName === "unit_relations") {
        const deduped = dedupeUnitRelationsRows(rows);
        rows = deduped.rows;
        if (deduped.dropped.length) {
          console.warn(
            `[seed_pucese] unit_relations: ${deduped.dropped.length} fila(s) descartadas por duplicar (child_unit_id, relation_type_id).`
          );
        }
      }

      const schemaColumns = await getTableColumns(connection, tableName);
      const generatedColumnSet = new Set(
        schemaColumns
          .filter((column) => column.is_generated)
          .map((column) => column.name)
      );
      const insertColumns = columns.filter((column) => !generatedColumnSet.has(column));
      if (!insertColumns.length) {
        continue;
      }

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
    console.log(`Semilla aplicada: ${filePath}`);
    console.log(`Tablas procesadas: ${tables.length}`);
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
  const config = ensureConfig();
  const connection = await mysql.createConnection(config);

  try {
    if (args.mode === "capture") {
      await captureSeed(connection, config, args.file);
      return;
    }
    await applySeed(connection, args.file);
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error(`Error en seed_pucese: ${formatError(error)}`);
  process.exit(1);
});
