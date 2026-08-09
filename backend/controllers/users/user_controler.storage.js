// Acceso a almacenamiento de user_controler.js: resolución de objetos en MinIO,
// recolección de recursos de plantilla y empaquetado ZIP.
// Extraído en la Fase 3 (God Object #2). Ver docs/auditoria-refactor-user-controler-2026-07.md
//
// Aquí viven las constantes de bucket porque `resolveStoredDocumentObject` depende de
// ellas (por eso NO pudo ir a .primitives.js). Los handlers de la raíz las reimportan
// desde aquí para que la definición siga siendo única.
import path from "node:path";
import fs from "fs-extra";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { minioClient, getMinioObjectStream } from "../../services/storage/minio_service.js";

export const MINIO_DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents";
export const MINIO_DOCUMENTS_PREFIX = String(process.env.MINIO_DOCUMENTS_PREFIX || "Unidades").replace(/^\/+|\/+$/g, "");
export const MINIO_TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";

// latex/jinja2 son las fuentes de la plantilla: no se entregan al usuario final.
const TEMPLATE_DOWNLOAD_EXCLUDED_FORMATS = new Set(["latex", "jinja2"]);

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

export const listMinioObjects = (bucket, prefix, recursive = true) =>
  new Promise((resolve, reject) => {
    const entries = [];
    const stream = minioClient.listObjectsV2(bucket, String(prefix || "").replace(/^\/+/, ""), recursive);
    stream.on("data", (item) => {
      if (item?.name) {
        entries.push(item.name);
      }
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(entries));
  });

export const collectDeliverableTemplateResources = async (availableFormats) => {
  const resources = [];
  // available_formats es plano: { <format>: { entry_object_key } }.
  for (const [format, formatEntry] of Object.entries(availableFormats || {})) {
    if (!formatEntry || typeof formatEntry !== "object" || Array.isArray(formatEntry)) {
      continue;
    }
    const normalizedFormat = String(format || "").trim().toLowerCase();
    if (!normalizedFormat || TEMPLATE_DOWNLOAD_EXCLUDED_FORMATS.has(normalizedFormat)) {
      continue;
    }
    const entryPrefix = String(formatEntry?.entry_object_key || "").trim().replace(/^\/+/, "");
    if (!entryPrefix) {
      continue;
    }
    const objectNames = await listMinioObjects(MINIO_TEMPLATES_BUCKET, entryPrefix, true);
    for (const objectName of objectNames) {
      const cleanObjectName = String(objectName || "").trim();
      if (!cleanObjectName || cleanObjectName.endsWith("/")) {
        continue;
      }
      const relativeName = cleanObjectName.startsWith(entryPrefix)
        ? cleanObjectName.slice(entryPrefix.length).replace(/^\/+/, "")
        : path.basename(cleanObjectName);
      if (!relativeName || path.basename(relativeName).startsWith(".")) {
        continue;
      }
      resources.push({
        format: normalizedFormat,
        objectName: cleanObjectName,
        archiveName: relativeName.replaceAll("\\", "/")
      });
    }
  }
  return resources;
};

export const writeMinioObjectToFile = async (bucket, objectName, destinationPath) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  await fs.ensureDir(path.dirname(destinationPath));
  await pipeline(stream, fs.createWriteStream(destinationPath));
};

// Ruta ABSOLUTA a proposito (S4036): con `npm run start` -el CMD de la imagen de produccion- npm
// antepone `node_modules/.bin` al PATH, y ese directorio pertenece al mismo uid que corre el
// backend, asi que el PATH del proceso NO son solo directorios no escribibles. En la imagen del
// backend (node:25, base Debian) el paquete `zip` instala el binario en /usr/bin.
const ZIP_BINARY = "/usr/bin/zip";

export const createZipArchive = async (cwd, outputPath) =>
  new Promise((resolve, reject) => {
    const zipProcess = spawn(ZIP_BINARY, ["-rq", outputPath, "."], { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    zipProcess.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    zipProcess.on("error", reject);
    zipProcess.on("close", (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }
      reject(new Error(stderr.trim() || "No se pudo generar el ZIP de la plantilla."));
    });
  });
