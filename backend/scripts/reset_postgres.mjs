import "dotenv/config";

// Los imports de abajo son DINÁMICOS a propósito: `config/postgres.js` lee las POSTGRES_*
// al cargarse y construye el pool ahí mismo, así que el entorno tiene que estar completo
// antes. En el contenedor lo aporta `env_file` del compose; fuera, el `.env` de backend/.
const main = async () => {
  const { ensurePostgresSchema } = await import("../database/postgres_initializer.js");
  const { assertPostgresConnection, closePostgresPool } = await import("../config/postgres.js");

  try {
    await assertPostgresConnection();
    await ensurePostgresSchema({ reset: true });
    console.log("✅ Reset completo de PostgreSQL finalizado.");
  } finally {
    await closePostgresPool();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo resetear PostgreSQL: ${error.message}`);
  process.exitCode = 1;
});
