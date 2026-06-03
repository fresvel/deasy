import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");
const envPaths = [
  path.join(backendRoot, ".env"),
  path.join(projectRoot, "docker", ".env")
];

const loadEnv = async () => {
  for (const envPath of envPaths) {
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
      if (error?.code !== "ENOENT") {
        console.warn(`No se pudo leer ${envPath}: ${error.message}`);
      }
    }
  }
};

// Reset integral del sistema al "estado base": deja MariaDB, MinIO y MongoDB vacíos para que,
// al arrancar el backend, SystemBootstrapService detecte una instalación virgen (installationMode
// = 'bootstrap') y la UI solicite la creación del primer administrador.
//
// Flags:
//   --keep-db       no recrea el schema de MariaDB
//   --keep-minio    no purga los buckets de MinIO
//   --keep-mongo    no elimina la base de datos de MongoDB
const main = async () => {
  await loadEnv();
  const args = new Set(process.argv.slice(2));
  const keepDb = args.has("--keep-db");
  const keepMinio = args.has("--keep-minio");
  const keepMongo = args.has("--keep-mongo");

  const { ensureMariaDBDatabase, ensureMariaDBSchema } = await import("../database/mariadb_initializer.js");
  const { assertMariaDBConnection, closeMariaDBPool } = await import("../config/mariadb.js");
  const { resetMinio, resetMongo } = await import("./reset_storage.mjs");

  try {
    if (!keepDb) {
      console.log("→ Reseteando MariaDB (drop + recreación del schema)...");
      await ensureMariaDBDatabase();
      await assertMariaDBConnection();
      await ensureMariaDBSchema({ reset: true });
      console.log("✅ MariaDB en schema vacío.");
    } else {
      console.log("• MariaDB conservada (--keep-db).");
    }

    if (!keepMinio) {
      console.log("→ Purgando buckets de MinIO...");
      await resetMinio();
    } else {
      console.log("• MinIO conservado (--keep-minio).");
    }

    if (!keepMongo) {
      console.log("→ Eliminando base de datos de MongoDB...");
      await resetMongo();
    } else {
      console.log("• MongoDB conservado (--keep-mongo).");
    }

    console.log("");
    console.log("✅ Sistema regresado a estado base.");
    console.log("   Reinicia el backend para entrar en modo bootstrap y crear el primer administrador.");
  } finally {
    await closeMariaDBPool();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo resetear el sistema: ${error.message}`);
  process.exitCode = 1;
});
