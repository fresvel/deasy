import express from "express";
import multer from "multer";
import os from "os";
import { authMiddleware } from "../middlewares/auth.js";
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
  upload.fields([{ name: "pdf", maxCount: 1 }]),
  requestSign
);

router.post(
  "/validate",
  authMiddleware,
  upload.fields([{ name: "pdf", maxCount: 1 }]),
  validateSignedDocument
);

router.post(
  "/batch",
  authMiddleware,
  upload.fields([{ name: "pdf", maxCount: 30 }]),
  requestSignBatch
);

router.post(
  "/batch/start",
  authMiddleware,
  upload.fields([{ name: "pdf", maxCount: 30 }]),
  requestSignBatchStart
);

router.get("/batch/:jobId", authMiddleware, getSignBatchStatus);
router.get("/batch/:jobId/download", authMiddleware, downloadSignBatch);

router.post("/fill-requests/:requestId/start", authMiddleware, startFillRequest);
router.post("/fill-requests/:requestId/approve", authMiddleware, express.json(), approveFillRequest);
router.post("/fill-requests/:requestId/return", authMiddleware, express.json(), returnFillRequest);
router.post("/fill-requests/:requestId/reject", authMiddleware, express.json(), rejectFillRequest);
router.post("/fill-requests/:requestId/cancel", authMiddleware, express.json(), cancelFillRequest);

router.get("/download", authMiddleware, downloadSigned);
router.get("/documents/:documentVersionId/signature-flow", authMiddleware, getSignatureFlow);

export default router;
