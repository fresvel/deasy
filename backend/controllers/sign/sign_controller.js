import fs from "fs";
import { randomUUID } from "crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import { getMariaDBPool } from "../../config/mariadb.js";
import UserRepository from "../../services/auth/UserRepository.js";
import UserCertificateRepository from "../../services/auth/UserCertificateRepository.js";
import { requestSignerJob } from "../../services/infrastructure/rabbit_signer.js";
import { formatTokenForSigner } from "../../utils/tokenGenerator.js";
import {
  getSignatureFlowSnapshot,
  registerSignatureEvidence,
} from "../../services/documents/DocumentSignatureWorkflowService.js";
import {
  ensureBucketExists,
  getMinioObjectStream,
  removeMinioObject,
  statMinioObject,
  uploadFileToMinio
} from "../../services/storage/minio_service.js";

const userRepository = new UserRepository();
const certificateRepository = new UserCertificateRepository();
const pool = getMariaDBPool();
const batchJobs = new Map();

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

const buildSignContext = async (req) => {
  const {
    certificate_id: certificateIdRaw,
    password,
    stampText,
    sign_mode: signModeRaw,
    token: tokenRaw,
    use_timestamp: useTimestampRaw,
    tsa_url: tsaUrlRaw,
    allow_untrusted_signer: allowUntrustedSignerRaw,
    signature_request_id: signatureRequestIdRaw,
    document_version_id: documentVersionIdRaw,
  } = req.body;
  const certificateId = Number(certificateIdRaw);
  if (!certificateId || Number.isNaN(certificateId)) {
    throw new Error("Debes seleccionar un certificado guardado.");
  }
  if (!password) {
    throw new Error("Debes ingresar la contraseña del certificado.");
  }
  if (!stampText?.trim()) {
    throw new Error("Debes indicar el texto del sello.");
  }

  const user = await getCurrentUser(req);
  const certificate = await certificateRepository.findOwnedById(user.id, certificateId);
  if (!certificate) {
    throw new Error("Certificado no encontrado para este usuario.");
  }

  const signMode = String(signModeRaw || "coordinates").trim().toLowerCase();
  if (!["coordinates", "token"].includes(signMode)) {
    throw new Error("Modo de firma inválido.");
  }

  const hasDocumentFields = Boolean(req.body.document_fields);
  const fields =
    signMode === "coordinates"
      ? hasDocumentFields
        ? (() => {
            try {
              return parseFields(req.body.fields);
            } catch {
              return [];
            }
          })()
        : parseFields(req.body.fields)
      : [];
  const resolvedToken = signMode === "token"
    ? (() => {
        const rawToken = String(tokenRaw || user.signatureToken || "").trim();
        if (!rawToken) {
          throw new Error("El usuario no tiene token de firma configurado.");
        }
        return rawToken.startsWith("!-") ? rawToken : formatTokenForSigner(rawToken);
      })()
    : null;

  return {
    user,
    certificate,
    signMode,
    fields,
    resolvedToken,
    password,
    stampText: stampText.trim(),
    useTimestamp: asBoolean(useTimestampRaw),
    allowUntrustedSigner: asBoolean(allowUntrustedSignerRaw),
    tsaUrl: String(tsaUrlRaw || "").trim() || undefined,
    signatureRequestId: signatureRequestIdRaw ? Number(signatureRequestIdRaw) : null,
    documentVersionId: documentVersionIdRaw ? Number(documentVersionIdRaw) : null,
  };
};

