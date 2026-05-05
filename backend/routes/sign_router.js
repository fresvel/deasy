import express from "express";
import multer from "multer";
import os from "os";
import { authMiddleware } from "../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../middlewares/rbac.js";
import {
  downloadSignBatch,
  downloadSigned,
  getSignBatchStatus,
  getSignatureFlow,
  requestSign,
  requestSignBatch,
  requestSignBatchStart,
  validateSignedDocument
} from "../controllers/sign/sign_controller.js";
import {
  approveFillRequest,
  cancelFillRequest,
  rejectFillRequest,
  returnFillRequest,
  startFillRequest,
} from "../controllers/sign/sign_workflow_controller.js";

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "pdf" && file.mimetype === "application/pdf") {
      return cb(null, true);
    }
    cb(new Error(`Tipo de archivo no permitido: ${file.fieldname}`));
  }
});

router.post(
  "/",
  authMiddleware,
  loadAccessContext,
  requirePermissions("documents.update"),
  upload.fields([{ name: "pdf", maxCount: 1 }]),
  requestSign
);

router.post(
  "/validate",
  authMiddleware,
  loadAccessContext,
  requirePermissions("documents.read"),
  upload.fields([{ name: "pdf", maxCount: 1 }]),
  validateSignedDocument
);

router.post(
  "/batch",
  authMiddleware,
  loadAccessContext,
  requirePermissions("documents.update"),
  upload.fields([{ name: "pdf", maxCount: 30 }]),
  requestSignBatch
);

router.post(
  "/batch/start",
  authMiddleware,
  loadAccessContext,
  requirePermissions("documents.update"),
  upload.fields([{ name: "pdf", maxCount: 30 }]),
  requestSignBatchStart
);

router.get("/batch/:jobId", authMiddleware, loadAccessContext, requirePermissions("documents.read"), getSignBatchStatus);
router.get("/batch/:jobId/download", authMiddleware, loadAccessContext, requirePermissions("documents.read"), downloadSignBatch);

router.post("/fill-requests/:requestId/start", authMiddleware, loadAccessContext, requirePermissions("documents.update"), startFillRequest);
router.post("/fill-requests/:requestId/approve", authMiddleware, loadAccessContext, requirePermissions("documents.update"), express.json(), approveFillRequest);
router.post("/fill-requests/:requestId/return", authMiddleware, loadAccessContext, requirePermissions("documents.update"), express.json(), returnFillRequest);
router.post("/fill-requests/:requestId/reject", authMiddleware, loadAccessContext, requirePermissions("documents.update"), express.json(), rejectFillRequest);
router.post("/fill-requests/:requestId/cancel", authMiddleware, loadAccessContext, requirePermissions("documents.update"), express.json(), cancelFillRequest);

router.get("/download", authMiddleware, loadAccessContext, requirePermissions("documents.read"), downloadSigned);
router.get("/documents/:documentVersionId/signature-flow", authMiddleware, loadAccessContext, requirePermissions("documents.read"), getSignatureFlow);

export default router;
