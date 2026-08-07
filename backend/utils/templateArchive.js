import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { minioClient, getMinioObjectStream } from "../services/storage/minio_service.js";

export const TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";

// Normaliza un segmento para usarlo en nombres de archivo/objeto (sin acentos ni separadores).
export const sanitizeStorageSegment = (value, fallback = "na") => {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
};

// Lista recursiva de nombres de objeto bajo un prefijo en MinIO.
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

// Construye la lista de recursos descargables desde el JSON available_formats. Cada formato apunta a un
// prefijo (entry_object_key) cuyos objetos se incluyen con su ruta relativa. `excludeFormats` permite omitir
// formatos (p.ej. el flujo de entregables excluye latex/jinja2; el admin no excluye nada).
export const collectFormatResources = async (availableFormats, { bucket = TEMPLATES_BUCKET, excludeFormats = new Set() } = {}) => {
  const resources = [];
  // available_formats es plano: { <format>: { entry_object_key } }.
  for (const [format, formatEntry] of Object.entries(availableFormats || {})) {
    if (!formatEntry || typeof formatEntry !== "object" || Array.isArray(formatEntry)) {
      continue;
    }
    const normalizedFormat = String(format || "").trim().toLowerCase();
    if (!normalizedFormat || excludeFormats.has(normalizedFormat)) {
      continue;
    }
    const entryPrefix = String(formatEntry?.entry_object_key || "").trim().replace(/^\/+/, "");
    if (!entryPrefix) {
      continue;
    }
    const objectNames = await listMinioObjects(bucket, entryPrefix, true);
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

// Lista los objetos bajo uno o varios prefijos y los devuelve como recursos con ruta relativa al prefijo.
export const collectPrefixResources = async (prefixes, { bucket = TEMPLATES_BUCKET } = {}) => {
  const resources = [];
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const rawPrefix of list) {
    const prefix = String(rawPrefix || "").trim().replace(/^\/+/, "");
    if (!prefix) {
      continue;
    }
    const objectNames = await listMinioObjects(bucket, prefix, true);
    for (const objectName of objectNames) {
      const cleanObjectName = String(objectName || "").trim();
      if (!cleanObjectName || cleanObjectName.endsWith("/")) {
        continue;
      }
      const relativeName = cleanObjectName.startsWith(prefix)
        ? cleanObjectName.slice(prefix.length).replace(/^\/+/, "")
        : path.basename(cleanObjectName);
      if (!relativeName) {
        continue;
      }
      resources.push({ objectName: cleanObjectName, archiveName: relativeName.replaceAll("\\", "/") });
    }
  }
  return resources;
};

export const writeMinioObjectToFile = async (bucket, objectName, destinationPath) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  await fs.ensureDir(path.dirname(destinationPath));
  await pipeline(stream, fs.createWriteStream(destinationPath));
};

export const createZipArchive = async (cwd, outputPath) =>
  new Promise((resolve, reject) => {
    const zipProcess = spawn("zip", ["-rq", outputPath, "."], { cwd, stdio: ["ignore", "ignore", "pipe"] });
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
      reject(new Error(stderr.trim() || "No se pudo generar el ZIP."));
    });
  });

// Materializa los recursos a un tmpdir, arma el ZIP y lo envía con res.download (limpia los temporales).
export const sendResourcesAsZip = async (res, { bucket = TEMPLATES_BUCKET, resources, fileBaseName = "archivos" }) => {
  const safeBase = sanitizeStorageSegment(fileBaseName, "archivos");
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "template-archive-"));
  const zipPath = path.join(os.tmpdir(), `${safeBase}-${randomUUID()}.zip`);
  const downloadFileName = `${safeBase}.zip`;
  try {
    for (const resource of resources) {
      const destinationPath = path.join(workspace, resource.archiveName);
      await writeMinioObjectToFile(bucket, resource.objectName, destinationPath);
      // Los scripts .sh deben quedar ejecutables en el ZIP (zip preserva el modo unix).
      if (destinationPath.endsWith(".sh")) {
        await fs.chmod(destinationPath, 0o755).catch(() => {});
      }
    }
    await createZipArchive(workspace, zipPath);
    res.setHeader("Content-Type", "application/zip");
    return res.download(zipPath, downloadFileName, async () => {
      await fs.remove(zipPath).catch(() => {});
      await fs.remove(workspace).catch(() => {});
    });
  } catch (error) {
    await fs.remove(zipPath).catch(() => {});
    await fs.remove(workspace).catch(() => {});
    throw error;
  }
};
