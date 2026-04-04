import { randomUUID } from "crypto";

export const MINIO_DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents";
export const MINIO_DOCUMENTS_PREFIX = String(process.env.MINIO_DOCUMENTS_PREFIX || "Unidades").replace(/^\/+|\/+$/g, "");

export const sanitizeStorageSegment = (value, fallback = "na") =>
  String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;

export const buildDocumentVersionFolder = (sequenceValue) => {
  const sequence = Math.max(1, Number(sequenceValue || 1));
  return `v${String(sequence).padStart(4, "0")}`;
};

export const buildCanonicalDocumentVersionBasePath = (target) => {
  const year =
    Number(target.term_year) ||
    Number(String(target.term_start_date || "").slice(0, 4)) ||
    new Date().getFullYear();
  const versionFolder = buildDocumentVersionFolder(target.document_version_sequence);
  return [
    String(target.scope_unit_id),
    "PROCESOS",
    String(target.process_id),
    "ANIOS",
    String(year),
    "TIPOS_PERIODO",
    String(target.term_type_id),
    "PERIODOS",
    String(target.term_id),
    "TAREAS",
    String(target.task_id),
    "Documentos",
    String(target.document_id),
    versionFolder
  ].join("/");
};

export const buildWorkingObjectPathForUpload = ({ basePath, originalName, extension }) => {
  const safeOriginalName = sanitizeStorageSegment(originalName, `archivo.${extension || "bin"}`);
  const safeExtension = sanitizeStorageSegment(extension || "bin", "bin").toLowerCase();
  return [
    basePath,
    "working",
    safeExtension,
    `${Date.now()}-${randomUUID()}-${safeOriginalName}`
  ].join("/");
};

export const buildRuntimePayloadObjectPath = ({ basePath, fileName = "runtime.data.json" }) =>
  [basePath, "payload", sanitizeStorageSegment(fileName, "runtime.data.json")].join("/");

export const buildWorkingDirectoryPrefix = ({ basePath, extension = "pdf" }) =>
  [basePath, "working", sanitizeStorageSegment(extension, "pdf").toLowerCase()].join("/");

export const buildFinalDirectoryPrefix = ({ basePath }) => [basePath, "final"].join("/");

export const buildCompiledWorkingPdfPath = ({ basePath, documentVersionId }) =>
  [
    buildWorkingDirectoryPrefix({ basePath, extension: "pdf" }),
    `document-version-${sanitizeStorageSegment(documentVersionId, "na")}.pdf`,
  ].join("/");

export const resolveStoredDocumentObject = (storedPath) => {
  const normalizedPath = String(storedPath || "").trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return null;
  }
  if (normalizedPath.startsWith(`${MINIO_DOCUMENTS_PREFIX}/`)) {
    return {
      bucket: MINIO_DOCUMENTS_BUCKET,
      objectName: normalizedPath,
      relativePath: normalizedPath.slice(MINIO_DOCUMENTS_PREFIX.length + 1)
    };
  }
  return {
    bucket: MINIO_DOCUMENTS_BUCKET,
    objectName: `${MINIO_DOCUMENTS_PREFIX}/${normalizedPath}`,
    relativePath: normalizedPath
  };
};
