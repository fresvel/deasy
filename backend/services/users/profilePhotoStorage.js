// Almacenamiento de las fotos de perfil (persons.photo_url).
//
// La columna guarda una referencia, no una URL publica. Durante la migracion a MinIO
// conviven cuatro formatos y este modulo es el unico que sabe interpretarlos:
//   minio://<bucket>/<objeto>   -> objeto en MinIO (formato destino)
//   uploads/profile_photos/x.jpg -> fichero en el disco del backend (heredado)
//   data:image/png;base64,...    -> imagen embebida en la columna (heredado)
//   http(s)://...                -> URL externa (avatares importados)
//
// La lectura siempre pasa por el backend (ver user_photo_controller.js): nada de
// exponer MinIO ni un express.static publico.
import fs from "fs-extra";
import path from "node:path";
import { Readable } from "node:stream";
import {
  ensureBucketExists,
  getMinioObjectStream,
  removeMinioObject,
  statMinioObject,
  uploadFileToMinio
} from "../storage/minio_service.js";

export const MINIO_USERS_BUCKET = process.env.MINIO_USERS_BUCKET || "deasy-users";
const MINIO_SCHEME = "minio://";

// Raiz del almacenamiento heredado. Cualquier ruta que se resuelva fuera de aqui
// se descarta: la columna no puede convertirse en una lectura arbitraria de disco.
export const LEGACY_UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

const CONTENT_TYPE_BY_EXTENSION = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

export const contentTypeForExtension = (extension) =>
  CONTENT_TYPE_BY_EXTENSION[String(extension || "").toLowerCase()] || "application/octet-stream";

export const buildMinioReference = (bucket, objectName) =>
  `${MINIO_SCHEME}${bucket}/${String(objectName || "").replace(/^\/+/, "")}`;

const parseMinioReference = (value) => {
  // Sin normalizar barras iniciales: "minio:///obj" no tiene bucket y no debe
  // reinterpretarse como si el primer segmento del objeto lo fuera.
  const withoutScheme = value.slice(MINIO_SCHEME.length);
  const separatorIndex = withoutScheme.indexOf("/");
  if (separatorIndex <= 0) {
    return null;
  }
  const bucket = withoutScheme.slice(0, separatorIndex);
  const objectName = withoutScheme.slice(separatorIndex + 1).replace(/^\/+/, "");
  if (!bucket || !objectName) {
    return null;
  }
  return { kind: "minio", bucket, objectName };
};

const parseDataUri = (value) => {
  const match = /^data:([^;,]+)?(;base64)?,/i.exec(value);
  if (!match) {
    return null;
  }
  return {
    kind: "data-uri",
    contentType: match[1] || "application/octet-stream",
    isBase64: Boolean(match[2]),
    payload: value.slice(match[0].length)
  };
};

// Devuelve un descriptor de lo que hay en photo_url, o null si no hay foto usable.
export const parsePhotoReference = (rawValue) => {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return null;
  }
  if (value.startsWith(MINIO_SCHEME)) {
    return parseMinioReference(value);
  }
  if (/^data:/i.test(value)) {
    return parseDataUri(value);
  }
  if (/^https?:\/\//i.test(value)) {
    return { kind: "external", url: value };
  }
  return { kind: "legacy-file", relativePath: value.replace(/^\/+/, "") };
};

// Resuelve una ruta heredada dentro de uploads/ y rechaza cualquier escape (..).
export const resolveLegacyPhotoPath = (relativePath) => {
  const normalized = String(relativePath || "").replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const withoutPrefix = normalized.startsWith("uploads/") ? normalized.slice("uploads/".length) : normalized;
  const absolute = path.resolve(LEGACY_UPLOADS_ROOT, withoutPrefix);
  if (absolute !== LEGACY_UPLOADS_ROOT && !absolute.startsWith(`${LEGACY_UPLOADS_ROOT}${path.sep}`)) {
    return null;
  }
  return absolute;
};

const MINIO_NOT_FOUND_CODES = new Set(["NoSuchBucket", "NoSuchKey", "NotFound", "NoSuchObject"]);

const openMinioPhoto = async (reference) => {
  let stat;
  try {
    stat = await statMinioObject(reference.bucket, reference.objectName);
  } catch (error) {
    if (MINIO_NOT_FOUND_CODES.has(error?.code)) {
      return null;
    }
    throw error;
  }
  return {
    stream: await getMinioObjectStream(reference.bucket, reference.objectName),
    contentType:
      stat?.metaData?.["content-type"] || contentTypeForExtension(path.extname(reference.objectName)),
    size: stat?.size ?? null,
    etag: stat?.etag ? `"${String(stat.etag).replace(/"/g, "")}"` : null,
    lastModified: stat?.lastModified ?? null
  };
};

