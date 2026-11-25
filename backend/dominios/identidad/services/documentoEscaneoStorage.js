// El PDF del documento de identidad escaneado.
//
// Mismo patron que la foto de perfil y que los certificados P12: temporal del sistema -> objeto en
// el almacén -> borrado del temporal. Nada de estado local en el contenedor del backend.
//
// Y la MISMA convencion de referencia (`s3://<bucket>/<objeto>`), por el mismo motivo: guardar
// una URL publica meteria el endpoint del entorno dentro del dato.
//
// LA RUTA ES DERIVABLE; SU EXISTENCIA NO. Por eso la columna guarda la referencia en vez de
// calcularla al vuelo: `escaneo_ref` nula significa "no hay escaneo", y saberlo sin preguntarle a
// el almacén es lo que hace util el campo.

import fs from "fs-extra";
import {
  ensureBucketExists,
  getAlmacenObjectStream,
  removeAlmacenObject,
  statAlmacenObject,
  uploadFileToAlmacen
} from "../../../services/storage/almacen_service.js";
import { buildAlmacenReference, parseAlmacenReference } from "../../../services/storage/almacenReference.js";

export const ALMACEN_USERS_BUCKET = process.env.ALMACEN_USERS_BUCKET || "deasy-users";

const ALMACEN_NOT_FOUND_CODES = new Set(["NoSuchBucket", "NoSuchKey", "NotFound", "NoSuchObject"]);

// `users/<person_id>/documentos/<documento_id>.pdf`. Cuelga de los IDS y no del numero del
// documento: un pasaporte se renueva con numero nuevo y el fichero no tiene por que mudarse.
export const buildEscaneoObjectName = (personId, documentoId) =>
  `users/${Number(personId)}/documentos/${Number(documentoId)}.pdf`;

const esPdf = (filePath, mimetype) => {
  if (String(mimetype || "").toLowerCase() === "application/pdf") return true;
  return String(filePath || "").toLowerCase().endsWith(".pdf");
};

// Sube el escaneo y devuelve su referencia. Solo PDF: un documento de identidad escaneado se
// archiva, y un formato que no todos los visores abren igual no sirve para archivar.
export const storeEscaneo = async ({ personId, documentoId, filePath, mimetype }) => {
  if (!esPdf(filePath, mimetype)) {
    const error = new Error("El escaneo del documento debe ser un PDF.");
    error.code = "UNSUPPORTED_SCAN";
    error.status = 400;
    error.statusCode = 400;
    throw error;
  }
  const objectName = buildEscaneoObjectName(personId, documentoId);
  await ensureBucketExists(ALMACEN_USERS_BUCKET);
  await uploadFileToAlmacen(ALMACEN_USERS_BUCKET, objectName, filePath, {
    "Content-Type": "application/pdf"
  });
  return { objectName, reference: buildAlmacenReference(ALMACEN_USERS_BUCKET, objectName) };
};

// Abre el escaneo para hacerle stream. Devuelve null cuando la referencia esta vacia o el objeto ya
// no existe, para que el handler responda 404 en vez de reventar.
export const openEscaneo = async (rawValue) => {
  const reference = parseAlmacenReference(rawValue);
  if (!reference) return null;

  try {
    await statAlmacenObject(reference.bucket, reference.objectName);
  } catch (error) {
    if (ALMACEN_NOT_FOUND_CODES.has(error?.code)) return null;
    throw error;
  }

  return {
    stream: await getAlmacenObjectStream(reference.bucket, reference.objectName),
    contentType: "application/pdf",
    objectName: reference.objectName
  };
};

// Borra el objeto anterior. No bloquea ni propaga: perder el escaneo viejo es menos grave que
// dejar a la persona sin el nuevo.
export const removeEscaneo = async (rawValue) => {
  const reference = parseAlmacenReference(rawValue);
  if (!reference) return;
  try {
    await removeAlmacenObject(reference.bucket, reference.objectName);
  } catch (error) {
    if (!ALMACEN_NOT_FOUND_CODES.has(error?.code)) {
      console.error("No se pudo borrar el escaneo anterior:", error.message);
    }
  }
};

export const limpiarTemporal = async (filePath) => {
  if (filePath) await fs.remove(filePath).catch(() => {});
};
