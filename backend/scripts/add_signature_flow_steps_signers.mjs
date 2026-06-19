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
  const required = ["MARIADB_HOST", "MARIADB_PORT", "MARIADB_USER", "MARIADB_PASSWORD", "MARIADB_DATABASE"];
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

// Añade signature_flow_steps.signers (JSON) para el modelo multi-firmante. Idempotente: si ya existe, no hace
// nada. Los pasos legacy (signers NULL) siguen funcionando vía las columnas de resolutor del propio paso.
const main = async () => {
  await loadEnv();
  const connection = await mysql.createConnection(getConfig());
  try {
    const [cols] = await connection.query(
      `SELECT COUNT(*) AS c
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'signature_flow_steps' AND COLUMN_NAME = 'signers'`,
      [process.env.MARIADB_DATABASE]
    );
    if (Number(cols?.[0]?.c)) {
      console.log("ℹ️  La columna 'signers' ya existe; nada que hacer.");
      return;
    }
    await connection.query(
      "ALTER TABLE signature_flow_steps ADD COLUMN signers JSON NULL AFTER anchor_refs"
    );
    console.log("✅ Columna 'signature_flow_steps.signers' añadida.");
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo añadir la columna signers: ${error.message}`);
  process.exitCode = 1;
});
