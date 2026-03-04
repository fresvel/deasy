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
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value;
  }
  return env;
};

const hasColumn = async (connection, tableName, columnName) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
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

  let normalizedGroups = 0;
  let retiredRows = 0;

  try {
    await connection.beginTransaction();

    if (!(await hasColumn(connection, "process_definition_versions", "active_series_flag"))) {
      await connection.query(
        `ALTER TABLE process_definition_versions
         ADD COLUMN active_series_flag TINYINT(1)
         AS (IF(status = 'active', 1, NULL)) PERSISTENT
         AFTER status`
      );
    }

    const [conflictingGroups] = await connection.query(
      `SELECT process_id, variation_key, COUNT(*) AS active_count
       FROM process_definition_versions
       WHERE status = 'active'
       GROUP BY process_id, variation_key
       HAVING COUNT(*) > 1`
    );

    for (const group of conflictingGroups) {
      const [rows] = await connection.query(
        `SELECT id
         FROM process_definition_versions
         WHERE process_id = ?
           AND variation_key = ?
           AND status = 'active'
         ORDER BY effective_from DESC, created_at DESC, id DESC`,
        [group.process_id, group.variation_key]
      );

      const keep = rows[0];
      const retire = rows.slice(1);
      for (const row of retire) {
        await connection.query(
          `UPDATE process_definition_versions
           SET status = 'retired',
               effective_to = COALESCE(effective_to, CURDATE())
           WHERE id = ?`,
          [row.id]
        );
        retiredRows += 1;
      }

      if (keep && retire.length) {
        normalizedGroups += 1;
      }
    }

    if (!(await hasIndex(connection, "process_definition_versions", "uq_process_definition_one_active_series"))) {
      await connection.query(
        `ALTER TABLE process_definition_versions
         ADD UNIQUE KEY uq_process_definition_one_active_series
         (process_id, variation_key, active_series_flag)`
      );
    }

    await connection.commit();
    console.log(JSON.stringify({
      normalizedGroups,
      retiredRows,
      uniqueIndex: "uq_process_definition_one_active_series"
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
