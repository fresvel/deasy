// Manejador de errores de subida (multer) — para que un fichero rechazado NO acabe en la página de
// error por defecto de Express.
//
// POR QUÉ EXISTE. El `fileFilter` de los routers rechaza llamando a `cb(error)`. Multer propaga ese
// error con `next(err)` y, si nadie lo recoge, Express contesta **HTML con el stack trace completo**:
// rutas absolutas dentro del contenedor, números de línea y nombres de fichero del servidor. Es una
// fuga de información, y además el cliente recibe HTML donde espera JSON. Lo destapó
// `tests/characterization/flows/zzzz_sign_batch.test.mjs` (`sign_mimetype_rechazado`).
//
// CONTRATO. Responde con la forma objetivo de `docs/contrato-errores-api.md` §4: `{ message, code }`,
// mensaje en español para la persona y código estable para que el cliente ramifique. El detalle
// técnico se queda en el log del servidor, que es su sitio.
//
// USO: registrarlo con `router.use(handleUploadError)` DESPUÉS de las rutas del router; Express
// reconoce los manejadores de error por su aridad de cuatro argumentos.
import multer from "multer";

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "El archivo supera el tamaño máximo permitido.",
  LIMIT_FILE_COUNT: "Se enviaron más archivos de los permitidos.",
  LIMIT_PART_COUNT: "El formulario tiene más partes de las permitidas.",
  LIMIT_FIELD_KEY: "El nombre de uno de los campos es demasiado largo.",
  LIMIT_FIELD_VALUE: "El valor de uno de los campos es demasiado largo.",
  LIMIT_FIELD_COUNT: "El formulario tiene más campos de los permitidos.",
  LIMIT_UNEXPECTED_FILE: "Se envió un archivo en un campo que no se esperaba.",
};

const GENERIC_MESSAGE = "No se pudo procesar el archivo enviado.";

export const describeUploadError = (error) => {
  if (error instanceof multer.MulterError) {
    return {
      status: 400,
      message: MULTER_MESSAGES[error.code] || GENERIC_MESSAGE,
      code: error.code,
    };
  }
  const status = error?.statusCode ?? 500;
  return {
    status,
    // Un 5xx no cuenta nada: el mensaje interno se queda en el log.
    message: status >= 500 ? GENERIC_MESSAGE : (error?.message || GENERIC_MESSAGE),
    code: error?.code || "UPLOAD_REJECTED",
  };
};

// eslint-disable-next-line no-unused-vars -- Express distingue los manejadores de error por aridad 4.
export const handleUploadError = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  const { status, message, code } = describeUploadError(error);
  console.error(`[upload] ${req.method} ${req.originalUrl} rechazado (${status}):`, error);
  return res.status(status).json({ message, code });
};
