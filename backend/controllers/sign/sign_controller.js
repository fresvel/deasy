import fs from "fs";
import { randomUUID } from "crypto";
import UserRepository from "../../services/auth/UserRepository.js";
import UserCertificateRepository from "../../services/auth/UserCertificateRepository.js";
import { requestSignerJob } from "../../services/infrastructure/rabbit_signer.js";
import {
  ensureBucketExists,
  removeMinioObject,
  statMinioObject,
  uploadFileToMinio
} from "../../services/storage/minio_service.js";

const userRepository = new UserRepository();
const certificateRepository = new UserCertificateRepository();

const MINIO_SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || "deasy-spool";
const getCurrentUser = async (req) => {
  const userId = Number(req.user?.uid);
  if (!userId || Number.isNaN(userId)) {
    throw new Error("Usuario autenticado inválido.");
  }
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado.");
  }
  return user;
};

const buildSpoolPaths = (user, sessionId) => {
  const prefix = `users/${user.cedula}/${sessionId}`;
  return {
    inputPath: `${prefix}/input.pdf`,
    signedPath: `${prefix}/signed.pdf`
  };
};

const parseFields = (rawFields) => {
  const parsed = JSON.parse(rawFields || "[]");
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("Debe incluir al menos un campo de firma.");
  }
  return parsed.map((field) => ({
    page: Number(field.page),
    x: Number(field.x),
    y: Number(field.y)
  }));
};

export const requestSign = async (req, res) => {
  const tempFilePath = req.files?.pdf?.[0]?.path;
  let inputPath = null;
  let signedPath = null;
  try {
    if (!req.files?.pdf?.[0]) {
      return res.status(400).json({ error: "Se requiere el archivo PDF." });
    }

    const { certificate_id: certificateIdRaw, password, stampText } = req.body;
    const certificateId = Number(certificateIdRaw);
    if (!certificateId || Number.isNaN(certificateId)) {
      return res.status(400).json({ error: "Debes seleccionar un certificado guardado." });
    }
    if (!password) {
      return res.status(400).json({ error: "Debes ingresar la contraseña del certificado." });
    }
    if (!stampText?.trim()) {
      return res.status(400).json({ error: "Debes indicar el texto del sello." });
    }

    const fields = parseFields(req.body.fields);
    const user = await getCurrentUser(req);
    const certificate = await certificateRepository.findOwnedById(user.id, certificateId);
    if (!certificate) {
      return res.status(404).json({ error: "Certificado no encontrado para este usuario." });
    }

    const sessionId = randomUUID();
    ({ inputPath, signedPath } = buildSpoolPaths(user, sessionId));

    await ensureBucketExists(MINIO_SPOOL_BUCKET);
    await uploadFileToMinio(MINIO_SPOOL_BUCKET, inputPath, req.files.pdf[0].path, {
      "Content-Type": "application/pdf"
    });

    let lastResult = null;
    for (const field of fields) {
      lastResult = await requestSignerJob({
        signType: "coordinates",
        minioBucket: MINIO_SPOOL_BUCKET,
        minioPdfPath: inputPath,
        minioCertBucket: certificate.bucket,
        minioCertPath: certificate.object_name,
        certPassword: password,
        stampText: stampText.trim(),
        finalPath: signedPath,
        coordinates: {
          page: field.page,
          x: field.x,
          y: field.y
        }
      });
    }

    return res.json({
      message: "Documento firmado correctamente.",
      signedPath: lastResult?.signedPath || lastResult?.finalPath || signedPath,
      finalPath: lastResult?.finalPath || signedPath,
      fieldsCount: fields.length
    });
  } catch (error) {
    console.error("[sign_controller] Error:", error);
    return res.status(500).json({ error: error.message || "No se pudo firmar el documento." });
  } finally {
    if (tempFilePath) {
      fs.unlink(tempFilePath, () => {});
    }
    if (inputPath && signedPath && inputPath !== signedPath) {
      await removeMinioObject(MINIO_SPOOL_BUCKET, inputPath).catch(() => {});
    }
  }
};

export const downloadSigned = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const objectPath = String(req.query?.path || "");
    if (!objectPath) {
      return res.status(400).json({ error: "Falta el parámetro 'path'." });
    }
    if (!objectPath.startsWith(`users/${user.cedula}/`)) {
      return res.status(403).json({ error: "No tienes acceso a este documento firmado." });
    }

    const stat = await statMinioObject(MINIO_SPOOL_BUCKET, objectPath);
    const stream = await getMinioObjectStream(MINIO_SPOOL_BUCKET, objectPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="documento_firmado.pdf"');
    if (stat?.size) {
      res.setHeader("Content-Length", stat.size);
    }
    stream.pipe(res);
    stream.on("error", (error) => {
      console.error("[sign_controller] Error stream:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "No se pudo leer el documento firmado." });
      }
    });
  } catch (error) {
    console.error("[sign_controller] Error descarga:", error);
    res.status(404).json({ error: "Archivo firmado no encontrado." });
  }
};
