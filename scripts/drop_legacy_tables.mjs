import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const mysql = require(path.join(repoRoot, "backend", "node_modules", "mysql2", "promise"));

const envPath = path.join(repoRoot, "backend", ".env");

const LEGACY_TABLES = [
  "process_definition_template_bindings",
  "template_versions",
  "templates",
  "process_templates",
  "process_versions",
  "process_units",
  "process_cargos",
  "program_processes",
  "unit_processes",
  "program_unit_history",
  "student_program_terms",
  "person_cargos",
  "programs"
];

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

const main = async () => {
  await loadEnv();
  const connection = await mysql.createConnection(getConfig());
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of LEGACY_TABLES) {
      await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      console.log(`DROP TABLE IF EXISTS ${table}`);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✅ Tablas legacy eliminadas.");
  } finally {
    await connection.end();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudieron eliminar las tablas legacy: ${error.message}`);
  process.exitCode = 1;
});