const openLegacyFilePhoto = async (reference) => {
  const absolutePath = resolveLegacyPhotoPath(reference.relativePath);
  if (!absolutePath || !(await fs.pathExists(absolutePath))) {
    return null;
  }
  const stat = await fs.stat(absolutePath);
  return {
    stream: fs.createReadStream(absolutePath),
    contentType: contentTypeForExtension(path.extname(absolutePath)),
    size: stat.size,
    etag: `"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`,
    lastModified: stat.mtime
  };
};

const openDataUriPhoto = (reference) => {
  const buffer = Buffer.from(reference.payload, reference.isBase64 ? "base64" : "utf8");
  if (!buffer.length) {
    return null;
  }
  return {
    stream: Readable.from(buffer),
    contentType: reference.contentType,
    size: buffer.length,
    etag: null,
    lastModified: null
  };
};

// --- Escritura ---

// El mimetype del multipart lo pone el cliente, asi que no decide nada: el formato
// sale de la firma del propio fichero.
const IMAGE_SIGNATURES = [
  {
    extension: ".png",
    contentType: "image/png",
    matches: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    extension: ".jpg",
    contentType: "image/jpeg",
    matches: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  },
  {
    extension: ".webp",
    contentType: "image/webp",
    matches: (buffer) =>
      buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  }
];

export const detectImageFormat = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  return IMAGE_SIGNATURES.find((signature) => signature.matches(buffer)) ?? null;
};

export class UnsupportedImageError extends Error {
  constructor(message = "Formato de imagen no permitido. Usa PNG, JPG o WEBP.") {
    super(message);
    this.name = "UnsupportedImageError";
    this.code = "UNSUPPORTED_IMAGE";
  }
}

// deasy-users ya organiza sus objetos como users/{cedula}/... (ver sign_controller.js).
export const buildProfilePhotoObjectName = (cedula, extension, timestamp) => {
  const safeCedula = String(cedula ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeCedula) {
    throw new Error("La cédula es requerida para guardar la foto de perfil.");
  }
  return `users/${safeCedula}/profile/${timestamp}${extension}`;
};

const readSignature = async (filePath) => {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await fs.read(handle, buffer, 0, 12, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await fs.close(handle);
  }
};

// Sube el temporal de multer a MinIO y devuelve la referencia que va en photo_url.
// El borrado del temporal es responsabilidad de quien llama (bloque finally).
export const storeProfilePhoto = async ({ cedula, filePath, timestamp = Date.now() }) => {
  const format = detectImageFormat(await readSignature(filePath));
  if (!format) {
    throw new UnsupportedImageError();
  }

  const objectName = buildProfilePhotoObjectName(cedula, format.extension, timestamp);
  await ensureBucketExists(MINIO_USERS_BUCKET);
  await uploadFileToMinio(MINIO_USERS_BUCKET, objectName, filePath, {
    "Content-Type": format.contentType
  });

  return {
    reference: buildMinioReference(MINIO_USERS_BUCKET, objectName),
    bucket: MINIO_USERS_BUCKET,
    objectName,
    contentType: format.contentType
  };
};

// Borrado best-effort de la foto anterior: que falle no puede tumbar la subida de
// la nueva (mismo criterio que los certificados P12).
export const removeStoredPhoto = async (rawValue) => {
  const reference = parsePhotoReference(rawValue);
  if (!reference) {
    return false;
  }
  try {
    if (reference.kind === "minio") {
      await removeMinioObject(reference.bucket, reference.objectName);
      return true;
    }
    if (reference.kind === "legacy-file") {
      const absolutePath = resolveLegacyPhotoPath(reference.relativePath);
      if (!absolutePath || !(await fs.pathExists(absolutePath))) {
        return false;
      }
      await fs.remove(absolutePath);
      return true;
    }
  } catch (error) {
    console.warn("No se pudo eliminar la foto de perfil anterior:", error?.message || error);
  }
  return false;
};

// Abre la foto sea cual sea el formato de la referencia. Devuelve null cuando el
// objeto/fichero ya no existe (la columna quedo colgada) para que el handler
// responda 404 en vez de reventar.
export const openProfilePhoto = async (rawValue) => {
  const reference = parsePhotoReference(rawValue);
  if (!reference) {
    return null;
  }
  if (reference.kind === "minio") {
    return openMinioPhoto(reference);
  }
  if (reference.kind === "legacy-file") {
    return openLegacyFilePhoto(reference);
  }
  if (reference.kind === "data-uri") {
    return openDataUriPhoto(reference);
  }
  // Las URLs externas no se reenvian desde el backend: el cliente las usa directamente.
  return null;
};
