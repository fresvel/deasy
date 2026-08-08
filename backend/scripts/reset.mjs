import "dotenv/config";

// CLI de reset. Los objetivos son POSITIVOS y explícitos: sin argumentos no borra nada.
//
// POR QUÉ ES ASÍ. Antes esto eran tres ficheros (reset_postgres / reset_storage / reset_system)
// y el orquestador arrasaba PostgreSQL Y MinIO por defecto; para NO perder algo había que
// acordarse de --keep-db o --keep-minio. Un default destructivo con opt-out está al revés:
// ahora hay que nombrar lo que se borra, así que cada call site declara su alcance a la vista.
//
//   node scripts/reset.mjs                 imprime el uso y sale 1, sin tocar nada
//   node scripts/reset.mjs db              solo PostgreSQL (drop + recreación del schema)
//   node scripts/reset.mjs storage         solo los buckets de MinIO
//   node scripts/reset.mjs db storage      ambos (el antiguo reset_system.mjs sin flags)
//
// --yes salta la confirmación. Los wrappers de scripts/ ya la pasan, porque tienen sus propios
// guards (ver ensure_prod_approval_file en scripts/_backend_db_exec.sh). La confirmación
// protege a quien invoque este fichero A MANO dentro del contenedor, que es justo el camino
// donde esos guards no se aplican.

const TARGETS = ["db", "storage"];

const usage = () => {
  console.error("Uso: node scripts/reset.mjs <db|storage> [db|storage] [--yes]");
  console.error("");
  console.error("  db        dropea las tablas de PostgreSQL y recrea el schema vacío");
  console.error("  storage   vacía los buckets de MinIO gestionados por la app");
  console.error("  --yes     no pide confirmación aunque haya datos");
  console.error("");
  console.error("No hay objetivo por defecto: hay que nombrar lo que se borra.");
};

const parseArgs = () => {
  const targets = new Set();
  let yes = false;

  for (const arg of process.argv.slice(2)) {
    if (arg === "--yes") {
      yes = true;
    } else if (TARGETS.includes(arg)) {
      targets.add(arg);
    } else {
      console.error(`Objetivo no reconocido: '${arg}'.`);
      console.error("");
      usage();
      return null;
    }
  }

  if (targets.size === 0) {
    usage();
    return null;
  }
  return { targets, yes };
};

const reportContents = ({ tables, buckets }) => {
  console.error("⚠️  La instancia tiene datos:");
  for (const table of tables) {
    console.error(`   · ${table.name}: ${table.total} fila(s)`);
  }
  for (const bucket of buckets) {
    console.error(`   · bucket '${bucket.name}': con objetos`);
  }
  console.error("");
  console.error("Repite el comando con --yes para borrarlos.");
};

const main = async () => {
  const parsed = parseArgs();
  if (!parsed) {
    process.exitCode = 1;
    return;
  }
  const { targets, yes } = parsed;

  // Dinámico a propósito: la librería importa config/postgres.js, que construye el pool al
  // cargarse, y el `import "dotenv/config"` de arriba tiene que haber corrido antes.
  const lib = await import("./lib/reset_targets.mjs");

  try {
    if (!yes) {
      const contents = await lib.describeContents(targets);
      if (contents.tables.length || contents.buckets.length) {
        reportContents(contents);
        process.exitCode = 1;
        return;
      }
    }

    if (targets.has("db")) {
      console.log("→ Reseteando PostgreSQL (drop + recreación del schema)...");
      await lib.resetPostgres();
      console.log("✅ PostgreSQL en schema vacío.");
    }

    if (targets.has("storage")) {
      console.log("→ Purgando buckets de MinIO...");
      await lib.resetMinio();
    }

    console.log("");
    console.log(`✅ Reset completado: ${[...targets].join(", ")}.`);
    if (targets.has("db")) {
      console.log("   Reinicia el backend para entrar en modo bootstrap y crear el primer administrador.");
    }
  } finally {
    await lib.closePostgresPool();
  }
};

main().catch((error) => {
  console.error(`❌ No se pudo resetear: ${error.message}`);
  process.exitCode = 1;
});
