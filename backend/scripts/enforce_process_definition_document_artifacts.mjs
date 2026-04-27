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
    timezone: "Z",
    multipleStatements: true
  });

  try {
    await connection.query(`
      DROP TRIGGER IF EXISTS trg_process_definition_versions_before_update;
      CREATE TRIGGER trg_process_definition_versions_before_update
      BEFORE UPDATE ON process_definition_versions
      FOR EACH ROW
      BEGIN
        DECLARE linked_template_count INT DEFAULT 0;
        DECLARE active_rule_count INT DEFAULT 0;
        DECLARE active_trigger_count INT DEFAULT 0;

        IF NEW.status = 'active' AND OLD.status <> 'active' THEN
          SELECT COUNT(*)
            INTO active_rule_count
          FROM process_target_rules
          WHERE process_definition_id = NEW.id
            AND is_active = 1;

          IF active_rule_count < 1 THEN
            SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'No se puede activar una definicion si no tiene al menos una regla activa en Reglas de alcance.';
          END IF;
        END IF;

        IF NEW.status = 'active' AND OLD.status <> 'active' THEN
          SELECT COUNT(*)
            INTO active_trigger_count
          FROM process_definition_triggers
          WHERE process_definition_id = NEW.id
            AND is_active = 1;

          IF active_trigger_count < 1 THEN
            SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'No se puede activar una definicion si no tiene al menos un disparador activo en Disparadores de definiciones.';
          END IF;
        END IF;

        IF NEW.status = 'active' AND OLD.status <> 'active' AND NEW.has_document = 1 THEN
          SELECT COUNT(*)
            INTO linked_template_count
          FROM process_definition_templates
          WHERE process_definition_id = NEW.id;

          IF linked_template_count < 1 THEN
            SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'No se puede activar una definicion con documento si no tiene al menos un artifact vinculado en Plantillas de definicion.';
          END IF;
        END IF;
      END;
    `);

    console.log(JSON.stringify({
      trigger: "trg_process_definition_versions_before_update",
      enforced: true
    }));
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
