// TRANSPORTE DEL DOMINIO `firmas`: leer la peticion, llamar a UN servicio y traducir a HTTP.
//
// VINO DE `controllers/sign/sign_controller.js` al mover el dominio (F7.5 del frente 22), y de aquel
// fichero se quedo fuera UN manejador --`getSignatureFlow`-- que NO es de este dominio: devuelve el
// recorrido de un documento, y un recorrido en marcha es un hecho de `tareas`. Vive con los demas
// del recorrido, en `controllers/sign/sign_workflow_controller.js`.
//
// ⚠️ Y AQUI HABIA UN `const pool = getPostgresPool();` EN LA COLUMNA CERO, que ya no esta por dos
// motivos. El primero es de capas: un controlador no tiene pool --si necesita datos, llama a un
// servicio-- y F7.2 dejo `controllers/` y `routes/` con cero consultas, pero su medida no incluia
// esta forma. El segundo es un bug latente: capturaba el valor del momento del import, asi que si el
// modulo entraba antes de que existiera la conexion quedaba `undefined` para siempre y dos endpoints
// contestaban «La conexion a PostgreSQL no esta disponible» mandandote a buscar un problema de base
// de datos que no existe. Meter el dominio tras una puerta es justo lo que cambia el orden de carga.
//
// CONTRATO DE ERRORES: los errores de negocio traen `statusCode` (`errors/HttpError.js`) y aqui se
// honran; los que no lo traen son fallos de verdad y salen como 500. Antes toda la validacion de
// entrada de `requestSign` salia 500 --el cliente se llevaba un "error de servidor" por olvidarse la
// contrasena--; el orden de los guards y sus codigos estan congelados en
// `tests/characterization/flows/zzzz_sign_batch.test.mjs`.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  requestSignerValidationJob
} from "../../../services/infrastructure/rabbit_signer.js";
import {
  assertSignContextBeforeSigning,
  buildSignContext,
  buildValidationSpoolPath,
  ALMACEN_SPOOL_BUCKET,
  ALMACEN_USERS_BUCKET,
  persistSignatureWorkflowResult,
  processSinglePdfSigning,
  resolveSigningUser,
  resolveStoredDocumentObject,
  userCanAccessStoredDocument,
} from "../services/PdfSigningService.js";
import {
  buildSignedBatchArchive,
  createBatchJob,
  getOwnedBatchJob,
  parseBatchDocumentContexts,
  parseBatchDocumentFields,
  selectSignedResults,
  startBatchSigningLoop,
  updateBatchJob,
} from "../services/BatchSigningService.js";
import {
  ensureBucketExists,
  getAlmacenObjectStream,
  removeAlmacenObject,
  statAlmacenObject,
  uploadFileToAlmacen
} from "../../../services/storage/almacen_service.js";

// SUELTA LOS TEMPORALES DE MULTER, y existe porque se midieron 238 huerfanos en /tmp.
//
// Multer escribe cada PDF subido en `os.tmpdir()` (ver el `dest` del router) y **nadie los recoge
// por el hecho de contestar**. Quien los borra es el `finally` de `processSinglePdfSigning`, asi que
// todo camino que conteste ANTES de llegar ahi --un certificado que no existe, una contraseña que
// no cuadra, un contexto invalido-- deja el fichero en disco para siempre.
//
// Medido el 2026-11-10: tres PDF contra `batch/start` con un `certificate_id` inexistente dejaron
// /tmp en 235 -> 238 ficheros. Con el lote a 200 documentos y 30 MB por documento, UN rechazo
// tardio puede dejar 6 GB. Es un `unlink` con la devolucion vacia a proposito: si ya no esta
// --porque el `finally` de abajo se le adelanto-- no hay nada que contar.
const liberarTemporales = (req) => {
  const files = Array.isArray(req.files?.pdf) ? req.files.pdf : [];
  for (const file of files) {
    if (file?.path) {
      fs.unlink(file.path, () => {});
    }
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
      turno_id: req.body?.turno_id ?? null,
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
  } finally {
    // Incondicional: aqui el fichero NO sobrevive a la respuesta --la firma de a uno es sincrona--
    // asi que soltarlo dos veces es gratis y olvidarlo no.
    liberarTemporales(req);
  }
};

