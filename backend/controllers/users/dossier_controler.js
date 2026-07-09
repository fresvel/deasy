// Dossier / expediente personal sobre el núcleo relacional (Fase 6, ex-MongoDB).
// Los datos van por dossierStore (2 tablas: dossiers + dossier_items JSONB);
// MinIO sigue guardando los PDFs. Engine-transparente vía el adaptador.
import * as Minio from "minio";
import fs from "node:fs";
import * as store from "../../services/users/dossierStore.js";

// --- MinIO: cliente, constantes y helpers (sin cambios respecto a la versión Mongo) ---
const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://localhost:9000");
const minioUseSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || minioUrl.protocol === "https:";
const minioClient = new Minio.Client({
  endPoint: minioUrl.hostname,
  port: Number(minioUrl.port || (minioUseSSL ? 443 : 80)),
  useSSL: minioUseSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD,
});

const MINIO_DOSSIER_BUCKET = process.env.MINIO_DOSSIER_BUCKET || "deasy-dossier";
const MINIO_DOSSIER_PREFIX = process.env.MINIO_DOSSIER_PREFIX || "Dosier";
const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT || "http://localhost:9000";

const VALID_DOCUMENT_TYPES = [
  "titulo", "experiencia", "referencia", "formacion",
  "certificacion", "articulo", "libro", "ponencia", "tesis", "proyecto",
];

// tipoDocumento (singular) -> sección (nombre de tabla lógica en dossier_items)
const TIPO_TO_SECTION = {
  titulo: "titulos", experiencia: "experiencia", referencia: "referencias",
  formacion: "formacion", certificacion: "certificaciones", articulo: "articulos",
  libro: "libros", ponencia: "ponencias", tesis: "tesis", proyecto: "proyectos",
};
// sección -> tipoDocumento (para la convención de nombre de objeto MinIO)
const SECTION_TO_TIPO = Object.fromEntries(Object.entries(TIPO_TO_SECTION).map(([t, s]) => [s, t]));

const removeMinioObject = (bucket, objectName) =>
  new Promise((resolve, reject) => minioClient.removeObject(bucket, objectName, (e) => (e ? reject(e) : resolve(true))));
const statMinioObject = (bucket, objectName) =>
  new Promise((resolve, reject) => minioClient.statObject(bucket, objectName, (e, stat) => (e ? reject(e) : resolve(stat))));
const uploadFileToMinIO = (bucket, objectName, filePath, metadata = {}) =>
  new Promise((resolve, reject) => minioClient.fPutObject(bucket, objectName, filePath, metadata, (e, etag) => (e ? reject(e) : resolve(etag))));
const ensureBucketExists = (bucket) =>
  new Promise((resolve, reject) =>
    minioClient.bucketExists(bucket, (e, exists) => {
      if (e) return reject(e);
      if (exists) return resolve(true);
      minioClient.makeBucket(bucket, "", (me) => (me ? reject(me) : resolve(true)));
    })
  );

const buildDossierObjectName = (cedula, tipoDocumento, registroId) =>
  `${MINIO_DOSSIER_PREFIX}/users/${cedula}/${tipoDocumento}/${registroId}.pdf`;
const buildDossierFileUrl = (objectName) => `${MINIO_PUBLIC_ENDPOINT}/${MINIO_DOSSIER_BUCKET}/${objectName}`;

function resolveDossierObjectNameFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const fromPath = (rawPath) => {
    const normalized = String(rawPath || "").replace(/^\/+/, "");
    const bucketPrefix = `${MINIO_DOSSIER_BUCKET}/`;
    return normalized.startsWith(bucketPrefix) ? normalized.slice(bucketPrefix.length) : normalized || null;
  };
  try { return fromPath(new URL(fileUrl).pathname); } catch { return fromPath(fileUrl); }
}

const NOT_FOUND_CODES = ["NoSuchBucket", "NoSuchKey", "NotFound", "NoSuchObject"];

async function removeDossierDocument({ cedula, tipoDocumento, registroId, fileUrl }) {
  const objectName = cedula && tipoDocumento && registroId
    ? buildDossierObjectName(cedula, tipoDocumento, registroId)
    : resolveDossierObjectNameFromUrl(fileUrl);
  if (!objectName) return false;
  try {
    await removeMinioObject(MINIO_DOSSIER_BUCKET, objectName);
    return true;
  } catch (error) {
    if (NOT_FOUND_CODES.includes(error?.code)) {
      const fallback = resolveDossierObjectNameFromUrl(fileUrl);
      if (fallback && fallback !== objectName) {
        try { await removeMinioObject(MINIO_DOSSIER_BUCKET, fallback); return true; } catch { return false; }
      }
      return false;
    }
    throw error;
  }
}

