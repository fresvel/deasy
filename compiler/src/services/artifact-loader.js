import {
  listMinioObjects,
  readMinioObjectAsText,
} from "./minio.js";

const normalizeObjectName = (value) => String(value || "").replace(/^\/+/, "");
const normalizeObjectPrefix = (value) => `${normalizeObjectName(value).replace(/\/?$/, "/")}`;

export const loadArtifactDescriptor = async ({
  bucket = process.env.MINIO_TEMPLATES_BUCKET || "",
  metaObjectKey,
  schemaObjectKey,
  dataObjectKey,
  renderSourcePrefix,
} = {}) => {
  const normalizedBucket = String(bucket || "").trim();
  if (!normalizedBucket) {
    throw new Error("Se requiere bucket para leer el artifact desde MinIO.");
  }
  if (!metaObjectKey || !schemaObjectKey || !renderSourcePrefix) {
    throw new Error("Se requieren metaObjectKey, schemaObjectKey y renderSourcePrefix.");
  }

  const normalizedMetaKey = normalizeObjectName(metaObjectKey);
  const normalizedSchemaKey = normalizeObjectName(schemaObjectKey);
  const normalizedDataKey = dataObjectKey ? normalizeObjectName(dataObjectKey) : null;
  const normalizedRenderPrefix = normalizeObjectPrefix(renderSourcePrefix);

  const [metaText, schemaText, dataText, objectNames] = await Promise.all([
    readMinioObjectAsText(normalizedBucket, normalizedMetaKey),
    readMinioObjectAsText(normalizedBucket, normalizedSchemaKey),
    normalizedDataKey ? readMinioObjectAsText(normalizedBucket, normalizedDataKey) : Promise.resolve(null),
    listMinioObjects(normalizedBucket, normalizedRenderPrefix, true),
  ]);

  const renderSourceFiles = objectNames
    .filter((objectName) => objectName.startsWith(normalizedRenderPrefix))
    .map((objectName) => ({
      objectName,
      relativePath: objectName.slice(normalizedRenderPrefix.length),
    }))
    .filter((item) => item.relativePath);

  if (!renderSourceFiles.length) {
    throw new Error(`No se encontraron archivos bajo ${normalizedRenderPrefix}.`);
  }

  return {
    bucket: normalizedBucket,
    metaObjectKey: normalizedMetaKey,
    schemaObjectKey: normalizedSchemaKey,
    dataObjectKey: normalizedDataKey,
    renderSourcePrefix: normalizedRenderPrefix,
    metaText,
    schemaText,
    dataText,
    renderSourceFiles,
  };
};