const processSinglePdfSigning = async ({ file, context }) => {
  let inputPath = null;
  let signedPath = null;
  try {
    const sessionId = randomUUID();
    ({ inputPath, signedPath } = buildSpoolPaths(context.user, sessionId));

    await ensureBucketExists(MINIO_SPOOL_BUCKET);
    await uploadFileToMinio(MINIO_SPOOL_BUCKET, inputPath, file.path, {
      "Content-Type": "application/pdf"
    });

    let lastResult = null;
    if (context.signMode === "token") {
      lastResult = await requestSignerJob({
        signType: "token",
        minioBucket: MINIO_SPOOL_BUCKET,
        minioPdfPath: inputPath,
        minioCertBucket: context.certificate.bucket,
        minioCertPath: context.certificate.object_name,
        certPassword: context.password,
        stampText: context.stampText,
        finalPath: signedPath,
        use_timestamp: context.useTimestamp,
        allow_untrusted_signer: context.allowUntrustedSigner,
        tsaUrl: context.tsaUrl,
        token: context.resolvedToken
      });
    } else {
      const resolvedFields = await resolveFieldsForPdf(file.path, context.fields);
      for (const field of resolvedFields) {
        lastResult = await requestSignerJob({
          signType: "coordinates",
          minioBucket: MINIO_SPOOL_BUCKET,
          minioPdfPath: inputPath,
          minioCertBucket: context.certificate.bucket,
          minioCertPath: context.certificate.object_name,
          certPassword: context.password,
          stampText: context.stampText,
          finalPath: signedPath,
          use_timestamp: context.useTimestamp,
          allow_untrusted_signer: context.allowUntrustedSigner,
          tsaUrl: context.tsaUrl,
          coordinates: {
            page: field.page,
            x: field.x,
            y: field.y
          }
        });
      }
    }

    return {
      message: "Documento firmado correctamente.",
      signedPath: lastResult?.signedPath || lastResult?.finalPath || signedPath,
      finalPath: lastResult?.finalPath || signedPath,
      fieldsCount: context.signMode === "token" ? Number(lastResult?.signature?.matchCount || 0) : context.fields.length,
      signMode: context.signMode
    };
  } finally {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
    if (inputPath && signedPath && inputPath !== signedPath) {
      await removeMinioObject(MINIO_SPOOL_BUCKET, inputPath).catch(() => {});
    }
  }
};

const parseFields = (rawFields) => {
  const parsed = JSON.parse(rawFields || "[]");
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("Debe incluir al menos un campo de firma.");
  }
  return parsed.map((field) => ({
    page: Number(field.page),
    pageReference: String(field.pageReference || "start"),
    pageValue: Number(field.pageValue || field.page),
    pageOffset: Number(field.pageOffset || 0),
    x: Number(field.x),
    y: Number(field.y)
  }));
};

const getPdfPageCount = async (filePath) => {
  const pdfData = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  return Number(pdf.numPages || 0);
};

const resolveFieldsForPdf = async (filePath, fields) => {
  const totalPages = await getPdfPageCount(filePath);
  return fields.map((field) => {
    let page = Number(field.page || 1);
    if (field.pageReference === "end") {
      page = Math.max(1, totalPages - Number(field.pageOffset || 0));
    } else if (field.pageReference === "start") {
      page = Math.min(totalPages || 1, Math.max(1, Number(field.pageValue || field.page || 1)));
    }
    return {
      ...field,
      page
    };
  });
};

const parseBatchDocumentFields = (rawDocumentFields) => {
  if (!rawDocumentFields) return [];
  const parsed = JSON.parse(rawDocumentFields);
  if (!Array.isArray(parsed)) {
    throw new Error("La configuración por documento es inválida.");
  }
  return parsed.map((doc) => ({
    id: doc.id,
    name: doc.name,
    fields: Array.isArray(doc.fields)
      ? doc.fields.map((field) => ({
          page: Number(field.page),
          x: Number(field.x),
          y: Number(field.y)
        }))
      : []
  }));
};

const asBoolean = (value) =>
  String(value ?? "").trim().toLowerCase() === "true" || String(value ?? "").trim() === "1";

const createBatchJob = ({ userId, fileNames, signMode }) => {
  const jobId = randomUUID();
  const job = {
    jobId,
    userId,
    signMode,
    status: "queued",
    total: fileNames.length,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    results: fileNames.map((fileName) => ({
      fileName,
      status: "pending"
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  batchJobs.set(jobId, job);
  return job;
};

const updateBatchJob = (jobId, updater) => {
  const current = batchJobs.get(jobId);
  if (!current) return null;
  const next = typeof updater === "function" ? updater(current) : current;
  next.updatedAt = new Date().toISOString();
  batchJobs.set(jobId, next);
  return next;
};

const getBatchJob = (jobId) => batchJobs.get(jobId) || null;

const streamMinioObjectToFile = async (bucket, objectName, destinationPath) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  await pipeline(stream, fs.createWriteStream(destinationPath));
};

const createZipArchive = async (zipPath, sourcePaths) =>
  new Promise((resolve, reject) => {
    const zipProcess = spawn("zip", ["-j", zipPath, ...sourcePaths], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    zipProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    zipProcess.on("error", reject);
    zipProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || "No se pudo generar el archivo ZIP."));
    });
  });

