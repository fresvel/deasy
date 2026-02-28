import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
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
      if (!key || process.env[key]) {
        return;
      }
      process.env[key] = rest.join("=").trim();
    });
  } catch (error) {
    console.warn(`No se pudo leer ${envPath}: ${error.message}`);
  }
};

const main = async () => {
  await loadEnv();
  const { ensureMariaDBDatabase, ensureMariaDBSchema } = await import("../backend/database/mariadb_initializer.js");
  const { assertMariaDBConnection, closeMariaDBPool } = await import("../backend/config/mariadb.js");

  try {
    await ensureMariaDBDatabase();
    await assertMariaDBConnection();
    await ensureMariaDBSchema({ reset: true });
    console.log("✅ Reset completo de MariaDB finalizado.");
  } finally {
    await closeMariaDBPool();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo resetear MariaDB: ${error.message}`);
  process.exitCode = 1;
});
