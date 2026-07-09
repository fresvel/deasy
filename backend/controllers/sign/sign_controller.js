import fs from "node:fs";
import { randomUUID } from "node:crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { getPostgresPool } from "../../config/postgres.js";
import UserRepository from "../../services/auth/UserRepository.js";
import UserCertificateRepository from "../../services/auth/UserCertificateRepository.js";
import {
  requestSignerJob,
  requestSignerValidationJob
} from "../../services/infrastructure/rabbit_signer.js";
import { formatTokenForSigner } from "../../utils/tokenGenerator.js";
import {
  assertSignatureRequestCanBeSigned,
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
const pool = getPostgresPool();

const MINIO_DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents";
const MINIO_DOCUMENTS_PREFIX = String(process.env.MINIO_DOCUMENTS_PREFIX || "Unidades").replace(/^\/+|\/+$/g, "");
const MINIO_SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || "deasy-spool";
const MINIO_USERS_BUCKET = process.env.MINIO_USERS_BUCKET || "deasy-users";

const sanitizeStorageSegment = (value, fallback = "na") =>
  String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;

const resolveStoredDocumentObject = (storedPath) => {
  const normalizedPath = String(storedPath || "").trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return null;
  }
  if (normalizedPath.startsWith(`${MINIO_DOCUMENTS_PREFIX}/`)) {
    return {
      bucket: MINIO_DOCUMENTS_BUCKET,
      objectName: normalizedPath,
      relativePath: normalizedPath.slice(MINIO_DOCUMENTS_PREFIX.length + 1)
    };
  }
  return {
    bucket: MINIO_DOCUMENTS_BUCKET,
    objectName: `${MINIO_DOCUMENTS_PREFIX}/${normalizedPath}`,
    relativePath: normalizedPath
  };
};

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

