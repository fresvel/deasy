import mysql from "mysql2/promise";
import fs from "fs/promises";
import {
  getMariaDBPool,
  getMariaDBDatabaseName,
  getMariaDBBaseConfig
} from "../config/mariadb.js";

const ensureDatabaseSQL = (databaseName) =>
  `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

const SCHEMA_FILE_URL = new URL("./mariadb_schema.sql", import.meta.url);

const splitSqlStatements = (sql) => {
  const statements = [];
  let delimiter = ";";
  let buffer = "";

  for (const rawLine of sql.split("\n")) {
    const line = rawLine;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("--")) {
      continue;
    }

    const delimiterMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += line + "\n";

    let idx = buffer.indexOf(delimiter);
    while (idx !== -1) {
      const statement = buffer.slice(0, idx).trim();
      if (statement) {
        statements.push(statement);
      }
      buffer = buffer.slice(idx + delimiter.length);
      idx = buffer.indexOf(delimiter);
    }
  }

  const tail = buffer.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
};

export const ensureMariaDBDatabase = async () => {
  const baseConfig = getMariaDBBaseConfig();
  const databaseName = getMariaDBDatabaseName();

  if (!baseConfig.host || !databaseName) {
    console.warn("⚠️  Saltando creación de base de datos MariaDB por configuración incompleta.");
    return;
  }

  const connection = await mysql.createConnection(baseConfig);
  try {
    await connection.query(ensureDatabaseSQL(databaseName));
    console.log(`✅ Base de datos '${databaseName}' verificada/creada en MariaDB`);
  } finally {
    await connection.end();
  }
};

const DROP_TABLES = [
  "document_signatures",
  "signature_requests",
  "signature_flow_instances",
  "signature_flow_steps",
  "signature_flow_templates",
  "signature_types",
  "signature_statuses",
  "signature_request_statuses",
  "document_versions",
  "documents",
  "process_definition_templates",
  "template_artifacts",
  "task_assignments",
  "tasks",
  "terms",
  "term_types",
  "process_target_rules",
  "process_definition_versions",
  "processes",
  "contract_origin_recruitment",
  "contract_origin_renewal",
  "contract_origins",
  "offers",
  "aplications",
  "contracts",
  "vacancy_visibility",
  "vacancies",
  "position_assignments",
  "unit_positions",
  "cargo_role_map",
  "role_assignment_relation_types",
  "role_assignments",
  "role_permissions",
  "permissions",
  "actions",
  "resources",
  "roles",
  "cargos",
  "unit_relations",
  "relation_unit_types",
  "units",
  "unit_types",
  "persons"
];

export const ensureMariaDBSchema = async ({ reset = false } = {}) => {
  const pool = getMariaDBPool();

  if (!pool) {
    console.warn(
      "⚠️  Saltando inicialización MariaDB: no hay conexión configurada."
    );
    return;
  }

  const connection = await pool.getConnection();
  try {
    if (reset) {
      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const table of DROP_TABLES) {
        await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    const schemaSQL = await fs.readFile(SCHEMA_FILE_URL, "utf8");
    const statements = splitSqlStatements(schemaSQL);

    for (const statement of statements) {
      await connection.query(statement);
    }

    if (reset) {
      console.log("✅ Esquema MariaDB recreado desde mariadb_schema.sql");
    } else {
      console.log("✅ Esquema MariaDB verificado/actualizado sin reset");
    }
  } finally {
    connection.release();
  }
};
