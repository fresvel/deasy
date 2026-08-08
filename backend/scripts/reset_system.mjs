import "dotenv/config";

// Reset integral del sistema al "estado base": deja PostgreSQL y MinIO vacíos para que,
// al arrancar el backend, SystemBootstrapService detecte una instalación virgen (installationMode
// = 'bootstrap') y la UI solicite la creación del primer administrador.
//
// Flags:
//   --keep-db       no recrea el schema de PostgreSQL
//   --keep-minio    no purga los buckets de MinIO
const main = async () => {
  const args = new Set(process.argv.slice(2));
  const keepDb = args.has("--keep-db");
  const keepMinio = args.has("--keep-minio");

  const { ensurePostgresSchema } = await import("../database/postgres_initializer.js");
  const { assertPostgresConnection, closePostgresPool } = await import("../config/postgres.js");
  const { resetMinio } = await import("./reset_storage.mjs");

  try {
    if (!keepDb) {
      console.log("→ Reseteando PostgreSQL (drop + recreación del schema)...");
      await assertPostgresConnection();
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
    await closePostgresPool();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo resetear el sistema: ${error.message}`);
  process.exitCode = 1;
});
