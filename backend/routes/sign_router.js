// EL PUNTO DE MONTAJE DE `/sign`, y hoy reparte entre DOS dominios.
//
// Las siete rutas del acto de firmar --`POST /`, `/validate`, `/batch`, `/batch/start`,
// `GET /batch/:jobId`, `/batch/:jobId/download`, `/download`-- se fueron a `dominios/firmas/` en
// F7.5 (frente 22) y entran por su puerta. Las SEIS que quedan aqui operan TURNOS y RECORRIDOS, que
// son tablas de `tareas`: se iran con ese dominio cuando le toque su tanda.
//
// ⚠️ ESTE FICHERO SIGUE SIENDO EL PUNTO DE MONTAJE A PROPOSITO. Montar el router del dominio desde
// aqui con `router.use` mantiene **las URL exactamente como estaban**, asi que el contrato HTTP no
// se mueve ni un golden — que es la regla: un refactor no cambia un golden.
import express from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../middlewares/rbac.js";
import { handleUploadError } from "../middlewares/uploadError.js";
import { firmasRouter } from "../dominios/firmas/index.js";
import {
  approveFillRequest,
  cancelFillRequest,
  getSignatureFlow,
  rejectFillRequest,
  returnFillRequest,
  startFillRequest,
} from "../controllers/sign/sign_workflow_controller.js";

const router = express.Router();

// Primero el dominio `firmas`: sus siete rutas, con su propio `multer`.
router.use(firmasRouter);

// ── Lo que sigue es de `tareas` ─────────────────────────────────────────────────────────────────
router.post("/fill-requests/:requestId/start", authMiddleware, loadAccessContext, requirePermissions("fill_flows.update"), startFillRequest);
router.post("/fill-requests/:requestId/approve", authMiddleware, loadAccessContext, requirePermissions("fill_flows.update"), express.json(), approveFillRequest);
router.post("/fill-requests/:requestId/return", authMiddleware, loadAccessContext, requirePermissions("fill_flows.update"), express.json(), returnFillRequest);
router.post("/fill-requests/:requestId/reject", authMiddleware, loadAccessContext, requirePermissions("fill_flows.update"), express.json(), rejectFillRequest);
router.post("/fill-requests/:requestId/cancel", authMiddleware, loadAccessContext, requirePermissions("fill_flows.update"), express.json(), cancelFillRequest);

router.get("/documents/:documentVersionId/signature-flow", authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), getSignatureFlow);

// Va al final a proposito: recoge lo que multer rechaza en CUALQUIERA de las rutas de arriba,
// incluidas las del router del dominio.
router.use(handleUploadError);

export default router;
