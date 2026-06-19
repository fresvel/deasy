import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));
const mysql = backendRequire("mysql2/promise");

const envPath = path.join(backendRoot, ".env");

const loadEnv = async () => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const [key, ...rest] = trimmed.split("=");
      if (!key || process.env[key]) {
        return;
      }
      process.env[key] = rest.join("=").trim();
    });
  } catch (error) {
    console.warn(`No se pudo leer ${envPath}: ${error.message}`);
  }
};

const getConfig = () => {
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

// Elimina la columna process_definition_templates.creates_task. El modelo asume que toda plantilla vinculada
// materializa un entregable, así que la columna era un flag constante (siempre 1). Idempotente: si ya no
// existe, no hace nada. Antes de borrar, avisa si hubiera filas en 0 (que dejarían de "no materializar").
const main = async () => {
  await loadEnv();
  const connection = await mysql.createConnection(getConfig());
  try {
    const [colRows] = await connection.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'process_definition_templates' AND COLUMN_NAME = 'creates_task'`,
      [process.env.MARIADB_DATABASE]
    );
    if (!Number(colRows?.[0]?.c)) {
      console.log("ℹ️  La columna 'creates_task' ya no existe; nada que hacer.");
      return;
    }

    const [zeroRows] = await connection.query(
      "SELECT COUNT(*) AS c FROM process_definition_templates WHERE creates_task = 0 OR creates_task IS NULL"
    );
    const zeroCount = Number(zeroRows?.[0]?.c || 0);
    if (zeroCount > 0) {
      console.warn(
        `⚠️  ${zeroCount} vínculo(s) tenían creates_task=0/NULL. Tras la migración TODA plantilla vinculada ` +
        "materializa un entregable, así que esos vínculos pasarán a generar entregable."
      );
    }

    await connection.query(
      "ALTER TABLE process_definition_templates DROP COLUMN creates_task"
    );
    console.log("✅ Columna 'process_definition_templates.creates_task' eliminada.");
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo eliminar la columna creates_task: ${error.message}`);
  process.exitCode = 1;
});
