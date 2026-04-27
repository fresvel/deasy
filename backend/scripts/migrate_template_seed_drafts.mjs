#!/usr/bin/env node
import fs from "fs";
import { createRequire } from "node:module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const mysql = require(path.join(BACKEND_ROOT, "package.json"))("mysql2/promise");
const ENV_PATH = path.join(BACKEND_ROOT, ".env");

const parseEnvFile = (filePath) => {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }
  return env;
};

const hasTable = async (connection, tableName) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
};

const getColumns = async (connection, tableName) => {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
};

const hasIndex = async (connection, tableName, indexName) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
};

const hasForeignKey = async (connection, tableName, constraintName) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.table_constraints
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND constraint_type = 'FOREIGN KEY'
       AND constraint_name = ?
     LIMIT 1`,
    [tableName, constraintName]
  );
  return rows.length > 0;
};

const main = async () => {
  const fileEnv = parseEnvFile(ENV_PATH);
  const env = {
    MARIADB_HOST: process.env.MARIADB_HOST || fileEnv.MARIADB_HOST || "localhost",
    MARIADB_PORT: Number(process.env.MARIADB_PORT || fileEnv.MARIADB_PORT || 3306),
    MARIADB_USER: process.env.MARIADB_USER || fileEnv.MARIADB_USER || "deasy",
    MARIADB_PASSWORD: process.env.MARIADB_PASSWORD || fileEnv.MARIADB_PASSWORD || "",
    MARIADB_DATABASE: process.env.MARIADB_DATABASE || fileEnv.MARIADB_DATABASE || "deasy"
  };

  const connection = await mysql.createConnection({
    host: env.MARIADB_HOST,
    port: env.MARIADB_PORT,
    user: env.MARIADB_USER,
    password: env.MARIADB_PASSWORD,
    database: env.MARIADB_DATABASE,
    timezone: "Z"
  });

  try {
    await connection.beginTransaction();

    await connection.query(`
      CREATE TABLE IF NOT EXISTS template_seeds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seed_code VARCHAR(180) NOT NULL,
        display_name VARCHAR(180) NOT NULL,
        description VARCHAR(255) NULL,
        seed_type VARCHAR(40) NOT NULL,
        source_path VARCHAR(255) NOT NULL,
        preview_path VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_template_seeds_code (seed_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    if (!(await hasTable(connection, "template_artifacts"))) {
      throw new Error("La tabla template_artifacts no existe. Ejecuta primero el esquema base.");
    }

    const columns = await getColumns(connection, "template_artifacts");
    if (!columns.has("template_seed_id")) {
      await connection.query("ALTER TABLE template_artifacts ADD COLUMN template_seed_id INT NULL AFTER id");
    }
    if (!columns.has("description")) {
      await connection.query("ALTER TABLE template_artifacts ADD COLUMN description VARCHAR(255) NULL AFTER display_name");
    }
    if (!columns.has("owner_ref")) {
      await connection.query("ALTER TABLE template_artifacts ADD COLUMN owner_ref VARCHAR(180) NULL AFTER description");
    }
    if (!columns.has("artifact_origin")) {
      await connection.query("ALTER TABLE template_artifacts ADD COLUMN artifact_origin ENUM('system','user') NOT NULL DEFAULT 'system' AFTER storage_version");
    }
    if (!columns.has("artifact_stage")) {
      await connection.query("ALTER TABLE template_artifacts ADD COLUMN artifact_stage ENUM('draft','published') NOT NULL DEFAULT 'published' AFTER storage_version");
    }

    if (!(await hasIndex(connection, "template_artifacts", "idx_template_artifacts_seed"))) {
      await connection.query("ALTER TABLE template_artifacts ADD INDEX idx_template_artifacts_seed (template_seed_id)");
    }
    if (!(await hasIndex(connection, "template_artifacts", "idx_template_artifacts_origin"))) {
      await connection.query("ALTER TABLE template_artifacts ADD INDEX idx_template_artifacts_origin (artifact_origin)");
    }
    if (!(await hasIndex(connection, "template_artifacts", "idx_template_artifacts_stage"))) {
      await connection.query("ALTER TABLE template_artifacts ADD INDEX idx_template_artifacts_stage (artifact_stage)");
    }
    if (!(await hasForeignKey(connection, "template_artifacts", "fk_template_artifacts_seed"))) {
      await connection.query(`
        ALTER TABLE template_artifacts
        ADD CONSTRAINT fk_template_artifacts_seed
        FOREIGN KEY (template_seed_id) REFERENCES template_seeds(id)
      `);
    }

    await connection.query(`
      UPDATE template_artifacts
      SET artifact_origin = CASE
            WHEN COALESCE(owner_ref, '') <> '' THEN 'user'
            ELSE COALESCE(artifact_origin, 'system')
          END,
          artifact_stage = COALESCE(artifact_stage, 'published')
    `);

    await connection.commit();
    console.log(JSON.stringify({
      migrated: true,
      table: "template_artifacts",
      added: ["template_seed_id", "description", "owner_ref", "artifact_origin", "artifact_stage"],
      createdTables: ["template_seeds"]
    }));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