const truncateNote = (value, max = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const persistSignatureWorkflowResult = async ({ context, result }) => {
  if (!pool || (!context.signatureRequestId && !context.documentVersionId)) {
    return null;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const workflow = await registerSignatureEvidence({ connection, context, result });
    await connection.commit();
    return workflow;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const requestSign = async (req, res) => {
  try {
    if (!req.files?.pdf?.[0]) {
      return res.status(400).json({ error: "Se requiere el archivo PDF." });
    }
    const context = await buildSignContext(req);
    const result = await processSinglePdfSigning({
      file: req.files.pdf[0],
      context
    });
    const workflow = await persistSignatureWorkflowResult({ context, result });
    return res.json({
      ...result,
      workflow: workflow || undefined,
    });
  } catch (error) {
    console.error("[sign_controller] Error:", error);
    return res.status(500).json({ error: error.message || "No se pudo firmar el documento." });
  }
};

export const requestSignBatch = async (req, res) => {
  try {
    const files = Array.isArray(req.files?.pdf) ? req.files.pdf : [];
    if (!files.length) {
      return res.status(400).json({ error: "Debes cargar al menos un PDF para la firma masiva." });
    }

    const context = await buildSignContext(req);
    const results = [];

    for (const file of files) {
      try {
        const result = await processSinglePdfSigning({ file, context });
        results.push({
          fileName: file.originalname,
          status: "success",
          ...result
        });
      } catch (error) {
        console.error("[sign_controller][batch] Error:", error);
        if (file?.path) {
          fs.unlink(file.path, () => {});
        }
        results.push({
          fileName: file.originalname,
          status: "error",
          error: error.message || "No se pudo firmar el documento."
        });
      }
    }

    const successCount = results.filter((item) => item.status === "success").length;
    const failedCount = results.length - successCount;

    return res.json({
      message: "Proceso batch de firma completado.",
      signMode: context.signMode,
      total: results.length,
      successCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error("[sign_controller][batch] Error:", error);
    return res.status(500).json({ error: error.message || "No se pudo ejecutar la firma masiva." });
  }
};

export const requestSignBatchStart = async (req, res) => {
  try {
    const files = Array.isArray(req.files?.pdf) ? req.files.pdf : [];
    if (!files.length) {
      return res.status(400).json({ error: "Debes cargar al menos un PDF para la firma masiva." });
    }

    const context = await buildSignContext(req);
    const batchDocumentFields = parseBatchDocumentFields(req.body.document_fields);
    const job = createBatchJob({
      userId: context.user.id,
      fileNames: files.map((file) => file.originalname),
      signMode: context.signMode
    });

    updateBatchJob(job.jobId, (current) => ({
      ...current,
      status: "processing"
    }));

    setImmediate(async () => {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        try {
          updateBatchJob(job.jobId, (current) => {
            const results = [...current.results];
            results[index] = {
              ...results[index],
              fileName: file.originalname,
              status: "processing"
            };
            return {
              ...current,
              results
            };
          });
          const documentFieldConfig = batchDocumentFields[index];
          const documentContext =
            context.signMode === "coordinates" && documentFieldConfig?.fields?.length
              ? {
                  ...context,
                  fields: documentFieldConfig.fields
                }
              : context;
          const result = await processSinglePdfSigning({ file, context: documentContext });
          updateBatchJob(job.jobId, (current) => {
            const results = [...current.results];
            results[index] = {
              fileName: file.originalname,
              status: "success",
              ...result
            };
            return {
              ...current,
              processed: current.processed + 1,
              successCount: current.successCount + 1,
              results,
              status: current.processed + 1 >= current.total ? "completed" : "processing"
            };
          });
        } catch (error) {
          console.error("[sign_controller][batch-start] Error:", error);
          if (file?.path) {
            fs.unlink(file.path, () => {});
          }
          updateBatchJob(job.jobId, (current) => {
            const results = [...current.results];
            results[index] = {
              fileName: file.originalname,
              status: "error",
              error: error.message || "No se pudo firmar el documento."
            };
            return {
              ...current,
              processed: current.processed + 1,
              failedCount: current.failedCount + 1,
              results,
              status: current.processed + 1 >= current.total ? "completed" : "processing"
            };
          });
        }
      }
    });

    return res.status(202).json({
      message: "Proceso batch iniciado.",
      jobId: job.jobId,
      signMode: context.signMode,
      total: job.total
    });
  } catch (error) {
    console.error("[sign_controller][batch-start] Error:", error);
    return res.status(500).json({ error: error.message || "No se pudo iniciar la firma masiva." });
  }
};

export const getSignBatchStatus = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    const jobId = String(req.params?.jobId || "");
    const job = getBatchJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job batch no encontrado." });
    }
    if (Number(job.userId) !== Number(user.id)) {
      return res.status(403).json({ error: "No tienes acceso a este job batch." });
    }
    return res.json(job);
  } catch (error) {
    console.error("[sign_controller][batch-status] Error:", error);
    return res.status(500).json({ error: error.message || "No se pudo consultar el estado del batch." });
  }
};

export const downloadSignBatch = async (req, res) => {
  let workspace = null;
  try {
    const user = await getCurrentUser(req);
    const jobId = String(req.params?.jobId || "");
    const job = getBatchJob(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job batch no encontrado." });
    }
    if (Number(job.userId) !== Number(user.id)) {
      return res.status(403).json({ error: "No tienes acceso a este job batch." });
    }

    const successResults = Array.isArray(job.results)
      ? job.results.filter((item) => item.status === "success" && item.signedPath)
      : [];
    if (!successResults.length) {
      return res.status(400).json({ error: "Este lote no tiene documentos firmados para descargar." });
    }

    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "deasy-sign-batch-"));
    const filePaths = [];

    for (let index = 0; index < successResults.length; index += 1) {
      const result = successResults[index];
      const safeBaseName = String(result.fileName || `documento-${index + 1}.pdf`).replace(/[^\w.\-]+/g, "_");
      const outputName = safeBaseName.toLowerCase().endsWith(".pdf") ? safeBaseName : `${safeBaseName}.pdf`;
      const destinationPath = path.join(workspace, outputName);
      await streamMinioObjectToFile(MINIO_SPOOL_BUCKET, result.signedPath, destinationPath);
      filePaths.push(destinationPath);
    }

    const zipPath = path.join(workspace, `firmas-lote-${jobId}.zip`);
    await createZipArchive(zipPath, filePaths);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="firmas-lote-${jobId}.zip"`);
    res.download(zipPath, `firmas-lote-${jobId}.zip`, () => {
      fs.rm(workspace, { recursive: true, force: true }, () => {});
    });
  } catch (error) {
    console.error("[sign_controller][batch-download] Error:", error);
    if (workspace) {
      fs.rm(workspace, { recursive: true, force: true }, () => {});
    }
    return res.status(500).json({ error: error.message || "No se pudo descargar el lote firmado." });
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

export const getSignatureFlow = async (req, res) => {
  try {
    const documentVersionId = Number(req.params?.documentVersionId);
    if (!documentVersionId || Number.isNaN(documentVersionId)) {
      return res.status(400).json({ error: "Versión documental inválida." });
    }
    if (!pool) {
      return res.status(500).json({ error: "La conexión a MariaDB no está disponible." });
    }

    const connection = await pool.getConnection();
    try {
      const snapshot = await getSignatureFlowSnapshot({
        connection,
        documentVersionId,
        userId: Number(req.user?.uid || 0),
      });
      return res.json(snapshot);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("[sign_controller] Error signature flow:", error);
    return res.status(500).json({ error: error.message || "No se pudo obtener el flujo de firmas." });
  }
};
