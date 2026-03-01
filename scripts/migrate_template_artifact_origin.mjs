#!/usr/bin/env node
import fs from "fs";
import path from "path";
import mysql from "../backend/node_modules/mysql2/promise.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(REPO_ROOT, "backend", ".env");

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
    env[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }
  return env;
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

const main = async () => {
  const fileEnv = parseEnvFile(ENV_PATH);
  const connection = await mysql.createConnection({
    host: process.env.MARIADB_HOST || fileEnv.MARIADB_HOST || "localhost",
    port: Number(process.env.MARIADB_PORT || fileEnv.MARIADB_PORT || 3306),
    user: process.env.MARIADB_USER || fileEnv.MARIADB_USER || "deasy",
    password: process.env.MARIADB_PASSWORD || fileEnv.MARIADB_PASSWORD || "",
    database: process.env.MARIADB_DATABASE || fileEnv.MARIADB_DATABASE || "deasy",
    timezone: "Z"
  });

  try {
    const columns = await getColumns(connection, "template_artifacts");
    const added = [];

    if (!columns.has("artifact_origin")) {
      await connection.query(
        "ALTER TABLE template_artifacts ADD COLUMN artifact_origin ENUM('system','user') NOT NULL DEFAULT 'system' AFTER storage_version"
      );
      added.push("artifact_origin");
    }

    if (!(await hasIndex(connection, "template_artifacts", "idx_template_artifacts_origin"))) {
      await connection.query(
        "ALTER TABLE template_artifacts ADD INDEX idx_template_artifacts_origin (artifact_origin)"
      );
    }

    const [result] = await connection.query(
      `UPDATE template_artifacts
       SET artifact_origin = CASE
         WHEN COALESCE(owner_ref, '') <> '' THEN 'user'
         WHEN artifact_stage = 'draft' THEN 'user'
         ELSE 'system'
       END`
    );

    console.log(JSON.stringify({
      migrated: true,
      added,
      updated: result.affectedRows || 0
    }, null, 2));
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
