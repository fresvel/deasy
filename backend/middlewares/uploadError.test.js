// Red del manejador de errores de subida. Lo que se fija es que NADA técnico salga hacia el
// cliente: ni stack, ni rutas del contenedor, ni el mensaje interno de un fallo del servidor.
import test from "node:test";
import assert from "node:assert/strict";
import multer from "multer";

import { describeUploadError, handleUploadError } from "./uploadError.js";

const multerError = (code) => new multer.MulterError(code);

test("un límite de multer es 400 con mensaje en español y su código estable", () => {
  const descrito = describeUploadError(multerError("LIMIT_FILE_SIZE"));
  assert.equal(descrito.status, 400);
  assert.equal(descrito.code, "LIMIT_FILE_SIZE");
  assert.match(descrito.message, /tamaño máximo/);
});

test("un código de multer desconocido cae en el mensaje genérico, sin inventar texto", () => {
  const descrito = describeUploadError(multerError("LIMIT_LO_QUE_SEA"));
  assert.equal(descrito.status, 400);
  assert.equal(descrito.message, "No se pudo procesar el archivo enviado.");
});

test("un rechazo del fileFilter con statusCode respeta ese código y su mensaje", () => {
  const rechazo = Object.assign(new Error("Tipo de archivo no permitido en \"pdf\": solo se aceptan PDF."), { statusCode: 400 });
  const descrito = describeUploadError(rechazo);
  assert.equal(descrito.status, 400);
  assert.equal(descrito.message, rechazo.message);
  assert.equal(descrito.code, "UPLOAD_REJECTED");
});

test("un error SIN statusCode es 500 y su mensaje interno NO viaja al cliente", () => {
  const descrito = describeUploadError(new Error("ENOENT: /app/backend/tmp/upload-xyz"));
  assert.equal(descrito.status, 500);
  assert.equal(descrito.message, "No se pudo procesar el archivo enviado.");
  assert.ok(!descrito.message.includes("/app/"));
});

// --- el middleware --------------------------------------------------------------------------

const fakeRes = () => {
  const res = { headersSent: false, statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
};
const fakeReq = { method: "POST", originalUrl: "/deasy/v1/sign" };

test("responde JSON con las dos claves del contrato y nada más", () => {
  const res = fakeRes();
  handleUploadError(multerError("LIMIT_UNEXPECTED_FILE"), fakeReq, res, () => assert.fail("no debe delegar"));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(Object.keys(res.body).sort(), ["code", "message"]);
});

test("si la respuesta ya empezó, delega en Express en vez de escribir encima", () => {
  const res = fakeRes();
  res.headersSent = true;
  let delegado = null;
  const error = new Error("tarde");
  handleUploadError(error, fakeReq, res, (err) => { delegado = err; });
  assert.equal(delegado, error);
  assert.equal(res.statusCode, null);
});
