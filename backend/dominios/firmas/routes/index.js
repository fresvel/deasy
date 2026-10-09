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

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 30 * 1024 * 1024 },
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
  upload.fields([{ name: "pdf", maxCount: 30 }]),
  requestSignBatch
);

router.post(
  "/batch/start",
  authMiddleware,
  loadAccessContext,
  requirePermissions("signature_flows.update"),
  upload.fields([{ name: "pdf", maxCount: 30 }]),
  requestSignBatchStart
);

router.get("/batch/:jobId", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), getSignBatchStatus);
router.get("/batch/:jobId/download", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), downloadSignBatch);

router.get("/download", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), downloadSigned);

export default router;
