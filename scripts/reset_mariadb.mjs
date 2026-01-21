import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const mysql = require(path.join(repoRoot, "backend", "node_modules", "mysql2", "promise"));
const envPath = path.join(repoRoot, "backend", ".env");
const schemaPath = path.join(repoRoot, "backend", "database", "mariadb_schema.sql");

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

const ensureConfig = () => {
  const {
    MARIADB_HOST,
    MARIADB_PORT,
    MARIADB_USER,
    MARIADB_PASSWORD,
    MARIADB_DATABASE
  } = process.env;

  if (!MARIADB_HOST || !MARIADB_PORT || !MARIADB_USER || !MARIADB_DATABASE) {
    throw new Error("Configuración MariaDB incompleta. Revisa backend/.env o variables de entorno.");
  }

  return {
    host: MARIADB_HOST,
    port: Number(MARIADB_PORT),
    user: MARIADB_USER,
    password: MARIADB_PASSWORD,
    database: MARIADB_DATABASE
  };
};

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

const run = async () => {
  await loadEnv();
  const config = ensureConfig();

  const baseConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    timezone: "Z"
  });

  try {
    await baseConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } finally {
    await baseConnection.end();
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    timezone: "Z"
  });

  try {
    const [tables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
      [config.database]
    );

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const row of tables) {
      await connection.query(`DROP TABLE IF EXISTS \`${row.table_name}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    const schemaSQL = await readFile(schemaPath, "utf8");
    const statements = splitSqlStatements(schemaSQL);
    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log("✅ MariaDB reseteada y esquema recreado.");
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error("❌ Error al resetear MariaDB:", error.message);
  process.exit(1);
});
