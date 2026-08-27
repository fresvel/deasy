// Recepcion del PDF del documento de identidad escaneado. Aterriza en un temporal del sistema y de
// ahi sube a MinIO (`documentoEscaneoStorage`): no queda estado en el disco del backend. Mismo
// patron que la foto de perfil, los certificados P12 y los PDF del expediente.
//
// El filtro por mimetype solo descarta lo evidente —lo declara el cliente—; `storeEscaneo` vuelve a
// comprobar que es PDF antes de subirlo.
import multer from "multer";
import os from "node:os";

const fileFilter = (_req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
    return;
  }
  cb(new Error("El escaneo del documento debe ser un PDF."));
};

export const uploadEscaneoDocumento = multer({
  dest: os.tmpdir(),
  fileFilter,
  // 10 MB: un documento escaneado a resolucion razonable cabe de sobra, y el limite existe para que
  // una subida enorme no llene el temporal del contenedor.
  limits: { fileSize: 10 * 1024 * 1024 }
});
