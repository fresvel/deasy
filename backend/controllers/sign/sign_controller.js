import * as Minio from "minio";
import { randomUUID } from "crypto";
import fs from "fs";

// ── Configuración de MinIO ────────────────────────────────────────────────────
const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://minio:9000");
const useSSL   = minioUrl.protocol === "https:";

const minioClient = new Minio.Client({
  endPoint:  minioUrl.hostname,
  port:      Number(minioUrl.port || (useSSL ? 443 : 80)),
  useSSL,
  accessKey: process.env.MINIO_ACCESS_KEY || "deasy_minio",
  secretKey: process.env.MINIO_SECRET_KEY || "deasy_minio_secret",
});

const SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || "deasy-spool";
const SIGNER_URL   = process.env.SIGNER_URL          || "http://signer:4000";

// ── Subir archivo local a MinIO ───────────────────────────────────────────────
const uploadToMinio = (objectName, localPath) =>
  new Promise((resolve, reject) => {
    minioClient.fPutObject(SPOOL_BUCKET, objectName, localPath, {}, (err, etag) => {
      if (err) reject(new Error(`Error subiendo a MinIO (${objectName}): ${err.message}`));
      else resolve(etag);
    });
  });

// ── Asegurar que el bucket existe ─────────────────────────────────────────────
const ensureBucket = () =>
  new Promise((resolve, reject) => {
    minioClient.bucketExists(SPOOL_BUCKET, (err, exists) => {
      if (err) return reject(err);
      if (exists) return resolve();
      minioClient.makeBucket(SPOOL_BUCKET, "", (makeErr) => {
        if (makeErr) reject(makeErr);
        else resolve();
      });
    });
  });

// ── Firmar un campo individual ────────────────────────────────────────────────
const signField = async ({ minioPdfPath, minioCertPath, certPassword, stampText, finalPath, coordinates }) => {
  const response = await fetch(`${SIGNER_URL}/sign`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      signType: "coordinates",
      minioPdfPath,
      minioCertPath,
      certPassword,
      stampText,
      finalPath,
      coordinates,
    }),
  });
  const result = await response.json();
  if (result.status !== "success") {
    throw new Error(result.message || "El signer reportó un error");
  }
  return result;
};

/**
 * POST /easym/v1/sign
 *
 * Campos multipart/form-data:
 *   pdf       (archivo) — PDF a firmar
 *   cert      (archivo) — Certificado .p12
 *   password  (texto)   — Contraseña del .p12
 *   stampText (texto)   — Nombre del firmante para el sello
 *   fields    (JSON)    — Array de { page, x, y } con todos los campos de firma
 */
export const requestSign = async (req, res) => {
  if (!req.files?.pdf?.[0] || !req.files?.cert?.[0]) {
    return res.status(400).json({ error: "Se requieren los archivos 'pdf' y 'cert'." });
  }
  const { password, stampText } = req.body;
  if (!password || !stampText) {
    return res.status(400).json({ error: "Faltan campos: password, stampText." });
  }

  // Parsear campos de firma
  let signFields;
  try {
    signFields = JSON.parse(req.body.fields || "[]");
    if (!Array.isArray(signFields) || signFields.length === 0) {
      return res.status(400).json({ error: "Debe incluir al menos un campo de firma en 'fields'." });
    }
  } catch {
    return res.status(400).json({ error: "El campo 'fields' debe ser un JSON válido." });
  }

  const pdfFile  = req.files.pdf[0];
  const certFile = req.files.cert[0];
  const sessionId     = randomUUID();
  const minioPdfPath  = `Firmas/spool/${sessionId}/input.pdf`;
  const minioCertPath = `Firmas/spool/${sessionId}/cert.p12`;
  const finalPath     = `${process.env.MINIO_PUBLIC_ENDPOINT || "http://localhost:9000"}/${SPOOL_BUCKET}/${minioPdfPath}`;

  try {
    await ensureBucket();
    await uploadToMinio(minioPdfPath,  pdfFile.path);
    await uploadToMinio(minioCertPath, certFile.path);

    // Firmar cada campo secuencialmente — el signer sobreescribe el mismo
    // minioPdfPath en MinIO, por lo que cada firma se aplica sobre el PDF
    // ya firmado anteriormente.
    console.log(`[sign_controller] Firmando ${signFields.length} campo(s) — sesión ${sessionId}`);
    let lastResult;
    for (let i = 0; i < signFields.length; i++) {
      const f = signFields[i];
      console.log(`[sign_controller] Campo ${i + 1}/${signFields.length}: pág=${f.page} x=${f.x} y=${f.y}`);
      lastResult = await signField({
        minioPdfPath,
        minioCertPath,
        certPassword: password,
        stampText,
        finalPath,
        coordinates: { page: Number(f.page), x: Number(f.x), y: Number(f.y) },
      });
    }

    fs.unlink(pdfFile.path,  () => {});
    fs.unlink(certFile.path, () => {});

    return res.status(200).json({
      message:     `PDF firmado exitosamente con ${signFields.length} campo(s).`,
      signedPath:  lastResult.signedPath,
      finalPath:   lastResult.finalPath,
      fieldsCount: signFields.length,
    });

  } catch (error) {
    fs.unlink(pdfFile?.path  || "", () => {});
    fs.unlink(certFile?.path || "", () => {});
    console.error("[sign_controller] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /easym/v1/sign/download?path=Firmas/spool/...
 *
 * Descarga el PDF firmado desde MinIO y lo envía al cliente.
 */
export const downloadSigned = async (req, res) => {
  const objectPath = req.query.path;
  if (!objectPath) {
    return res.status(400).json({ error: "Falta el parámetro 'path'." });
  }
  try {
    const stat = await minioClient.statObject(SPOOL_BUCKET, objectPath);
    const filename = objectPath.split("/").pop() || "documento_firmado.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    if (stat.size) res.setHeader("Content-Length", stat.size);

    const stream = await minioClient.getObject(SPOOL_BUCKET, objectPath);
    stream.pipe(res);
    stream.on("error", (err) => {
      console.error("[sign_controller] Stream error:", err.message);
      if (!res.headersSent) res.status(500).json({ error: "Error al leer el archivo." });
    });
  } catch (error) {
    console.error("[sign_controller] Error descarga:", error.message);
    return res.status(404).json({ error: "Archivo no encontrado." });
  }
};