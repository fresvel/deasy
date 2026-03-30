import express from "express";
import multer from "multer";
import os from "os";
import { authMiddleware } from "../middlewares/auth.js";
import {
  downloadSignBatch,
  downloadSigned,
  getSignBatchStatus,
  requestSign,
  requestSignBatch,
  requestSignBatchStart
} from "../controllers/sign/sign_controller.js";

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

router.get("/download", authMiddleware, downloadSigned);

export default router;
