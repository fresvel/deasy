import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const mysql = require(path.join(repoRoot, "backend", "node_modules", "mysql2", "promise"));
const envPath = path.join(repoRoot, "backend", ".env");

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
    console.warn(`⚠️  No se pudo leer ${envPath}: ${error.message}`);
  }
};

const makeUnitLabel = (value) => {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!cleaned) {
    return value.slice(0, 4).toUpperCase();
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  const initials = words.map((word) => word[0]).join("").toUpperCase();
  return initials.slice(0, 5);
};

const unitLabelOverrides = new Map([
  ["Direccion Administrativa", "Administración"],
  ["Direccion de Docencia y Estudiantes", "Academia"],
  ["Direccion de Investigacion", "Investigación"],
  ["Direccion Financiera", "Financiero"],
  ["Jefatura de Aseguramiento de la Calidad", "Calidad"],
  ["Jefatura de Sistemas", "Sistemas"],
  ["Jefatura de Talento Humano", "Talento Humano"],
  ["Prorrectorado", "Prorrectorado"],
  ["Sede", "Sede"],
  ["SYSTEM", "System"]
]);

const resolveUnitLabel = (name) => unitLabelOverrides.get(name) || makeUnitLabel(name || "Unidad");

const run = async () => {
  await loadEnv();
  const {
    MARIADB_HOST,
    MARIADB_PORT,
    MARIADB_USER,
    MARIADB_PASSWORD,
    MARIADB_DATABASE
  } = process.env;

  if (!MARIADB_HOST || !MARIADB_PORT || !MARIADB_USER || !MARIADB_DATABASE) {
    throw new Error("Configuracion MariaDB incompleta para backfill de labels.");
  }

  const db = await mysql.createConnection({
    host: MARIADB_HOST,
    port: Number(MARIADB_PORT),
    user: MARIADB_USER,
    password: MARIADB_PASSWORD,
    database: MARIADB_DATABASE,
    timezone: "Z"
  });

  try {
    const [rows] = await db.query(
      "SELECT id, name, label FROM units"
    );
    let updated = 0;
    for (const row of rows) {
      const label = resolveUnitLabel(row.name);
      if (!label) {
        continue;
      }
      if (row.label === label) {
        continue;
      }
      await db.query("UPDATE units SET label = ? WHERE id = ?", [label, row.id]);
      updated += 1;
    }
    console.log(`✅ Labels actualizados: ${updated}`);
  } finally {
    await db.end();
  }
};

run().catch((error) => {
  console.error("❌ Error en backfill de labels:", error.message);
  process.exitCode = 1;
});
