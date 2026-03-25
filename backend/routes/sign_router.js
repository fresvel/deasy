import express from "express";
import multer  from "multer";
import os      from "os";
import { requestSign, downloadSigned } from "../controllers/sign/sign_controller.js";
import { validateToken }               from "../middlewares/val_token.js";

const router = express.Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB por archivo
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "pdf" && file.mimetype === "application/pdf") {
      return cb(null, true);
    }
    if (file.fieldname === "cert" && (
      file.mimetype === "application/x-pkcs12" ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.endsWith(".p12")
    )) {
      return cb(null, true);
    }
    cb(new Error(`Tipo de archivo no permitido: ${file.fieldname}`));
  },
});

// POST /easym/v1/sign — firmar un documento con uno o varios campos
router.post(
  "/",
  validateToken,
  upload.fields([
    { name: "pdf",  maxCount: 1 },
    { name: "cert", maxCount: 1 },
  ]),
  requestSign
);

// GET /easym/v1/sign/download?path=... — descargar/visualizar el PDF firmado
router.get("/download", validateToken, downloadSigned);

export default router;