async function objectExists(bucket, objectName) {
  try { await statMinioObject(bucket, objectName); return true; }
  catch (error) { if (NOT_FOUND_CODES.includes(error?.code)) return false; throw error; }
}

// Rehidrata url_documento faltantes consultando MinIO por convención de nombre
// ({cedula}/{tipoDoc}/{id}.pdf) y persiste la url encontrada. Opera sobre el árbol.
async function hydrateTree(tree, dossier) {
  const groups = [
    ["titulos", tree.titulos], ["experiencia", tree.experiencia], ["referencias", tree.referencias],
    ["formacion", tree.formacion], ["certificaciones", tree.certificaciones],
    ["articulos", tree.investigacion.articulos], ["libros", tree.investigacion.libros],
    ["ponencias", tree.investigacion.ponencias], ["tesis", tree.investigacion.tesis],
    ["proyectos", tree.investigacion.proyectos],
  ];
  for (const [section, items] of groups) {
    const tipo = SECTION_TO_TIPO[section];
    for (const item of items) {
      if (item.url_documento) continue;
      const objectName = buildDossierObjectName(tree.cedula, tipo, item._id);
      if (await objectExists(MINIO_DOSSIER_BUCKET, objectName)) {
        const url = buildDossierFileUrl(objectName);
        item.url_documento = url;
        await store.setItemUrl(item._id, dossier.id, section, url);
      }
    }
  }
}

async function loadTreeHydrated(dossier) {
  const tree = await store.loadTree(dossier);
  await hydrateTree(tree, dossier);
  return tree;
}

const fail = (res, status, message, error) => res.status(status).json({ success: false, message, ...(error ? { error } : {}) });

