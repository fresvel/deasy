import * as Minio from "minio";
import { randomUUID } from "crypto";
import fs from "fs";

// ── Configuración de MinIO ────────────────────────────────────────────────────
const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://minio:9000");
const useSSL = minioUrl.protocol === "https:";

const minioClient = new Minio.Client({
    endPoint: minioUrl.hostname,
    port: Number(minioUrl.port || (useSSL ? 443 : 80)),
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY || "deasy_minio",
    secretKey: process.env.MINIO_SECRET_KEY || "deasy_minio_secret",
});

const SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || "deasy-spool";
const SIGNER_URL = process.env.SIGNER_URL || "http://signer:4000";

// ── Función auxiliar: subir archivo local a MinIO ─────────────────────────────
const uploadToMinio = (objectName, localPath) =>
    new Promise((resolve, reject) => {
        minioClient.fPutObject(SPOOL_BUCKET, objectName, localPath, {}, (err, etag) => {
            if (err) reject(new Error(`Error subiendo a MinIO (${objectName}): ${err.message}`));
            else resolve(etag);
        });
    });

// ── Función auxiliar: asegurar que el bucket existe ───────────────────────────
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

/**
 * POST /easym/v1/sign
 *
 * Campos del formulario (multipart/form-data):
 *   pdf       (archivo) — PDF a firmar
 *   cert      (archivo) — Certificado .p12
 *   password  (texto)   — Contraseña del .p12
 *   stampText (texto)   — Nombre del firmante para el sello
 *   signType  (texto)   — "coordinates" o "token"
 *   page      (número)  — Página (solo si signType=coordinates)
 *   x         (número)  — Coordenada X (solo si signType=coordinates)
 *   y         (número)  — Coordenada Y (solo si signType=coordinates)
 *   token     (texto)   — Token del usuario (solo si signType=token)
 */
export const requestSign = async (req, res) => {
    // 1. Validar que llegaron archivos y campos obligatorios
    if (!req.files?.pdf?.[0] || !req.files?.cert?.[0]) {
        return res.status(400).json({ error: "Se requieren los archivos 'pdf' y 'cert'." });
    }
    const { password, stampText, signType } = req.body;
    if (!password || !stampText || !signType) {
        return res.status(400).json({ error: "Faltan campos: password, stampText, signType." });
    }

    const pdfFile = req.files.pdf[0];
    const certFile = req.files.cert[0];

    // 2. Generar rutas únicas en MinIO para esta sesión de firma
    const sessionId = randomUUID();
    const minioPdfPath = `Firmas/spool/${sessionId}/input.pdf`;
    const minioCertPath = `Firmas/spool/${sessionId}/cert.p12`;
    // URL pública que aparecerá en el QR del sello
    const finalPath = `${process.env.MINIO_PUBLIC_ENDPOINT || "http://localhost:9000"}/${SPOOL_BUCKET}/${minioPdfPath}`;

    try {
        // 3. Asegurar que el bucket existe en MinIO
        await ensureBucket();

        // 4. Subir PDF y certificado a MinIO
        await uploadToMinio(minioPdfPath, pdfFile.path);
        await uploadToMinio(minioCertPath, certFile.path);

        // 5. Armar el payload para el servicio signer de Andy
        const signerPayload = {
            signType,
            minioPdfPath,
            minioCertPath,
            certPassword: password,
            stampText,
            finalPath,
        };

        // Coordenadas si signType=coordinates
        if (signType === "coordinates") {
            signerPayload.coordinates = {
                page: parseInt(req.body.page) || 1,
                x: parseFloat(req.body.x) || 100,
                y: parseFloat(req.body.y) || 200,
            };
        }

        // Token si signType=token
        if (signType === "token") {
            signerPayload.token = req.body.token;
        }

        // 6. Llamar al servicio signer de Andy: POST http://signer:4000/sign
        console.log("[sign_controller] Llamando al signer:", SIGNER_URL);
        const signerResponse = await fetch(`${SIGNER_URL}/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signerPayload),
        });

        const result = await signerResponse.json();

        // 7. Limpiar archivos temporales del servidor
        fs.unlink(pdfFile.path, () => { });
        fs.unlink(certFile.path, () => { });

        // 8. Devolver resultado al frontend
        if (result.status === "success") {
            return res.status(200).json({
                message: "PDF firmado exitosamente.",
                signedPath: result.signedPath,
                finalPath: result.finalPath,
            });
        } else {
            return res.status(500).json({
                error: "El servicio de firma reportó un error.",
                detail: result.message,
            });
        }

    } catch (error) {
        fs.unlink(pdfFile?.path || "", () => { });
        fs.unlink(certFile?.path || "", () => { });
        console.error("[sign_controller] Error:", error.message);
        return res.status(500).json({ error: error.message });
    }
};