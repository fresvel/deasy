// Recepcion de la foto de perfil. El fichero aterriza en un temporal del sistema y
// de ahi sube a MinIO (profilePhotoStorage): no queda estado en el disco del backend.
// Mismo patron que los certificados P12 y los PDF del dossier.
//
// El filtro por mimetype solo descarta lo evidente; el formato real se decide luego
// por la firma del fichero, porque el mimetype lo declara el cliente.
import multer from "multer";
import os from "node:os";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Formato de imagen no permitido. Usa PNG, JPG o WEBP."));
};

export const uploadProfilePhoto = multer({
  dest: os.tmpdir(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});