export const validateSignedDocument = async (req, res) => {
  let almacenPdfPath = null;
  try {
    const file = req.files?.pdf?.[0];
    if (!file) {
      return res.status(400).json({ error: "Se requiere el archivo PDF." });
    }

    const user = await resolveSigningUser(req.user?.uid);
    const sessionId = randomUUID();
    almacenPdfPath = buildValidationSpoolPath(user, sessionId, file.originalname);

    await ensureBucketExists(ALMACEN_SPOOL_BUCKET);
    await uploadFileToAlmacen(ALMACEN_SPOOL_BUCKET, almacenPdfPath, file.path, {
      "Content-Type": "application/pdf"
    });

    const result = await requestSignerValidationJob({
      almacenBucket: ALMACEN_SPOOL_BUCKET,
      almacenPdfPath,
      cedula: String(req.body?.cedula || "").trim() || undefined,
    });

    return res.json(result);
  } catch (error) {
    console.error("[sign_controller][validate] Error:", error);
    return res.status(error.statusCode ?? 500).json({ error: error.message || "No se pudo validar el documento." });
  } finally {
    liberarTemporales(req);
    if (almacenPdfPath) {
      await removeAlmacenObject(ALMACEN_SPOOL_BUCKET, almacenPdfPath).catch(() => {});
    }
  }
};

// DEPRECADO: el endpoint legacy POST /sign/batch firmaba de forma síncrona sin persistir evidencia de
// workflow ni estado de job. Sustituido por POST /sign/batch/start (asíncrono, con job persistido y
// evidencia de firma). Se conserva la ruta para devolver 410 Gone y guiar a los clientes legacy.
export const requestSignBatch = async (req, res) => {
  // Libera cualquier archivo subido por multer para no dejar temporales.
  liberarTemporales(req);
  return res.status(410).json({
    error: "Endpoint de firma masiva legacy retirado. Usa POST /sign/batch/start (procesa de forma asíncrona y persiste evidencia).",
    code: "SIGN_BATCH_LEGACY_GONE",
    use: "/sign/batch/start"
  });
};

export const requestSignBatchStart = async (req, res) => {
  // ⚠️ AQUI EL `finally` NO PUEDE SER INCONDICIONAL, y es la diferencia con `requestSign`: el lote
  // se firma en SEGUNDO PLANO, asi que cuando esta funcion contesta 202 los ficheros todavia hacen
  // falta. Desde ese momento los suelta el bucle --`processSinglePdfSigning` en su `finally`, o el
  // `catch` del bucle--, y borrarlos aqui se los quitaria de debajo. Antes de ese momento, no los
  // suelta nadie.
  let elBucleSeQuedaLosFicheros = false;
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
    elBucleSeQuedaLosFicheros = true;

    return res.status(202).json({
      message: "Proceso batch iniciado.",
      jobId: job.jobId,
      signMode: context.signMode,
      total: job.total
    });
  } catch (error) {
    console.error("[sign_controller][batch-start] Error:", error);
    return res.status(error.statusCode ?? 500).json({ error: error.message || "No se pudo iniciar la firma masiva." });
  } finally {
    if (!elBucleSeQuedaLosFicheros) {
      liberarTemporales(req);
    }
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
    // salta la consulta de propiedad y va derecho al almacén. Por eso una ruta propia inexistente
    // acaba en 404 y una ajena inexistente en 403.
    if (requestedPath.startsWith(`users/${user.cedula}/`)) {
      bucket = ALMACEN_USERS_BUCKET;
      objectPath = requestedPath;
    } else {
      // Aqui habia un `if (!pool)` que vigilaba el pool DEL CONTROLADOR para proteger una funcion
      // que usa el SUYO: no comprobaba nada util. Hoy la comprobacion vive donde esta la conexion,
      // en `datos/consulta/documentos.js`, que lanza si no hay.
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

    const stat = await statAlmacenObject(bucket, objectPath);
    const stream = await getAlmacenObjectStream(bucket, objectPath);
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
