import fs from "fs";
import path from "path";
import UserRepository from "../../services/auth/UserRepository.js";
import UserCertificateRepository from "../../services/auth/UserCertificateRepository.js";
import {
  ensureBucketExists,
  getMinioObjectStream,
  removeMinioObject,
  uploadFileToMinio
} from "../../services/storage/minio_service.js";

const certificateRepository = new UserCertificateRepository();
const userRepository = new UserRepository();

const MINIO_CERTIFICATES_BUCKET = process.env.MINIO_CERTIFICATES_BUCKET || "deasy-certificates";

const sanitizeFileName = (value) =>
  String(value || "certificate.p12")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

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

export const listMyCertificates = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const rows = await certificateRepository.listByPersonId(user.id);
    res.json({
      result: "ok",
      certificates: rows.map((row) => certificateRepository.toPublic(row))
    });
  } catch (error) {
    console.error("Error listando certificados:", error);
    res.status(500).json({ message: "No se pudieron cargar los certificados." });
  }
};

export const uploadMyCertificate = async (req, res) => {
  const tempFilePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debes seleccionar un certificado .p12." });
    }

    const user = await getCurrentUser(req);
    const label = String(req.body?.label || "").trim() || path.parse(req.file.originalname).name;
    const safeFileName = sanitizeFileName(req.file.originalname);
    const objectName = `users/${user.cedula}/certificates/${Date.now()}-${safeFileName}`;

    await ensureBucketExists(MINIO_CERTIFICATES_BUCKET);
    await uploadFileToMinio(MINIO_CERTIFICATES_BUCKET, objectName, req.file.path, {
      "Content-Type": req.file.mimetype || "application/x-pkcs12"
    });

    const isDefault = String(req.body?.is_default || "").trim() === "1";
    if (isDefault) {
      await certificateRepository.clearDefaultForPerson(user.id);
    }

    const created = await certificateRepository.create({
      person_id: user.id,
      label,
      original_filename: req.file.originalname,
      bucket: MINIO_CERTIFICATES_BUCKET,
      object_name: objectName,
      is_default: isDefault ? 1 : 0
    });

    res.status(201).json({
      result: "ok",
      certificate: certificateRepository.toPublic(created)
    });
  } catch (error) {
    console.error("Error subiendo certificado:", error);
    res.status(500).json({ message: "No se pudo guardar el certificado." });
  } finally {
    if (tempFilePath) {
      fs.unlink(tempFilePath, () => {});
    }
  }
};

export const deleteMyCertificate = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const certificateId = Number(req.params?.certificateId);
    const certificate = await certificateRepository.findOwnedById(user.id, certificateId);
    if (!certificate) {
      return res.status(404).json({ message: "Certificado no encontrado." });
    }

    await certificateRepository.delete(certificate.id, user.id);
    try {
      await removeMinioObject(certificate.bucket, certificate.object_name);
    } catch (minioError) {
      console.warn("No se pudo eliminar el certificado en MinIO:", minioError?.message || minioError);
    }

    res.json({ result: "ok" });
  } catch (error) {
    console.error("Error eliminando certificado:", error);
    res.status(500).json({ message: "No se pudo eliminar el certificado." });
  }
};

export const setMyDefaultCertificate = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const certificateId = Number(req.params?.certificateId);
    const updated = await certificateRepository.setDefault(certificateId, user.id);
    if (!updated) {
      return res.status(404).json({ message: "Certificado no encontrado." });
    }
    res.json({
      result: "ok",
      certificate: certificateRepository.toPublic(updated)
    });
  } catch (error) {
    console.error("Error marcando certificado por defecto:", error);
    res.status(500).json({ message: "No se pudo actualizar el certificado." });
  }
};

export const downloadMyCertificate = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const certificateId = Number(req.params?.certificateId);
    const certificate = await certificateRepository.findOwnedById(user.id, certificateId);
    if (!certificate) {
      return res.status(404).json({ message: "Certificado no encontrado." });
    }

    const stream = await getMinioObjectStream(certificate.bucket, certificate.object_name);
    res.setHeader("Content-Type", "application/x-pkcs12");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizeFileName(certificate.original_filename)}"`
    );
    stream.pipe(res);
    stream.on("error", (error) => {
      console.error("Error descargando certificado:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "No se pudo descargar el certificado." });
      }
    });
  } catch (error) {
    console.error("Error descargando certificado:", error);
    res.status(500).json({ message: "No se pudo descargar el certificado." });
  }
};
