// Transporte del dominio de firma. Aquí solo se lee la petición, se llama a UN servicio y se
// traduce el resultado a HTTP. La lógica vive en:
//   · `services/sign/PdfSigningService.js`   — contexto de firma, plan de almacenamiento, firma
//   · `services/sign/BatchSigningService.js` — jobs de lote, bucle de firma masiva y ZIP
//
// CONTRATO DE ERRORES: los errores de negocio traen `statusCode` (`errors/HttpError.js`) y aquí se
// honran; los que no lo traen son fallos de verdad y salen como 500. Antes toda la validación de
// entrada de `requestSign` salía 500 —el cliente se llevaba un "error de servidor" por olvidarse la
// contraseña—; el orden de los guards y sus códigos están congelados en
// `tests/characterization/flows/zzzz_sign_batch.test.mjs`.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { getPostgresPool } from "../../config/postgres.js";
import {
  requestSignerValidationJob
} from "../../services/infrastructure/rabbit_signer.js";
import { getSignatureFlowSnapshot } from "../../services/documents/DocumentSignatureWorkflowService.js";
import {
  assertSignContextBeforeSigning,
  buildSignContext,
  buildValidationSpoolPath,
  MINIO_SPOOL_BUCKET,
  MINIO_USERS_BUCKET,
  persistSignatureWorkflowResult,
  processSinglePdfSigning,
  resolveSigningUser,
  resolveStoredDocumentObject,
  userCanAccessStoredDocument,
} from "../../services/sign/PdfSigningService.js";
import {
  buildSignedBatchArchive,
  createBatchJob,
  getOwnedBatchJob,
  parseBatchDocumentContexts,
  parseBatchDocumentFields,
  selectSignedResults,
  startBatchSigningLoop,
  updateBatchJob,
} from "../../services/sign/BatchSigningService.js";
import {
  ensureBucketExists,
  getMinioObjectStream,
  removeMinioObject,
  statMinioObject,
  uploadFileToMinio
} from "../../services/storage/minio_service.js";

const pool = getPostgresPool();

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
    const context = await buildSignContext({ body: req.body, userId: req.user?.uid });
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
    return res.status(error.statusCode ?? 500).json({
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

    const user = await resolveSigningUser(req.user?.uid);
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
    return res.status(error.statusCode ?? 500).json({ error: error.message || "No se pudo validar el documento." });
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

    // El job se crea DESPUÉS de validar: si la validación falla, la tabla no crece con jobs
    // huérfanos en "processing" (lo fija `batch_start_certificado_inexistente`).
    const context = await buildSignContext({ body: req.body, userId: req.user?.uid });
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

    startBatchSigningLoop({ job, files, context, batchDocumentFields, batchDocumentContexts });

    return res.status(202).json({
      message: "Proceso batch iniciado.",
      jobId: job.jobId,
      signMode: context.signMode,
      total: job.total
    });
  } catch (error) {
    console.error("[sign_controller][batch-start] Error:", error);
    return res.status(error.statusCode ?? 500).json({ error: error.message || "No se pudo iniciar la firma masiva." });
  }
};

export const getSignBatchStatus = async (req, res) => {
  try {
    const user = await resolveSigningUser(req.user?.uid);
    const jobId = String(req.params?.jobId || "");
    // Existencia y propiedad se resuelven JUNTAS: un lote ajeno responde igual que uno inexistente
    // para no confirmar cuáles existen (ver `selectOwnedBatchJob`).
    const job = await getOwnedBatchJob(jobId, user.id);
    if (!job) {
      return res.status(404).json({ error: "Job batch no encontrado." });
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
    const user = await resolveSigningUser(req.user?.uid);
    const jobId = String(req.params?.jobId || "");
    // Mismo criterio que en `getSignBatchStatus`: ajeno e inexistente son indistinguibles, y ambos
    // se cortan ANTES de tocar el almacenamiento.
    const job = await getOwnedBatchJob(jobId, user.id);
    if (!job) {
      return res.status(404).json({ error: "Job batch no encontrado." });
    }

    const signedResults = selectSignedResults(job);
    if (!signedResults.length) {
      return res.status(400).json({ error: "Este lote no tiene documentos firmados para descargar." });
    }

    const archive = await buildSignedBatchArchive(jobId, signedResults);
    workspace = archive.workspace;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="firmas-lote-${jobId}.zip"`);
    res.download(archive.zipPath, `firmas-lote-${jobId}.zip`, () => {
      fs.rm(archive.workspace, { recursive: true, force: true }, () => {});
      fs.rm(archive.zipPath, { force: true }, () => {});
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
    const user = await resolveSigningUser(req.user?.uid);
    const requestedPath = String(req.query?.path || "").trim().replace(/^\/+/, "");
    if (!requestedPath) {
      return res.status(400).json({ error: "Falta el parámetro 'path'." });
    }

    let bucket = null;
    let objectPath = null;

    // El prefijo `users/<cédula>/` es un ATAJO: es el espacio personal de quien pide, así que se
    // salta la consulta de propiedad y va derecho a MinIO. Por eso una ruta propia inexistente
    // acaba en 404 y una ajena inexistente en 403.
    if (requestedPath.startsWith(`users/${user.cedula}/`)) {
      bucket = MINIO_USERS_BUCKET;
      objectPath = requestedPath;
    } else {
      if (!pool) {
        return res.status(500).json({ error: "La conexión a PostgreSQL no está disponible." });
      }
      const permitido = await userCanAccessStoredDocument({ userId: user.id, requestedPath });
      if (!permitido) {
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
