import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as Minio from "minio";
import { getMariaDBPool } from "../config/mariadb.js";
import { consumeRabbitMessages, publishRabbitMessage } from "../services/infrastructure/rabbitmq_http.js";

const WORKER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(WORKER_DIR, "..", "..");
const STORAGE_UPLOAD_QUEUE = process.env.RABBITMQ_STORAGE_QUEUE || "deasy.storage.uploads";
const MAX_RETRIES = Number(process.env.STORAGE_UPLOAD_MAX_RETRIES || 3);
const POLL_INTERVAL_MS = Number(process.env.STORAGE_UPLOAD_POLL_MS || 3000);

const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://minio:9000");
const useSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || minioUrl.protocol === "https:";
const minioClient = new Minio.Client({
  endPoint: minioUrl.hostname,
  port: Number(minioUrl.port || (useSSL ? 443 : 80)),
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "",
  secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || ""
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const walkFiles = (dirPath, collected = []) => {
  if (!fs.existsSync(dirPath)) {
    return collected;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collected);
      continue;
    }
    if (!entry.name.startsWith(".")) {
      collected.push(fullPath);
    }
  }
  return collected;
};

const fPutObject = (bucket, objectName, filePath) => new Promise((resolve, reject) => {
  minioClient.fPutObject(bucket, objectName, filePath, {}, (error, etag) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(etag);
  });
});

const ensureBucket = (bucket) => new Promise((resolve, reject) => {
  minioClient.bucketExists(bucket, (checkError, exists) => {
    if (checkError) {
      reject(checkError);
      return;
    }
    if (exists) {
      resolve(true);
      return;
    }
    minioClient.makeBucket(bucket, "", (makeError) => {
      if (makeError) {
        reject(makeError);
        return;
      }
      resolve(true);
    });
  });
});

const normalizeObjectName = (prefix, relativePath) => {
  const cleanPrefix = String(prefix || "").replace(/^\/+|\/+$/g, "");
  const cleanRelative = String(relativePath || "").replace(/^\/+|\/+$/g, "");
  if (!cleanPrefix) {
    return cleanRelative;
  }
  if (!cleanRelative) {
    return cleanPrefix;
  }
  return `${cleanPrefix}/${cleanRelative}`;
};

const uploadTree = async ({ bucket, objectPrefix, sourceDir }) => {
  const resolvedSourceDir = path.resolve(REPO_ROOT, sourceDir);
  if (!fs.existsSync(resolvedSourceDir)) {
    throw new Error(`No existe el directorio de staging: ${sourceDir}`);
  }
  await ensureBucket(bucket);
  const files = walkFiles(resolvedSourceDir);
  for (const filePath of files) {
    const relative = path.relative(resolvedSourceDir, filePath).replace(/\\/g, "/");
    const objectName = normalizeObjectName(objectPrefix, relative);
    await fPutObject(bucket, objectName, filePath);
  }
  return { resolvedSourceDir, uploadedCount: files.length };
};

const markArtifactActive = async (artifactId) => {
  const pool = getMariaDBPool();
  await pool.query("UPDATE template_artifacts SET is_active = 1 WHERE id = ?", [artifactId]);
};

const handleUploadTree = async (payload) => {
  const { resolvedSourceDir } = await uploadTree(payload);
  if (payload.artifact_id) {
    await markArtifactActive(payload.artifact_id);
  }
  fs.rmSync(resolvedSourceDir, { recursive: true, force: true });
};

const processMessage = async (message) => {
  const payload = message?.payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("La cola de storage recibio un mensaje invalido.");
  }
  if (payload.type !== "upload-tree") {
    throw new Error(`Tipo de trabajo no soportado: ${String(payload.type || "desconocido")}`);
  }
  await handleUploadTree(payload);
};

const requeueWithRetry = async (payload, error) => {
  const retries = Number(payload?.retries || 0);
  if (retries >= MAX_RETRIES) {
    console.error(`[storage-uploader] Trabajo agotado tras ${retries} reintentos:`, error?.message || error);
    return;
  }
  await publishRabbitMessage(STORAGE_UPLOAD_QUEUE, {
    ...payload,
    retries: retries + 1,
    last_error: String(error?.message || error || "")
  });
};

const run = async () => {
  console.log(`[storage-uploader] Worker iniciado. Cola: ${STORAGE_UPLOAD_QUEUE}`);
  for (;;) {
    try {
      const messages = await consumeRabbitMessages(STORAGE_UPLOAD_QUEUE, 1);
      if (!messages.length) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      for (const message of messages) {
        try {
          await processMessage(message);
        } catch (error) {
          console.error("[storage-uploader] Error procesando trabajo:", error?.message || error);
          await requeueWithRetry(message?.payload, error);
        }
      }
    } catch (error) {
      console.error("[storage-uploader] Error consultando la cola:", error?.message || error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
};

run().catch((error) => {
  console.error("[storage-uploader] Falla critica:", error?.message || error);
  process.exit(1);
});
