import express from "express";
import multer  from "multer";
import os      from "os";
import { requestSign }   from "../controllers/sign/sign_controller.js";
import { validateToken } from "../middlewares/val_token.js";

const router = express.Router();

// multer guarda los archivos temporalmente en la carpeta temp del sistema
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB máximo por archivo
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

// POST /easym/v1/sign
router.post(
  "/",
  validateToken,
  upload.fields([
    { name: "pdf",  maxCount: 1 },
    { name: "cert", maxCount: 1 },
  ]),
  requestSign
);

export default router;