// LIBRERÍA de purga de MinIO. No es un CLI: el único consumidor es `reset_system.mjs`, y
// purgar solo el almacenamiento se hace con `reset_system.mjs --keep-db`. Por eso no carga
// el entorno: cuando `resetMinio()` corre, quien la llamó ya lo tiene cargado.

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

const listAllObjects = async (minioClient, bucket) => {
  const names = [];
  let continuationToken = "";
  do {
    const result = await minioClient.listObjectsV2Query(
      bucket,
      "",
      continuationToken,
      "",
      LIST_PAGE_SIZE,
      ""
    );
    for (const object of result?.objects || []) {
      if (object?.name) {
        names.push(object.name);
      }
    }
    continuationToken = result?.isTruncated ? result?.nextContinuationToken : "";
  } while (continuationToken);
  return names;
};

// Vacía un bucket (sin eliminarlo): la app vuelve a publicar lo que necesite en el bootstrap.
// Idempotente y tolerante: si el bucket no existe, no es un error.
export const emptyMinioBucket = async (minioClient, bucket) => {
  const exists = await new Promise((resolve, reject) => {
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

  if (!exists) {
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
  const { minioClient } = await import("../services/storage/minio_service.js");
  const buckets = resolveBuckets();
  let total = 0;
  for (const bucket of buckets) {
    total += await emptyMinioBucket(minioClient, bucket);
  }
  console.log(`✅ MinIO purgado: ${total} objeto(s) en ${buckets.length} bucket(s).`);
};
