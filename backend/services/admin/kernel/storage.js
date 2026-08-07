// MinioStorageService — plomeria de almacenamiento (MinIO + fs + zip) extraida de SqlAdminService.js
// (God #1) por Extract Class (cut #1). Son funciones a NIVEL DE MODULO (no metodos de clase con estado),
// asi que el patron es "modulo hermano": mover funciones + re-importar donde se usan. El cliente MinIO es
// un singleton privado de este modulo. Todas reciben el bucket por parametro (agnosticas del dominio);
// buildProtectedManifest recibe el prefijo editable por parametro para no depender de una const de dominio.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import * as Minio from "minio";

const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://localhost:9000");
const minioUseSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || minioUrl.protocol === "https:";
let minioClientInstance = null;

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
    collected.push(fullPath);
  }
  return collected;
};

const hasVisibleFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return false;
  }
  return walkFiles(dirPath).some((filePath) => path.basename(filePath) && !path.basename(filePath).startsWith("."));
};

const hashDirectory = (dirPath) => {
  const hash = crypto.createHash("sha256");
  const files = walkFiles(dirPath)
    .filter((filePath) => !path.basename(filePath).startsWith("."))
    .sort((left, right) => left.localeCompare(right));
  for (const filePath of files) {
    const relative = path.relative(dirPath, filePath).replaceAll("\\", "/");
    hash.update(relative);
    hash.update(fs.readFileSync(filePath));
  }
  return files.length ? hash.digest("hex") : null;
};

// Manifiesto de integridad del contrato: hash sha256 de cada archivo PROTEGIDO (todo menos el subárbol
// editable de contenido). Se publica como manifest.json en la raíz del artifact (fuera de los prefijos de
// available_formats, por lo que NO entra en la descarga de formatos) y es la fuente de verdad para verificar
// la re-subida del admin en la Fase 3.
const buildProtectedManifest = (dirPath, editableSubpath) => {
  const relFiles = walkFiles(dirPath)
    .map((filePath) => path.relative(dirPath, filePath).replaceAll("\\", "/"))
    .filter((rel) => !path.basename(rel).startsWith(".") && rel !== "manifest.json")
    .sort((a, b) => a.localeCompare(b));
  const protectedHashes = {};
  for (const rel of relFiles) {
    if (rel.startsWith(editableSubpath)) {
      continue; // contenido editable: no se fija hash
    }
    protectedHashes[rel] = crypto.createHash("sha256").update(fs.readFileSync(path.join(dirPath, rel))).digest("hex");
  }
  return {
    manifest_version: 1,
    generated_at: new Date().toISOString(),
    editable_prefixes: [editableSubpath],
    protected: protectedHashes
  };
};

// Descomprime un ZIP a un directorio destino (usa el binario unzip).
const unzipToDirectory = (zipPath, destDir) => new Promise((resolve, reject) => {
  const proc = spawn("unzip", ["-o", "-qq", zipPath, "-d", destDir], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
  proc.on("error", reject);
  proc.on("close", (code) => (code === 0 ? resolve(true) : reject(new Error(stderr.trim() || "No se pudo descomprimir el ZIP."))));
});

const getMinioClient = () => {
  if (!minioClientInstance) {
    minioClientInstance = new Minio.Client({
      endPoint: minioUrl.hostname,
      port: Number(minioUrl.port || (minioUseSSL ? 443 : 80)),
      useSSL: minioUseSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "",
      secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || ""
    });
  }
  return minioClientInstance;
};

const listMinioObjects = (bucket, prefix, recursive = true) => new Promise((resolve, reject) => {
  const objects = [];
  const stream = getMinioClient().listObjectsV2(bucket, prefix, recursive);
  stream.on("data", (item) => {
    if (item?.name) {
      objects.push(item.name);
    }
  });
  stream.on("error", reject);
  stream.on("end", () => resolve(objects));
});

const getMinioObjectStream = (bucket, objectName) => new Promise((resolve, reject) => {
  getMinioClient().getObject(bucket, objectName, (error, dataStream) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(dataStream);
  });
});

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolve(Buffer.concat(chunks)));
});

const readMinioObjectAsText = async (bucket, objectName) => {
  const dataStream = await getMinioObjectStream(bucket, objectName);
  const buffer = await streamToBuffer(dataStream);
  return buffer.toString("utf8");
};

