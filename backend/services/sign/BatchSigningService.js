// Motor de firma masiva — lo que antes vivía dentro de `controllers/sign/sign_controller.js`
// (fase D del plan de calidad, §5-D).
//
// Responsabilidad: el ciclo de vida de un job de lote (crear, avanzar, consultar) y el bucle que
// firma los PDF uno a uno en segundo plano, más el empaquetado ZIP de los resultados. El estado
// vive en PostgreSQL (`signature_batch_jobs`) y no en memoria, para que sobreviva a un reinicio.
//
// Lo que NO hace: decidir dónde se guarda cada PDF ni hablar con el firmante. Eso es de
// `PdfSigningService`, que este servicio llama documento a documento.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { getPostgresPool } from "../../config/postgres.js";
import { getMinioObjectStream } from "../storage/minio_service.js";
import { badRequest } from "../../errors/HttpError.js";
import {
  assertSignContextBeforeSigning,
  MINIO_USERS_BUCKET,
  persistSignatureWorkflowResult,
  processSinglePdfSigning,
} from "./PdfSigningService.js";

const pool = getPostgresPool();

// Ruta absoluta a propósito (`S4036`): con el nombre corto, el binario que se ejecuta depende del
// PATH del proceso. Mismo criterio que `utils/templateArchive.js` y `services/admin/kernel/storage.js`.
const ZIP_BINARY = "/usr/bin/zip";

export const parseBatchDocumentFields = (rawDocumentFields) => {
  if (!rawDocumentFields) return [];
  const parsed = JSON.parse(rawDocumentFields);
  if (!Array.isArray(parsed)) {
    throw badRequest("La configuración por documento es inválida.");
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

export const parseBatchDocumentContexts = (rawDocumentContexts) => {
  if (!rawDocumentContexts) return [];
  const parsed = JSON.parse(rawDocumentContexts);
  if (!Array.isArray(parsed)) {
    throw badRequest("La metadata por documento del lote es inválida.");
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

// Estado de los jobs de firma masiva PERSISTIDO en PostgreSQL (tabla signature_batch_jobs) para que
// sobreviva reinicios del backend (antes vivía en un Map en memoria y se perdía al reiniciar).
export const rowToBatchJob = (row) => {
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

export const createBatchJob = async ({ userId, fileNames, signMode }) => {
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

export const updateBatchJob = async (jobId, updater) => {
  const [rows] = await pool.query("SELECT * FROM signature_batch_jobs WHERE job_id = ? LIMIT 1", [jobId]);
  const current = rowToBatchJob(rows?.[0]);
  if (!current) return null;
  const next = typeof updater === "function" ? updater(current) : current;
  await persistBatchJob(next);
  return next;
};

// SIN exportar a propósito: leer un lote por id y sin dueño es justo lo que abría el oráculo de
// existencia. Fuera del módulo solo se ofrece `getOwnedBatchJob`.
const getBatchJob = async (jobId) => {
  const [rows] = await pool.query("SELECT * FROM signature_batch_jobs WHERE job_id = ? LIMIT 1", [jobId]);
  return rowToBatchJob(rows?.[0]);
};

// El job de OTRO usuario y un job INEXISTENTE valen lo mismo: null.
//
// Antes eran dos respuestas distintas (404 "no encontrado" vs 403 "no tienes acceso") y esa
// diferencia era un oráculo de existencia: probando jobIds contra `GET /sign/batch/:jobId` se podía
// ENUMERAR los lotes de los demás — el 403 confirma que el job existe, y de paso que su dueño no
// eres tú. No filtra el contenido, pero sí el censo.
//
// Se unifica en 404 (y no en 403) por dos motivos: es el código que NO confirma existencia, y ya
// era el que se devolvía en el camino frecuente, así que el contrato que ve el cliente no se
// ensancha. El frontend no ramifica por código —`FirmarPdf.vue` solo pinta `data.error`—, así que
// el cambio es invisible para el dueño legítimo del lote.
//
// Predicado puro y separado de la consulta a propósito: es lo único con reglas (la comparación
// numérica, el job ausente) y así se puede probar sin base de datos.
export const selectOwnedBatchJob = (job, userId) => {
  if (!job) return null;
  const owner = Number(job.userId);
  const requester = Number(userId);
  if (!Number.isFinite(owner) || !Number.isFinite(requester)) return null;
  return owner === requester ? job : null;
};

export const getOwnedBatchJob = async (jobId, userId) => selectOwnedBatchJob(await getBatchJob(jobId), userId);

const streamMinioObjectToFile = async (bucket, objectName, destinationPath) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  await pipeline(stream, fs.createWriteStream(destinationPath));
};

// ZIP que PRESERVA la estructura de carpetas: comprime el contenido de `cwd` recursivamente.
// El zipPath debe vivir FUERA de `cwd` para no incluirse a si mismo en el archivo.
const createStructuredZipArchive = async (cwd, zipPath) =>
  new Promise((resolve, reject) => {
    const zipProcess = spawn(ZIP_BINARY, ["-rq", zipPath, "."], { cwd, stdio: ["ignore", "ignore", "pipe"] });
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
export const sanitizeRelativePdfPath = (relativePath, fallbackName, index = 0) => {
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

// Arranca el bucle de firma del lote EN SEGUNDO PLANO y devuelve de inmediato. Cada documento
// avanza el job en la base, así que el estado sobrevive a un reinicio y el cliente lo consulta por
// `getBatchJob`. Un fallo de un documento no detiene el lote: se marca ese resultado como "error".
export const startBatchSigningLoop = ({ job, files, context, batchDocumentFields, batchDocumentContexts }) => {
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
        console.error("[BatchSigningService] Error firmando un documento del lote:", error);
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
};

// Los resultados descargables de un lote: los que se firmaron y dejaron ruta en almacenamiento.
export const selectSignedResults = (job) =>
  (Array.isArray(job?.results) ? job.results : []).filter((item) => item.status === "success" && item.signedPath);

// Baja los PDF firmados a un directorio temporal reconstruyendo la estructura de carpetas de
// entrada y los empaqueta en un ZIP. Devuelve las dos rutas para que quien llame las limpie.
export const buildSignedBatchArchive = async (jobId, signedResults) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "deasy-sign-batch-"));
  // El ZIP vive fuera del workspace para no incluirse a si mismo al comprimir recursivamente.
  const zipPath = path.join(os.tmpdir(), `firmas-lote-${jobId}-${randomUUID()}.zip`);
  const usedEntryPaths = new Set();

  for (let index = 0; index < signedResults.length; index += 1) {
    const result = signedResults[index];
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
  return { workspace, zipPath };
};
