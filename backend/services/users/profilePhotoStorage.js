// Almacenamiento de las fotos de perfil.
//
// persons.photo_url guarda una referencia "minio://<bucket>/<objeto>", nunca una URL
// publica ni una ruta de disco: el backend es el unico que sabe resolverla y la lectura
// pasa siempre por un handler autenticado (user_photo_controller.js).
//
// Mismo patron que los certificados P12: temporal del sistema -> objeto en MinIO ->
// borrado del temporal. Nada de estado local en el contenedor del backend.
import fs from "fs-extra";
import path from "node:path";
import {
  ensureBucketExists,
  getMinioObjectStream,
  removeMinioObject,
  statMinioObject,
  uploadFileToMinio
} from "../storage/minio_service.js";
import { buildMinioReference, parseMinioReference } from "../storage/minioReference.js";

export const MINIO_USERS_BUCKET = process.env.MINIO_USERS_BUCKET || "deasy-users";

const CONTENT_TYPE_BY_EXTENSION = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

export const contentTypeForExtension = (extension) =>
  CONTENT_TYPE_BY_EXTENSION[String(extension || "").toLowerCase()] || "application/octet-stream";

// La convencion `minio://<bucket>/<objeto>` se movio a `storage/minioReference.js` cuando el
// escaneo del documento de identidad necesito la misma. Se reexporta `parsePhotoReference` como
// alias para no tocar a sus llamadores.
export { buildMinioReference };
export const parsePhotoReference = parseMinioReference;

const MINIO_NOT_FOUND_CODES = new Set(["NoSuchBucket", "NoSuchKey", "NotFound", "NoSuchObject"]);

// Abre la foto para hacerle stream. Devuelve null cuando la referencia esta vacia o el
// objeto ya no existe, para que el handler responda 404 en vez de reventar.
export const openProfilePhoto = async (rawValue) => {
  const reference = parsePhotoReference(rawValue);
  if (!reference) {
    return null;
  }

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
    etag: stat?.etag ? `"${String(stat.etag).replaceAll("\"", "")}"` : null,
    lastModified: stat?.lastModified ?? null
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
    await removeMinioObject(reference.bucket, reference.objectName);
    return true;
  } catch (error) {
    console.warn("No se pudo eliminar la foto de perfil anterior:", error?.message || error);
    return false;
  }
};
