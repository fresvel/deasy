// LA SUPERFICIE HTTP DE `firmas`: el acto de firmar un PDF, de a uno o en lote.
//
// ⚠️ SON SIETE DE LAS TRECE QUE CUELGAN DE `/sign`, y el reparto no es arbitrario. El router que
// habia --`routes/sign_router.js`-- mezclaba dos dominios:
//
//     POST /  ·  /validate  ·  /batch  ·  /batch/start                      firmas  (aqui)
//     GET  /batch/:jobId  ·  /batch/:jobId/download  ·  /download           firmas  (aqui)
//     POST /fill-requests/:id/{start,approve,return,reject,cancel}          tareas  (se queda)
//     GET  /documents/:dv/signature-flow                                    tareas  (se queda)
//
// Las seis de `fill-requests` y el `signature-flow` operan TURNOS y RECORRIDOS, que son tablas de
// `tareas`: se van con ese dominio cuando le toque su tanda. Hasta entonces `routes/sign_router.js`
// sigue siendo el punto de montaje y encadena este router con `router.use`, asi que **las URL no
// cambian** y ningun golden se mueve.
import express from "express";
import multer from "multer";
import os from "node:os";
import { authMiddleware } from "../../../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../../../middlewares/rbac.js";
import { badRequest } from "../../../errors/HttpError.js";
import {
  downloadSignBatch,
  downloadSigned,
  getSignBatchStatus,
  requestSign,
  requestSignBatch,
  requestSignBatchStart,
  validateSignedDocument
} from "../controllers/firma_controller.js";

const router = express.Router();

// CUANTOS DOCUMENTOS ADMITE UN LOTE, y es el unico sitio donde se dice.
//
// Eran **30**, escritos sueltos en los dos `maxCount` de abajo, y ese numero era una pared muda:
// medido el 2026-11-10, un lote de 31 documentos contestaba
// `{"message":"Se envió un archivo en un campo que no se esperaba.","code":"LIMIT_UNEXPECTED_FILE"}`
// --un 400 que habla de un CAMPO cuando el problema es la CUENTA--, porque exceder el `maxCount` de
// un campo es, para multer, un campo inesperado. Quien intentaba firmar 74 no tenia forma de
// deducir que el tope era 30.
//
// 200 sale de lo que la pantalla ya ofrece: «firmar todos los pendientes» no acota nada, y un lote
// de fin de semestre son decenas, no unidades. No es un limite de memoria --multer escribe cada PDF
// en disco (`dest`), no en RAM-- sino de tiempo y de disco temporal.
//
// ⚠️ VIAJA EMPAREJADO con `client_max_body_size` del proxy (200m, en
// `nginx/app-conf.d/default.conf.template` y en el ingress). Este acota DOCUMENTOS y aquel acota
// BYTES: subir uno sin el otro deja la pared en el mismo sitio con otro codigo de error.
export const MAX_DOCUMENTOS_POR_LOTE = 200;

const upload = multer({
  dest: os.tmpdir(),
  // `files` ademas de `fileSize` a proposito: pasarse de la cuenta cae en `LIMIT_FILE_COUNT`
  // --«Se enviaron mas archivos de los permitidos», que SI nombra el problema-- en vez de en el
  // `LIMIT_UNEXPECTED_FILE` que emite el `maxCount` del campo.
  limits: { fileSize: 30 * 1024 * 1024, files: MAX_DOCUMENTOS_POR_LOTE },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "pdf" && file.mimetype === "application/pdf") {
      return cb(null, true);
    }
    // 400 explícito: rechazar un fichero es culpa del cliente, no del servidor. Lo recoge
    // `handleUploadError` al final de `routes/sign_router.js`, que es quien monta esto.
    cb(badRequest(`Tipo de archivo no permitido en "${file.fieldname}": solo se aceptan PDF.`));
  }
});

router.post(
  "/",
  authMiddleware,
  loadAccessContext,
  requirePermissions("signature_flows.update"),
  upload.fields([{ name: "pdf", maxCount: 1 }]),
  requestSign
);

router.post(
  "/validate",
  authMiddleware,
  loadAccessContext,
  requirePermissions("signature_flows.read"),
  upload.fields([{ name: "pdf", maxCount: 1 }]),
  validateSignedDocument
);

router.post(
  "/batch",
  authMiddleware,
  loadAccessContext,
  requirePermissions("signature_flows.update"),
  upload.fields([{ name: "pdf", maxCount: MAX_DOCUMENTOS_POR_LOTE }]),
  requestSignBatch
);

router.post(
  "/batch/start",
  authMiddleware,
  loadAccessContext,
  requirePermissions("signature_flows.update"),
  upload.fields([{ name: "pdf", maxCount: MAX_DOCUMENTOS_POR_LOTE }]),
  requestSignBatchStart
);

router.get("/batch/:jobId", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), getSignBatchStatus);
router.get("/batch/:jobId/download", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), downloadSignBatch);

router.get("/download", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), downloadSigned);

// EL TOPE SE DICE CON SU CIFRA. `handleUploadError` --el de `middlewares/uploadError.js`, que recoge
// lo de todos los routers-- no puede nombrarla: no sabe cuanto vale el limite de cada uno. Aqui si.
//
// Traduce SOLO `LIMIT_FILE_COUNT`, que es el unico codigo que significa «te pasaste de la cuenta».
// `LIMIT_UNEXPECTED_FILE` se delega a proposito: lo emite tambien un campo con otro nombre, y
// contestar «divide el lote» a quien mando el fichero en `archivo` en vez de en `pdf` seria cambiar
// un mensaje inutil por uno falso.
//
// Va despues de las rutas porque Express reconoce los manejadores de error por su aridad de cuatro
// argumentos y los recorre en orden de registro.
// eslint-disable-next-line no-unused-vars -- aridad 4: asi lo distingue Express.
router.use((error, req, res, next) => {
  if (error?.code !== "LIMIT_FILE_COUNT") {
    return next(error);
  }
  console.error(`[firmas] ${req.method} ${req.originalUrl} rechazado por cuenta de archivos:`, error);
  return res.status(400).json({
    message: `Un lote admite hasta ${MAX_DOCUMENTOS_POR_LOTE} documentos en una sola tanda. Divide el lote y vuelve a enviarlo.`,
    code: error.code,
    maxDocumentos: MAX_DOCUMENTOS_POR_LOTE,
  });
});

export default router;