// --- GET raíz ---
export const getDossierByUser = async (req, res) => {
  try {
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    res.json({ success: true, data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error("Error al obtener dossier:", error);
    fail(res, 500, "Error al obtener dossier", error.message);
  }
};

// --- Fábrica de add/update/delete por sección ---
const makeAdd = (section, okMsg, errMsg, validate = null) => async (req, res) => {
  try {
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    if (validate) { const v = validate(req.body); if (v) return fail(res, 400, v); }
    await store.addItem(dossier.id, section, req.body);
    res.json({ success: true, message: okMsg, data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error(errMsg, error);
    fail(res, 500, errMsg, error.message);
  }
};

const makeUpdate = (section, idParam, okMsg, notFoundMsg, errMsg) => async (req, res) => {
  try {
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    const ok = await store.updateItem(req.params[idParam], dossier.id, section, req.body);
    if (!ok) return fail(res, 404, notFoundMsg);
    res.json({ success: true, message: okMsg, data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error(errMsg, error);
    fail(res, 500, errMsg, error.message);
  }
};

const makeDelete = (section, idParam, okMsg, notFoundMsg, errMsg) => async (req, res) => {
  try {
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    const item = await store.findItem(req.params[idParam], dossier.id, section);
    if (!item) return fail(res, 404, notFoundMsg);
    if (item.url_documento) {
      await removeDossierDocument({ cedula: req.params.cedula, tipoDocumento: SECTION_TO_TIPO[section], registroId: item.id, fileUrl: item.url_documento });
    }
    await store.deleteItem(req.params[idParam], dossier.id, section);
    res.json({ success: true, message: okMsg, data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error(errMsg, error);
    fail(res, 500, errMsg, error.message);
  }
};

// Títulos
export const addTitulo = makeAdd("titulos", "Título agregado correctamente", "Error al agregar título");
export const updateTitulo = makeUpdate("titulos", "tituloId", "Título actualizado correctamente", "Título no encontrado", "Error al actualizar título");
export const deleteTitulo = makeDelete("titulos", "tituloId", "Título eliminado correctamente", "Título no encontrado", "Error al eliminar título");
// Experiencia
export const addExperiencia = makeAdd("experiencia", "Experiencia agregada correctamente", "Error al agregar experiencia");
export const updateExperiencia = makeUpdate("experiencia", "experienciaId", "Experiencia actualizada", "Experiencia no encontrada", "Error al actualizar experiencia");
export const deleteExperiencia = makeDelete("experiencia", "experienciaId", "Experiencia eliminada", "Experiencia no encontrada", "Error al eliminar experiencia");
// Referencias (valida tipo enum al agregar)
const validateReferencia = (body) => {
  const tipos = ["laboral", "personal", "familiar"];
  if (body?.tipo && !tipos.includes(body.tipo)) return `Tipo de referencia inválido: "${body.tipo}". Debe ser uno de: ${tipos.join(", ")}`;
  return null;
};
export const addReferencia = makeAdd("referencias", "Referencia agregada correctamente", "Error al agregar referencia", validateReferencia);
export const updateReferencia = makeUpdate("referencias", "referenciaId", "Referencia actualizada", "Referencia no encontrada", "Error al actualizar referencia");
export const deleteReferencia = makeDelete("referencias", "referenciaId", "Referencia eliminada", "Referencia no encontrada", "Error al eliminar referencia");
// Formación
export const addFormacion = makeAdd("formacion", "Formación agregada correctamente", "Error al agregar formación");
export const updateFormacion = makeUpdate("formacion", "formacionId", "Formación actualizada", "Formación no encontrada", "Error al actualizar formación");
export const deleteFormacion = makeDelete("formacion", "formacionId", "Formación eliminada", "Formación no encontrada", "Error al eliminar formación");
// Certificaciones
export const addCertificacion = makeAdd("certificaciones", "Certificación agregada correctamente", "Error al agregar certificación");
export const updateCertificacion = makeUpdate("certificaciones", "certificacionId", "Certificación actualizada", "Certificación no encontrada", "Error al actualizar certificación");
export const deleteCertificacion = makeDelete("certificaciones", "certificacionId", "Certificación eliminada", "Certificación no encontrada", "Error al eliminar certificación");

// --- Investigación (:tipo ∈ articulos/libros/ponencias/tesis/proyectos) ---
const validInvestigacionTipo = (tipo) => store.INVESTIGACION_SECTIONS.includes(tipo);

export const addInvestigacionItem = async (req, res) => {
  try {
    const { tipo } = req.params;
    if (!validInvestigacionTipo(tipo)) return fail(res, 400, `Tipo de investigación inválido: "${tipo}"`);
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    await store.addItem(dossier.id, tipo, req.body);
    res.json({ success: true, message: "Item de investigación agregado correctamente", data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error("Error al agregar item de investigación:", error);
    fail(res, 500, "Error al agregar item de investigación", error.message);
  }
};

export const updateInvestigacionItem = async (req, res) => {
  try {
    const { tipo, itemId } = req.params;
    if (!validInvestigacionTipo(tipo)) return fail(res, 400, `Tipo de investigación inválido: "${tipo}"`);
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    const ok = await store.updateItem(itemId, dossier.id, tipo, req.body);
    if (!ok) return fail(res, 404, "Item de investigación no encontrado");
    res.json({ success: true, message: "Item de investigación actualizado", data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error("Error al actualizar item de investigación:", error);
    fail(res, 500, "Error al actualizar item de investigación", error.message);
  }
};

export const deleteInvestigacionItem = async (req, res) => {
  try {
    const { tipo, itemId } = req.params;
    if (!validInvestigacionTipo(tipo)) return fail(res, 400, `Tipo de investigación inválido: "${tipo}"`);
    const dossier = await store.getOrCreateDossier(req.params.cedula);
    if (!dossier) return fail(res, 404, "Usuario no encontrado");
    const item = await store.findItem(itemId, dossier.id, tipo);
    if (!item) return fail(res, 404, "Item de investigación no encontrado");
    if (item.url_documento) {
      await removeDossierDocument({ cedula: req.params.cedula, tipoDocumento: SECTION_TO_TIPO[tipo], registroId: item.id, fileUrl: item.url_documento });
    }
    await store.deleteItem(itemId, dossier.id, tipo);
    res.json({ success: true, message: "Item de investigación eliminado", data: await loadTreeHydrated(dossier) });
  } catch (error) {
    console.error("Error al eliminar item de investigación:", error);
    fail(res, 500, "Error al eliminar item de investigación", error.message);
  }
};

// --- Documentos (MinIO) ---
export const uploadDossierDocument = async (req, res) => {
  try {
    const { cedula, tipoDocumento, registroId } = req.params;
    if (!cedula || !tipoDocumento || !registroId) return fail(res, 400, "Faltan parámetros requeridos: cedula, tipoDocumento, registroId");
    if (!VALID_DOCUMENT_TYPES.includes(tipoDocumento)) return fail(res, 400, `Tipo de documento inválido. Tipos válidos: ${VALID_DOCUMENT_TYPES.join(", ")}`);
    if (!req.file) return fail(res, 400, "No se ha proporcionado ningún archivo");
    if (req.file.mimetype !== "application/pdf") return fail(res, 400, "Solo se permiten archivos PDF");

    const section = TIPO_TO_SECTION[tipoDocumento];
    const dossier = await store.findDossierByCedula(cedula);
    if (!dossier) { fs.unlink(req.file.path, () => {}); return fail(res, 404, "Dossier no encontrado para esta cédula"); }
    const item = await store.findItem(registroId, dossier.id, section);
    if (!item) { fs.unlink(req.file.path, () => {}); return fail(res, 404, `Registro con ID ${registroId} no encontrado en ${tipoDocumento}`); }

    const objectName = buildDossierObjectName(cedula, tipoDocumento, registroId);
    await ensureBucketExists(MINIO_DOSSIER_BUCKET);
    await uploadFileToMinIO(MINIO_DOSSIER_BUCKET, objectName, req.file.path);
    const fileUrl = buildDossierFileUrl(objectName);
    fs.unlink(req.file.path, () => {});

    await store.setItemUrl(registroId, dossier.id, section, fileUrl);
    res.json({ success: true, message: "Documento subido correctamente", url: fileUrl });
  } catch (error) {
    console.error("Error al subir documento:", error);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    fail(res, 500, "Error al subir documento", error.message);
  }
};

export const getDossierDocumentUrl = async (req, res) => {
  try {
    const { cedula, tipoDocumento, registroId } = req.params;
    if (!cedula || !tipoDocumento || !registroId) return fail(res, 400, "Faltan parámetros requeridos: cedula, tipoDocumento, registroId");
    if (!VALID_DOCUMENT_TYPES.includes(tipoDocumento)) return fail(res, 400, `Tipo de documento inválido. Tipos válidos: ${VALID_DOCUMENT_TYPES.join(", ")}`);
    const objectName = buildDossierObjectName(cedula, tipoDocumento, registroId);
    try {
      await new Promise((resolve, reject) => {
        minioClient.getObject(MINIO_DOSSIER_BUCKET, objectName, (err, dataStream) => {
          if (err) return reject(err);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `inline; filename="${registroId}.pdf"`);
          dataStream.pipe(res);
          dataStream.on("end", resolve);
          dataStream.on("error", reject);
        });
      });
    } catch (error) {
      console.error("Error al obtener archivo:", error.message);
      return fail(res, 404, "Error al leer documento: " + error.message);
    }
  } catch (error) {
    console.error("Error al obtener URL del documento:", error);
    fail(res, 500, "Error al obtener URL del documento", error.message);
  }
};

export const deleteDossierDocumentOnly = async (req, res) => {
  try {
    const { cedula, tipoDocumento, registroId } = req.params;
    if (!cedula || !tipoDocumento || !registroId) return fail(res, 400, "Faltan parámetros requeridos: cedula, tipoDocumento, registroId");
    if (!VALID_DOCUMENT_TYPES.includes(tipoDocumento)) return fail(res, 400, `Tipo de documento inválido. Tipos válidos: ${VALID_DOCUMENT_TYPES.join(", ")}`);
    const section = TIPO_TO_SECTION[tipoDocumento];
    const dossier = await store.findDossierByCedula(cedula);
    if (!dossier) return fail(res, 404, "Dossier no encontrado");
    const item = await store.findItem(registroId, dossier.id, section);
    if (!item) return fail(res, 404, "Registro no encontrado");
    if (item.url_documento) {
      await removeDossierDocument({ cedula, tipoDocumento, registroId, fileUrl: item.url_documento });
      await store.setItemUrl(registroId, dossier.id, section, "");
    }
    res.json({ success: true, message: "Documento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar documento:", error);
    fail(res, 500, "Error al eliminar documento", error.message);
  }
};
