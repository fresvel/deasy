// Implementación de los objetivos de reset. Es una LIBRERÍA: no parsea argumentos, no imprime
// modo de uso y no toca process.exit. El único CLI es `scripts/reset.mjs`.
//
// El entorno tiene que estar cargado ANTES de importar este módulo: `config/postgres.js` lee
// las POSTGRES_* y construye el pool al cargarse. Por eso `reset.mjs` hace `import
// "dotenv/config"` (estático, se evalúa primero) y solo después importa esto de forma dinámica.

import { assertPostgresConnection, closePostgresPool, getPostgresPool } from "../../config/postgres.js";
import { ensurePostgresSchema } from "../../database/postgres_initializer.js";

export { closePostgresPool };

// --- PostgreSQL ---------------------------------------------------------------------------

export const resetPostgres = async () => {
  await assertPostgresConnection();
  await ensurePostgresSchema({ reset: true });
};

// Tablas que delatan que la instancia se ha usado de verdad. No pretende ser exhaustiva: es el
// disparador de la confirmación, no un inventario. Si alguna no existe todavía, el schema aún
// no está creado y por definición no hay nada que perder.
const CONTENT_TABLES = ["persons", "process_runs", "tasks", "task_items", "documents", "signature_requests"];

const countDatabaseContents = async () => {
  const pool = getPostgresPool();
  if (!pool) return [];
  const found = [];
  for (const table of CONTENT_TABLES) {
    try {
      // Interpolación segura: los nombres salen de la constante de arriba, no de la entrada.
      const [rows] = await pool.query(`SELECT COUNT(*)::int AS total FROM ${table}`);
      const total = Number(rows?.[0]?.total || 0);
      if (total > 0) found.push({ name: table, total });
    } catch (error) {
      // 42P01 = relación inexistente. Schema sin crear: cuenta como vacío.
      if (error?.code !== "42P01") throw error;
    }
  }
  return found;
};

// --- MinIO --------------------------------------------------------------------------------

// Buckets gestionados por la aplicación (mismos defaults que el código que los usa).
const resolveBuckets = () => [
  process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates",
  process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents",
  process.env.MINIO_DOSSIER_BUCKET || "deasy-dossier",
  process.env.MINIO_SPOOL_BUCKET || "deasy-spool",
  process.env.MINIO_CHAT_BUCKET || "deasy-chat",
  process.env.MINIO_USERS_BUCKET || "deasy-users",
  process.env.MINIO_CERTIFICATES_BUCKET || "deasy-certificates"
];

// Tamaño de página deliberadamente pequeño: el cliente MinIO 8 parsea las respuestas con
// fast-xml-parser, que aborta a 1000 "entidades" por documento. Cada objeto aporta ~2 entidades,
// así que páginas grandes (el default de 1000) revientan con "Entity expansion limit exceeded".
// 200 objetos ≈ 400 entidades, muy por debajo del límite, y pagina con el continuation token.
const LIST_PAGE_SIZE = 200;
const REMOVE_BATCH_SIZE = 200;

const chunk = (array, size) => {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
};

const bucketExists = (minioClient, bucket) =>
  new Promise((resolve, reject) => {
    minioClient.bucketExists(bucket, (error, value) => {
      if (error) {
        // Algunos backends devuelven NoSuchBucket como error en vez de false.
        if (error?.code === "NoSuchBucket") {
          resolve(false);
          return;
        }
        reject(error);
        return;
      }
      resolve(value);
    });
  });

const listObjectPage = async (minioClient, bucket, continuationToken, pageSize) => {
  const result = await minioClient.listObjectsV2Query(bucket, "", continuationToken, "", pageSize, "");
  const names = (result?.objects || []).map((object) => object?.name).filter(Boolean);
  return { names, next: result?.isTruncated ? result?.nextContinuationToken : "" };
};

const listAllObjects = async (minioClient, bucket) => {
  const names = [];
  let continuationToken = "";
  do {
    const page = await listObjectPage(minioClient, bucket, continuationToken, LIST_PAGE_SIZE);
    names.push(...page.names);
    continuationToken = page.next;
  } while (continuationToken);
  return names;
};

// Vacía un bucket (sin eliminarlo): la app vuelve a publicar lo que necesite en el bootstrap.
// Idempotente y tolerante: si el bucket no existe, no es un error.
const emptyMinioBucket = async (minioClient, bucket) => {
  if (!(await bucketExists(minioClient, bucket))) {
    console.log(`• Bucket '${bucket}' no existe, se omite.`);
    return 0;
  }

  const names = await listAllObjects(minioClient, bucket);
  if (names.length === 0) {
    console.log(`• Bucket '${bucket}' ya está vacío.`);
    return 0;
  }

  // Borrado por lotes: además de respetar el tope de S3 (1000 claves por multi-delete), mantiene
  // el cuerpo XML pequeño y predecible.
  for (const batch of chunk(names, REMOVE_BATCH_SIZE)) {
    await minioClient.removeObjects(bucket, batch);
  }
  console.log(`• Bucket '${bucket}': ${names.length} objeto(s) eliminado(s).`);
  return names.length;
};

export const resetMinio = async () => {
  const { minioClient } = await import("../../services/storage/minio_service.js");
  const buckets = resolveBuckets();
  let total = 0;
  for (const bucket of buckets) {
    total += await emptyMinioBucket(minioClient, bucket);
  }
  console.log(`✅ MinIO purgado: ${total} objeto(s) en ${buckets.length} bucket(s).`);
};

// Para la confirmación basta saber SI hay contenido, no cuánto: se pide una sola clave por
// bucket en vez de paginar el inventario entero.
const countStorageContents = async () => {
  const { minioClient } = await import("../../services/storage/minio_service.js");
  const found = [];
  for (const bucket of resolveBuckets()) {
    if (!(await bucketExists(minioClient, bucket))) continue;
    const page = await listObjectPage(minioClient, bucket, "", 1);
    if (page.names.length) found.push({ name: bucket });
  }
  return found;
};

// --- Inventario previo a la confirmación ----------------------------------------------------

export const describeContents = async (targets) => ({
  tables: targets.has("db") ? await countDatabaseContents() : [],
  buckets: targets.has("storage") ? await countStorageContents() : []
});
