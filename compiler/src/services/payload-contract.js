const normalizeCode = (value) => String(value || "").trim();

const requiredTopLevel = [
  "documentVersion",
  "artifact",
  "renderSource",
  "payload",
  "storage",
  "target",
];

export const validateNormalizedCompilationPayload = (payload) => {
  const errors = [];

  for (const key of requiredTopLevel) {
    if (!payload || typeof payload !== "object" || !payload[key]) {
      errors.push(`Falta el bloque requerido: ${key}`);
    }
  }

  if (!normalizeCode(payload?.documentVersion?.id)) {
    errors.push("Falta documentVersion.id.");
  }
  if (!normalizeCode(payload?.artifact?.bucket)) {
    errors.push("Falta artifact.bucket.");
  }
  if (!normalizeCode(payload?.sources?.metaObjectKey)) {
    errors.push("Falta sources.metaObjectKey.");
  }
  if (!normalizeCode(payload?.sources?.schemaObjectKey)) {
    errors.push("Falta sources.schemaObjectKey.");
  }
  if (!normalizeCode(payload?.renderSource?.objectPrefix)) {
    errors.push("Falta renderSource.objectPrefix.");
  }
  const renderSourceFiles = Array.isArray(payload?.renderSource?.files)
    ? payload.renderSource.files
    : [];
  if (!renderSourceFiles.length) {
    errors.push("renderSource.files debe incluir al menos un archivo.");
  }
  if (!payload?.payload || typeof payload.payload !== "object") {
    errors.push("Falta payload.");
  }
  if (
    !payload?.payload ||
    !payload.payload.mergedPayload ||
    typeof payload.payload.mergedPayload !== "object"
  ) {
    errors.push("Falta payload.mergedPayload.");
  }
  if (!normalizeCode(payload?.storage?.canonicalBasePath)) {
    errors.push("Falta storage.canonicalBasePath.");
  }
  if (!normalizeCode(payload?.target?.renderEngine)) {
    errors.push("Falta target.renderEngine.");
  }
  if (!normalizeCode(payload?.target?.outputFormat)) {
    errors.push("Falta target.outputFormat.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};