const buildValidationSpoolPath = (user, sessionId, fileName = "documento.pdf") => {
  const safeName = String(fileName || "documento.pdf")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^\.+/, "") || "documento.pdf";
  return `users/${user.cedula}/validation/${sessionId}/${safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`}`;
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
  try {
    await statMinioObject(certificate.bucket, certificate.object_name);
  } catch (error) {
    throw new Error("El certificado seleccionado ya no está disponible en almacenamiento. Vuelve a cargar tus certificados y elige uno válido.");
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

const getDocumentVersionStorageContext = async (documentVersionId) => {
  if (!pool) {
    throw new Error("La conexión a PostgreSQL no está disponible.");
  }
  const [rows] = await pool.query(
    `SELECT id, working_file_path, final_file_path
     FROM document_versions
     WHERE id = ?
     LIMIT 1`,
    [Number(documentVersionId)]
  );
  return rows?.[0] || null;
};

const buildStandaloneUserSignedPath = (user, sessionId, originalName = "documento.pdf") => {
  const safeName = sanitizeStorageSegment(originalName, "documento.pdf");
  const fileName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  return `users/${user.cedula}/signed/${sessionId}/${fileName}`;
};

const resolveSigningStoragePlan = async ({ context, file }) => {
  if (context.documentVersionId) {
    const documentVersion = await getDocumentVersionStorageContext(context.documentVersionId);
    if (!documentVersion?.id) {
      throw new Error("No se encontró la versión documental indicada para la firma.");
    }

    const resolvedWorkingObject = resolveStoredDocumentObject(documentVersion.working_file_path);
    if (!resolvedWorkingObject?.objectName) {
      throw new Error("La versión documental no tiene un working_file_path válido para firmar.");
    }
    if (!resolvedWorkingObject.objectName.toLowerCase().endsWith(".pdf")) {
      throw new Error("El working_file_path de la versión documental no apunta a un PDF.");
    }

    return {
      mode: "workflow",
      bucket: resolvedWorkingObject.bucket,
      objectPath: resolvedWorkingObject.objectName,
      storedPath: resolvedWorkingObject.relativePath,
      downloadPath: resolvedWorkingObject.relativePath,
      documentVersionId: Number(documentVersion.id)
    };
  }

  const sessionId = randomUUID();
  const storedPath = buildStandaloneUserSignedPath(context.user, sessionId, file?.originalname);
  return {
    mode: "standalone",
    bucket: MINIO_USERS_BUCKET,
    objectPath: storedPath,
    storedPath,
    downloadPath: storedPath,
    documentVersionId: null
  };
};

const processSinglePdfSigning = async ({ file, context }) => {
  try {
    const storagePlan = await resolveSigningStoragePlan({ context, file });

    await ensureBucketExists(storagePlan.bucket);
    if (storagePlan.mode === "standalone") {
      await uploadFileToMinio(storagePlan.bucket, storagePlan.objectPath, file.path, {
        "Content-Type": "application/pdf"
      });
    } else {
      await statMinioObject(storagePlan.bucket, storagePlan.objectPath);
    }

    console.info("[sign_controller] processSinglePdfSigning storage plan", {
      mode: storagePlan.mode,
      bucket: storagePlan.bucket,
      objectPath: storagePlan.objectPath,
      documentVersionId: storagePlan.documentVersionId,
      signMode: context.signMode,
    });

    let lastResult = null;
    if (context.signMode === "token") {
      lastResult = await requestSignerJob({
        signType: "token",
        minioBucket: storagePlan.bucket,
        minioPdfPath: storagePlan.objectPath,
        minioCertBucket: context.certificate.bucket,
        minioCertPath: context.certificate.object_name,
        certPassword: context.password,
        stampText: context.stampText,
        finalPath: storagePlan.objectPath,
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
          minioBucket: storagePlan.bucket,
          minioPdfPath: storagePlan.objectPath,
          minioCertBucket: context.certificate.bucket,
          minioCertPath: context.certificate.object_name,
          certPassword: context.password,
          stampText: context.stampText,
          finalPath: storagePlan.objectPath,
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

    console.info("[sign_controller] signer result", {
      status: lastResult?.status || null,
      signedPath: lastResult?.signedPath || storagePlan.downloadPath,
      validationPerformed: Boolean(lastResult?.validation?.performed),
      validationBottomLine: lastResult?.validation?.bottomLine ?? null,
      validationWarningAccepted: Boolean(lastResult?.validation?.warningAccepted),
    });

    return {
      ...lastResult,
      message: lastResult?.message || "Documento firmado correctamente.",
      signedBucket: storagePlan.bucket,
      signedPath: storagePlan.downloadPath,
      finalPath: storagePlan.storedPath,
      fieldsCount: context.signMode === "token"
        ? Number(lastResult?.signature?.matchCount || 0)
        : context.fields.length,
      signMode: context.signMode
    };
  } finally {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
  }
};

const assertSignContextBeforeSigning = async (context) => {
  if (!context?.signatureRequestId) {
    return null;
  }
  if (!pool) {
    throw new Error("La conexión a PostgreSQL no está disponible.");
  }

  const connection = await pool.getConnection();
  try {
    return await assertSignatureRequestCanBeSigned({ connection, context });
  } finally {
    connection.release();
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

const parseBatchDocumentContexts = (rawDocumentContexts) => {
  if (!rawDocumentContexts) return [];
  const parsed = JSON.parse(rawDocumentContexts);
  if (!Array.isArray(parsed)) {
    throw new Error("La metadata por documento del lote es inválida.");
  }
  return parsed.map((entry) => {
    const metadata = entry?.metadata || {};
    return {
      id: entry?.id || null,
      name: entry?.name || null,
      // Ruta relativa multinivel del PDF dentro de la carpeta cargada (preserva la estructura en la descarga).
      relativePath: String(entry?.relativePath || "").trim() || null,
      metadata: {
        signatureRequestId: metadata?.signatureRequestId ? Number(metadata.signatureRequestId) : null,
        documentVersionId: metadata?.documentVersionId ? Number(metadata.documentVersionId) : null,
        documentId: metadata?.documentId ? Number(metadata.documentId) : null,
        processName: String(metadata?.processName || "").trim(),
        unitLabel: String(metadata?.unitLabel || "").trim(),
        termName: String(metadata?.termName || "").trim(),
        termYear: String(metadata?.termYear || "").trim(),
        termTypeName: String(metadata?.termTypeName || "").trim(),
        stepName: String(metadata?.stepName || "").trim(),
        requestedAt: metadata?.requestedAt || null,
      },
    };
  });
};

const asBoolean = (value) =>
  String(value ?? "").trim().toLowerCase() === "true" || String(value ?? "").trim() === "1";

// Estado de los jobs de firma masiva PERSISTIDO en PostgreSQL (tabla signature_batch_jobs) para que
// sobreviva reinicios del backend (antes vivía en un Map en memoria y se perdía al reiniciar).
const rowToBatchJob = (row) => {
  if (!row) return null;
  let results = [];
  if (row.results) {
    try {
      results = typeof row.results === "string" ? JSON.parse(row.results) : row.results;
    } catch {
      results = [];
    }
  }
  return {
    jobId: row.job_id,
    userId: row.user_id,
    signMode: row.sign_mode,
    status: row.status,
    total: row.total,
    processed: row.processed,
    successCount: row.success_count,
    failedCount: row.failed_count,
    results: Array.isArray(results) ? results : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const persistBatchJob = async (job) => {
  await pool.query(
    `INSERT INTO signature_batch_jobs
       (job_id, user_id, sign_mode, status, total, processed, success_count, failed_count, results)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id), sign_mode = VALUES(sign_mode), status = VALUES(status),
       total = VALUES(total), processed = VALUES(processed), success_count = VALUES(success_count),
       failed_count = VALUES(failed_count), results = VALUES(results)`,
    [
      job.jobId,
      job.userId ?? null,
      job.signMode ?? null,
      job.status,
      job.total ?? 0,
      job.processed ?? 0,
      job.successCount ?? 0,
      job.failedCount ?? 0,
      JSON.stringify(job.results || [])
    ]
  );
};

const createBatchJob = async ({ userId, fileNames, signMode }) => {
  const job = {
    jobId: randomUUID(),
    userId,
    signMode,
    status: "queued",
    total: fileNames.length,
    processed: 0,
    successCount: 0,
    failedCount: 0,
    results: fileNames.map((fileName) => ({ fileName, status: "pending" }))
  };
  await persistBatchJob(job);
  return job;
};

const updateBatchJob = async (jobId, updater) => {
  const [rows] = await pool.query("SELECT * FROM signature_batch_jobs WHERE job_id = ? LIMIT 1", [jobId]);
  const current = rowToBatchJob(rows?.[0]);
  if (!current) return null;
  const next = typeof updater === "function" ? updater(current) : current;
  await persistBatchJob(next);
  return next;
};

const getBatchJob = async (jobId) => {
  const [rows] = await pool.query("SELECT * FROM signature_batch_jobs WHERE job_id = ? LIMIT 1", [jobId]);
  return rowToBatchJob(rows?.[0]);
};

const streamMinioObjectToFile = async (bucket, objectName, destinationPath) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  await pipeline(stream, fs.createWriteStream(destinationPath));
};

// ZIP que PRESERVA la estructura de carpetas: comprime el contenido de `cwd` recursivamente.
// El zipPath debe vivir FUERA de `cwd` para no incluirse a si mismo en el archivo.
const createStructuredZipArchive = async (cwd, zipPath) =>
  new Promise((resolve, reject) => {
    const zipProcess = spawn("zip", ["-rq", zipPath, "."], { cwd, stdio: ["ignore", "ignore", "pipe"] });
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

// Sanea una ruta relativa multinivel para usarla como entrada del ZIP de salida: descarta segmentos
// vacios, "." y ".." (evita path traversal), normaliza cada segmento y garantiza extension .pdf.
const sanitizeRelativePdfPath = (relativePath, fallbackName, index = 0) => {
  const raw = String(relativePath || fallbackName || "").trim();
  const segments = raw
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[^\w.\-]+/g, "_"));
  if (!segments.length) {
    return `documento-${index + 1}.pdf`;
  }
  const last = segments[segments.length - 1];
  if (!last.toLowerCase().endsWith(".pdf")) {
    segments[segments.length - 1] = `${last}.pdf`;
  }
  return segments.join("/");
};

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
    console.info("[sign_controller] requestSign payload", {
      certificate_id: req.body?.certificate_id ?? null,
      allow_untrusted_signer: req.body?.allow_untrusted_signer ?? null,
      signature_request_id: req.body?.signature_request_id ?? null,
      document_version_id: req.body?.document_version_id ?? null,
    });
    const context = await buildSignContext(req);
    await assertSignContextBeforeSigning(context);
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
    return res.status(500).json({
      error: error.message || "No se pudo firmar el documento.",
      details: error?.details || error?.cause?.message || null,
      error_name: error?.name || null,
    });
  }
};

export const validateSignedDocument = async (req, res) => {
  let minioPdfPath = null;
  try {
    const file = req.files?.pdf?.[0];
    if (!file) {
      return res.status(400).json({ error: "Se requiere el archivo PDF." });
    }

    const user = await getCurrentUser(req);
    const sessionId = randomUUID();
    minioPdfPath = buildValidationSpoolPath(user, sessionId, file.originalname);

    await ensureBucketExists(MINIO_SPOOL_BUCKET);
    await uploadFileToMinio(MINIO_SPOOL_BUCKET, minioPdfPath, file.path, {
      "Content-Type": "application/pdf"
    });

    const result = await requestSignerValidationJob({
      minioBucket: MINIO_SPOOL_BUCKET,
      minioPdfPath,
      cedula: String(req.body?.cedula || "").trim() || undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("[sign_controller][validate] Error:", error);
    return res.status(500).json({ error: error.message || "No se pudo validar el documento." });
  } finally {
    if (req.files?.pdf?.[0]?.path) {
      fs.unlink(req.files.pdf[0].path, () => {});
    }
    if (minioPdfPath) {
      await removeMinioObject(MINIO_SPOOL_BUCKET, minioPdfPath).catch(() => {});
    }
  }
};

// DEPRECADO: el endpoint legacy POST /sign/batch firmaba de forma síncrona sin persistir evidencia de
// workflow ni estado de job. Sustituido por POST /sign/batch/start (asíncrono, con job persistido y
// evidencia de firma). Se conserva la ruta para devolver 410 Gone y guiar a los clientes legacy.
export const requestSignBatch = async (req, res) => {
  // Libera cualquier archivo subido por multer para no dejar temporales.
  const files = Array.isArray(req.files?.pdf) ? req.files.pdf : [];
  for (const file of files) {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
  }
  return res.status(410).json({
    error: "Endpoint de firma masiva legacy retirado. Usa POST /sign/batch/start (procesa de forma asíncrona y persiste evidencia).",
    code: "SIGN_BATCH_LEGACY_GONE",
    use: "/sign/batch/start"
  });
};

export const requestSignBatchStart = async (req, res) => {
  try {
    const files = Array.isArray(req.files?.pdf) ? req.files.pdf : [];
    if (!files.length) {
      return res.status(400).json({ error: "Debes cargar al menos un PDF para la firma masiva." });
    }

    const context = await buildSignContext(req);
    const batchDocumentFields = parseBatchDocumentFields(req.body.document_fields);
    const batchDocumentContexts = parseBatchDocumentContexts(req.body.document_contexts);
    const job = await createBatchJob({
      userId: context.user.id,
      fileNames: files.map((file) => file.originalname),
      signMode: context.signMode
    });

    await updateBatchJob(job.jobId, (current) => ({
      ...current,
      status: "processing"
    }));

    setImmediate(async () => {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        // Declarados fuera del try para que el catch tambien pueda referenciarlos al registrar el error.
        const documentFieldConfig = batchDocumentFields[index];
        const documentContextConfig = batchDocumentContexts[index]?.metadata || {};
        const documentRelativePath = batchDocumentContexts[index]?.relativePath || file.originalname;
        try {
          await updateBatchJob(job.jobId, (current) => {
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
          const documentContext =
            {
              ...context,
              signatureRequestId: documentContextConfig.signatureRequestId || null,
              documentVersionId: documentContextConfig.documentVersionId || null,
              fields: context.signMode === "coordinates" && documentFieldConfig?.fields?.length
                ? documentFieldConfig.fields
                : context.fields
            };
          await assertSignContextBeforeSigning(documentContext);
          const result = await processSinglePdfSigning({ file, context: documentContext });
          const workflow = await persistSignatureWorkflowResult({ context: documentContext, result });
          await updateBatchJob(job.jobId, (current) => {
            const results = [...current.results];
            results[index] = {
              fileName: file.originalname,
              relativePath: documentRelativePath,
              status: "success",
              ...result,
              workflow: workflow || null,
              signatureRequestId: Number(
                workflow?.signatureRequestId
                || documentContext.signatureRequestId
                || documentContextConfig.signatureRequestId
                || 0
              ) || null,
              documentVersionId: Number(
                workflow?.documentVersionId
                || documentContext.documentVersionId
                || documentContextConfig.documentVersionId
                || 0
              ) || null,
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
          await updateBatchJob(job.jobId, (current) => {
            const results = [...current.results];
            results[index] = {
              fileName: file.originalname,
              relativePath: documentRelativePath,
              status: "error",
              error: error.message || "No se pudo firmar el documento.",
              signatureRequestId: documentContextConfig.signatureRequestId || null,
              documentVersionId: documentContextConfig.documentVersionId || null,
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
    const job = await getBatchJob(jobId);
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
    const job = await getBatchJob(jobId);
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
    // El ZIP vive fuera del workspace para no incluirse a si mismo al comprimir recursivamente.
    const zipPath = path.join(os.tmpdir(), `firmas-lote-${jobId}-${randomUUID()}.zip`);
    const usedEntryPaths = new Set();

    for (let index = 0; index < successResults.length; index += 1) {
      const result = successResults[index];
      // Reconstruye la estructura de carpetas de entrada usando la ruta relativa; cae al nombre plano si no hay.
      let entryPath = sanitizeRelativePdfPath(result.relativePath, result.fileName, index);
      // Evita colisiones de rutas identicas (p. ej. dos PDFs distintos saneados al mismo nombre).
      if (usedEntryPaths.has(entryPath.toLowerCase())) {
        const parsed = path.posix.parse(entryPath);
        entryPath = path.posix.join(parsed.dir, `${parsed.name}-${index + 1}${parsed.ext || ".pdf"}`);
      }
      usedEntryPaths.add(entryPath.toLowerCase());

      const destinationPath = path.join(workspace, entryPath);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      await streamMinioObjectToFile(result.signedBucket || MINIO_USERS_BUCKET, result.signedPath, destinationPath);
    }

    await createStructuredZipArchive(workspace, zipPath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="firmas-lote-${jobId}.zip"`);
    res.download(zipPath, `firmas-lote-${jobId}.zip`, () => {
      fs.rm(workspace, { recursive: true, force: true }, () => {});
      fs.rm(zipPath, { force: true }, () => {});
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
    const requestedPath = String(req.query?.path || "").trim().replace(/^\/+/, "");
    if (!requestedPath) {
      return res.status(400).json({ error: "Falta el parámetro 'path'." });
    }

    let bucket = null;
    let objectPath = null;

    if (requestedPath.startsWith(`users/${user.cedula}/`)) {
      bucket = MINIO_USERS_BUCKET;
      objectPath = requestedPath;
    } else {
      if (!pool) {
        return res.status(500).json({ error: "La conexión a PostgreSQL no está disponible." });
      }
      const [rows] = await pool.query(
        `SELECT dv.id
         FROM document_versions dv
         INNER JOIN documents d ON d.id = dv.document_id
         LEFT JOIN task_items ti ON ti.id = d.task_item_id
         LEFT JOIN tasks t ON t.id = ti.task_id
         LEFT JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
         LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
         WHERE (
           dv.working_file_path = ?
           OR dv.final_file_path = ?
         )
           AND (
             d.owner_person_id = ?
             OR ti.assigned_person_id = ?
             OR t.created_by_user_id = ?
             OR sr.assigned_person_id = ?
           )
         LIMIT 1`,
        [requestedPath, requestedPath, Number(user.id), Number(user.id), Number(user.id), Number(user.id)]
      );
      if (!rows?.length) {
        return res.status(403).json({ error: "No tienes acceso a este documento firmado." });
      }
      const resolvedObject = resolveStoredDocumentObject(requestedPath);
      if (!resolvedObject?.objectName) {
        return res.status(404).json({ error: "Archivo firmado no encontrado." });
      }
      bucket = resolvedObject.bucket;
      objectPath = resolvedObject.objectName;
    }

    const stat = await statMinioObject(bucket, objectPath);
    const stream = await getMinioObjectStream(bucket, objectPath);
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
      return res.status(500).json({ error: "La conexión a PostgreSQL no está disponible." });
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
