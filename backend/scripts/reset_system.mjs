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

// Reset integral del sistema al "estado base": deja PostgreSQL y MinIO vacíos para que,
// al arrancar el backend, SystemBootstrapService detecte una instalación virgen (installationMode
// = 'bootstrap') y la UI solicite la creación del primer administrador.
//
// Flags:
//   --keep-db       no recrea el schema de PostgreSQL
//   --keep-minio    no purga los buckets de MinIO
const main = async () => {
  await loadEnv();
  const args = new Set(process.argv.slice(2));
  const keepDb = args.has("--keep-db");
  const keepMinio = args.has("--keep-minio");

  const { ensurePostgresSchema } = await import("../database/postgres_initializer.js");
  const { assertMariaDBConnection, closeMariaDBPool } = await import("../config/mariadb.js");
  const { resetMinio } = await import("./reset_storage.mjs");

  try {
    if (!keepDb) {
      console.log("→ Reseteando PostgreSQL (drop + recreación del schema)...");
      await assertMariaDBConnection();
      await ensurePostgresSchema({ reset: true });
      console.log("✅ PostgreSQL en schema vacío.");
    } else {
      console.log("• PostgreSQL conservada (--keep-db).");
    }

    if (!keepMinio) {
      console.log("→ Purgando buckets de MinIO...");
      await resetMinio();
    } else {
      console.log("• MinIO conservado (--keep-minio).");
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
