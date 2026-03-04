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

const getColumnNames = async (connection) => {
  const [rows] = await connection.query("SHOW COLUMNS FROM template_artifacts");
  return new Set(rows.map((row) => row.Field));
};

const hasIndex = async (connection, indexName) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'template_artifacts'
       AND index_name = ?
     LIMIT 1`,
    [indexName]
  );
  return rows.length > 0;
};

const buildAvailableFormats = (rows) => {
  const availableFormats = {};
  for (const row of rows) {
    if (row.mode && row.format && row.entry_object_key) {
      if (!availableFormats[row.mode]) {
        availableFormats[row.mode] = {};
      }
      availableFormats[row.mode][row.format] = {
        entry_object_key: row.entry_object_key
      };
      continue;
    }

    if (!row.available_formats) {
      continue;
    }

    let parsed = row.available_formats;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        parsed = null;
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }
    for (const [mode, formats] of Object.entries(parsed)) {
      if (!formats || typeof formats !== "object" || Array.isArray(formats)) {
        continue;
      }
      if (!availableFormats[mode]) {
        availableFormats[mode] = {};
      }
      for (const [format, metadata] of Object.entries(formats)) {
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
          continue;
        }
        availableFormats[mode][format] = metadata;
      }
    }
  }
  return availableFormats;
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

  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  let relinked = 0;

  try {
    const columnsBefore = await getColumnNames(connection);
    if (!columnsBefore.has("available_formats")) {
      await connection.query("ALTER TABLE template_artifacts ADD COLUMN available_formats JSON NULL AFTER base_object_prefix");
    }

    const [rows] = await connection.query(
      `SELECT *
       FROM template_artifacts
       ORDER BY template_code, storage_version, id`
    );

    const groups = new Map();
    for (const row of rows) {
      const groupKey = `${row.template_code}::${row.storage_version}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(row);
    }

    await connection.beginTransaction();

    for (const groupRows of groups.values()) {
      const canonical = groupRows[0];
      const availableFormats = buildAvailableFormats(groupRows);
      const serialized = JSON.stringify(availableFormats);

      await connection.query(
        `UPDATE template_artifacts
         SET display_name = ?,
             source_version = ?,
             bucket = ?,
             base_object_prefix = ?,
             schema_object_key = ?,
             meta_object_key = ?,
             content_hash = ?,
             is_active = ?,
             available_formats = ?
         WHERE id = ?`,
        [
          canonical.display_name,
          canonical.source_version,
          canonical.bucket,
          canonical.base_object_prefix,
          canonical.schema_object_key,
          canonical.meta_object_key,
          canonical.content_hash,
          canonical.is_active,
          serialized,
          canonical.id
        ]
      );
      updated += 1;

      for (const duplicate of groupRows.slice(1)) {
        const [bindings] = await connection.query(
          `SELECT id
           FROM process_definition_templates
           WHERE template_artifact_id = ?`,
          [duplicate.id]
        );

        for (const binding of bindings) {
          try {
            await connection.query(
              `UPDATE process_definition_templates
               SET template_artifact_id = ?
               WHERE id = ?`,
              [canonical.id, binding.id]
            );
            relinked += 1;
          } catch (error) {
            if (error?.code === "ER_DUP_ENTRY") {
              await connection.query(
                `DELETE FROM process_definition_templates
                 WHERE id = ?`,
                [binding.id]
              );
              deleted += 1;
              continue;
            }
            throw error;
          }
        }

        await connection.query(
          `DELETE FROM template_artifacts
           WHERE id = ?`,
          [duplicate.id]
        );
        deleted += 1;
      }
    }

    const columnsAfterMerge = await getColumnNames(connection);
    if (await hasIndex(connection, "uq_template_artifacts_storage")) {
      await connection.query("ALTER TABLE template_artifacts DROP INDEX uq_template_artifacts_storage");
    }
    if (columnsAfterMerge.has("mode")) {
      await connection.query("ALTER TABLE template_artifacts DROP COLUMN mode");
    }
    if (columnsAfterMerge.has("format")) {
      await connection.query("ALTER TABLE template_artifacts DROP COLUMN format");
    }
    if (columnsAfterMerge.has("entry_object_key")) {
      await connection.query("ALTER TABLE template_artifacts DROP COLUMN entry_object_key");
    }

    await connection.query(
      `UPDATE template_artifacts
       SET available_formats = JSON_OBJECT()
       WHERE available_formats IS NULL`
    );

    await connection.query(
      `ALTER TABLE template_artifacts
       MODIFY COLUMN available_formats JSON NOT NULL`
    );
    await connection.query(
      `ALTER TABLE template_artifacts
       ADD UNIQUE KEY uq_template_artifacts_storage (template_code, storage_version)`
    );

    await connection.commit();

    console.log(JSON.stringify({
      groups: groups.size,
      updated,
      deleted,
      relinked,
      inserted
    }));
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // no-op
    }
    throw error;
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
