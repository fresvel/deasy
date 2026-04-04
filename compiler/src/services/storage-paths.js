export const MINIO_DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents";
export const MINIO_DOCUMENTS_PREFIX = String(
  process.env.MINIO_DOCUMENTS_PREFIX || "Unidades"
).replace(/^\/+|\/+$/g, "");

export const sanitizeStorageSegment = (value, fallback = "na") =>
  String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;

export const buildWorkingDirectoryPrefix = ({ basePath, extension = "pdf" }) =>
  [basePath, "working", sanitizeStorageSegment(extension, "pdf").toLowerCase()].join("/");

export const buildCompiledWorkingPdfPath = ({ basePath, documentVersionId }) =>
  [
    buildWorkingDirectoryPrefix({ basePath, extension: "pdf" }),
    `document-version-${sanitizeStorageSegment(documentVersionId, "na")}.pdf`,
  ].join("/");

export const buildCompileReportPath = ({ basePath }) =>
  [buildWorkingDirectoryPrefix({ basePath, extension: "pdf" }), "compile_report.json"].join("/");