const copyMinioObjectToFile = async (bucket, objectName, targetFile) => {
  const dataStream = await getMinioObjectStream(bucket, objectName);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(targetFile);
    dataStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    dataStream.pipe(writeStream);
  });
};

const downloadMinioPrefixToDirectory = async (bucket, objectPrefix, targetDir) => {
  const normalizedPrefix = String(objectPrefix || "").replace(/^\/+/, "").replace(/\/?$/, "/");
  const objectNames = await listMinioObjects(bucket, normalizedPrefix, true);
  if (!objectNames.length) {
    throw new Error(`No se encontraron objetos en MinIO bajo ${normalizedPrefix}`);
  }
  for (const objectName of objectNames) {
    if (!objectName.startsWith(normalizedPrefix)) {
      continue;
    }
    const relativePath = objectName.slice(normalizedPrefix.length);
    if (!relativePath) {
      continue;
    }
    await copyMinioObjectToFile(bucket, objectName, path.join(targetDir, relativePath));
  }
};

const fPutObject = (bucket, objectName, filePath) => new Promise((resolve, reject) => {
  getMinioClient().fPutObject(bucket, objectName, filePath, {}, (error, etag) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(etag);
  });
});

const putMinioObjectFromText = (bucket, objectName, text, contentType = "text/plain") => new Promise((resolve, reject) => {
  const buffer = Buffer.from(String(text ?? ""), "utf8");
  getMinioClient().putObject(bucket, objectName, buffer, buffer.length, { "Content-Type": contentType }, (error, etag) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(etag);
  });
});

const statMinioObject = (bucket, objectName) => new Promise((resolve, reject) => {
  getMinioClient().statObject(bucket, objectName, (error, stat) => (error ? reject(error) : resolve(stat)));
});

// Copia byte-a-byte preservando el content-type. Imprescindible para clonar versiones con binarios
// (PNG/PDF/DOCX/XLSX/PPTX): una copia vía texto UTF-8 corrompe esos archivos.
const copyMinioObjectBinary = async (bucket, sourceObject, targetObject) => {
  let contentType;
  try {
    const stat = await statMinioObject(bucket, sourceObject);
    contentType = stat?.metaData?.["content-type"] || stat?.metaData?.["Content-Type"];
  } catch {
    // El content-type es opcional; si no se puede leer, se sube sin él.
  }
  const buffer = await streamToBuffer(await getMinioObjectStream(bucket, sourceObject));
  return new Promise((resolve, reject) => {
    const meta = contentType ? { "Content-Type": contentType } : {};
    getMinioClient().putObject(bucket, targetObject, buffer, buffer.length, meta, (error, etag) => (error ? reject(error) : resolve(etag)));
  });
};

// Elimina todos los objetos bajo un prefijo (limpieza de huérfanos en MinIO, best-effort).
const removeMinioPrefix = async (bucket, objectPrefix) => {
  const objectNames = await listMinioObjects(bucket, objectPrefix, true);
  for (const objectName of objectNames) {
    await new Promise((resolve) => {
      getMinioClient().removeObject(bucket, objectName, (error) => {
        if (error) {
          console.warn(`No se pudo eliminar objeto huérfano ${objectName}:`, error.message);
        }
        resolve();
      });
    });
  }
};

const ensureMinioBucket = (bucket) => new Promise((resolve, reject) => {
  getMinioClient().bucketExists(bucket, (checkError, exists) => {
    if (checkError) {
      reject(checkError);
      return;
    }
    if (exists) {
      resolve(true);
      return;
    }
    getMinioClient().makeBucket(bucket, "", (makeError) => {
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

const uploadDirectoryToMinio = async (bucket, objectPrefix, sourceDir) => {
  await ensureMinioBucket(bucket);
  const files = walkFiles(sourceDir).filter((filePath) => !path.basename(filePath).startsWith("."));
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replaceAll("\\", "/");
    const objectName = normalizeObjectName(objectPrefix, relativePath);
    await fPutObject(bucket, objectName, filePath);
  }
  return files.length;
};

export {
  walkFiles, hasVisibleFiles, hashDirectory, buildProtectedManifest, unzipToDirectory, listMinioObjects, getMinioObjectStream, streamToBuffer, readMinioObjectAsText, copyMinioObjectToFile, downloadMinioPrefixToDirectory, putMinioObjectFromText, copyMinioObjectBinary, removeMinioPrefix, uploadDirectoryToMinio
};
