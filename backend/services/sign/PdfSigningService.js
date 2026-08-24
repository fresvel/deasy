// Plan de almacenamiento y firma de un PDF — lo que antes vivía dentro de
// `controllers/sign/sign_controller.js` (fase D del plan de calidad, §5-D).
//
// Responsabilidad: a partir de la petición de firma, decidir DÓNDE vive el PDF (una versión
// documental del flujo, o el espacio personal de quien firma), validar que se puede firmar y
// pedirle al microservicio de firma que lo haga. La persistencia de la evidencia de workflow
// también vive aquí porque es la misma transacción de negocio.
//
// CONTRATO DE ERRORES. Todo lo que es culpa del cliente —falta el certificado, la contraseña, el
// sello, el certificado no es suyo— sale con `statusCode` (ver `errors/HttpError.js`) para que el
// controller lo devuelva como 4xx. Antes TODO salía como 500 y la validación de entrada se
// presentaba como error de servidor; el diff de los goldens `sign_sin_*` de
// `tests/characterization/flows/zzzz_sign_batch.test.mjs` es la prueba del arreglo.
// Lo que NO lleva `statusCode` —MinIO caído, PostgreSQL caído, el firmante sin responder— sigue
// siendo 500, que es lo que es.

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { getPostgresPool } from "../../config/postgres.js";
import UserRepository from "../auth/UserRepository.js";
import UserCertificateRepository from "../auth/UserCertificateRepository.js";
import { badRequest, notFound } from "../../errors/HttpError.js";
import { requestSignerJob } from "../infrastructure/rabbit_signer.js";
import { formatTokenForSigner } from "../../utils/tokenGenerator.js";
import {
  assertSignatureRequestCanBeSigned,
  registerSignatureEvidence,
} from "../documents/DocumentSignatureWorkflowService.js";
import {
  ensureBucketExists,
  statMinioObject,
  uploadFileToMinio
} from "../storage/minio_service.js";

const userRepository = new UserRepository();
const certificateRepository = new UserCertificateRepository();
const pool = getPostgresPool();

export const MINIO_DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents";
const MINIO_DOCUMENTS_PREFIX = String(process.env.MINIO_DOCUMENTS_PREFIX || "Unidades").replace(/^\/+|\/+$/g, "");
export const MINIO_SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || "deasy-spool";
export const MINIO_USERS_BUCKET = process.env.MINIO_USERS_BUCKET || "deasy-users";

const sanitizeStorageSegment = (value, fallback = "na") =>
  String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;

export const resolveStoredDocumentObject = (storedPath) => {
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

// Resuelve a la persona autenticada. Vive aquí y no en el controller porque `buildSignContext`
// necesita hacerlo EN SU SITIO dentro de la cadena de validación (después del sello, antes del
// certificado) y ese orden es contrato caracterizado.
export const resolveSigningUser = async (rawUserId) => {
  const userId = Number(rawUserId);
  if (!userId || Number.isNaN(userId)) {
    throw new Error("Usuario autenticado inválido.");
  }
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado.");
  }
  return user;
};

export const buildValidationSpoolPath = (user, sessionId, fileName = "documento.pdf") => {
  const safeName = String(fileName || "documento.pdf")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^\.+/, "") || "documento.pdf";
  return `users/${user.cedula}/validation/${sessionId}/${safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`}`;
};

// El segundo argumento existe para las pruebas: en producción nadie lo pasa.
export const buildSignContext = async (
  { body = {}, userId },
  {
    resolveUser = resolveSigningUser,
    findOwnedCertificate = (ownerId, certificateId) => certificateRepository.findOwnedById(ownerId, certificateId),
    statObject = statMinioObject,
  } = {},
) => {
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
  } = body;
  const certificateId = Number(certificateIdRaw);
  if (!certificateId || Number.isNaN(certificateId)) {
    throw badRequest("Debes seleccionar un certificado guardado.");
  }
  if (!password) {
    throw badRequest("Debes ingresar la contraseña del certificado.");
  }
  if (!stampText?.trim()) {
    throw badRequest("Debes indicar el texto del sello.");
  }

  const user = await resolveUser(userId);
  const certificate = await findOwnedCertificate(user.id, certificateId);
  if (!certificate) {
    // 404 y no 403: `findOwnedById` ya filtra por dueño, así que un certificado ajeno y uno
    // inexistente son indistinguibles a propósito (no se puede sondear el catálogo de otro).
    throw notFound("Certificado no encontrado para este usuario.");
  }
  try {
    await statObject(certificate.bucket, certificate.object_name);
  } catch (error) {
    // El mensaje al usuario es accionable y se conserva, pero antes se TRAGABA la causa: con MinIO
    // caído se le decía "vuelve a cargar tus certificados", que es mentira. La causa real va al log
    // y viaja como `cause` (el controller la expone en `details`). Sigue siendo 500: es infra.
    console.error("[PdfSigningService] No se pudo leer el certificado en el almacenamiento", {
      bucket: certificate.bucket,
      objectName: certificate.object_name,
    }, error);
    throw new Error(
      "El certificado seleccionado ya no está disponible en almacenamiento. Vuelve a cargar tus certificados y elige uno válido.",
      { cause: error },
    );
  }

  const signMode = String(signModeRaw || "coordinates").trim().toLowerCase();
  if (!["coordinates", "token"].includes(signMode)) {
    throw badRequest("Modo de firma inválido.");
  }

  const hasDocumentFields = Boolean(body.document_fields);
  const fields =
    signMode === "coordinates"
      ? hasDocumentFields
        ? (() => {
            try {
              return parseFields(body.fields);
            } catch {
              return [];
            }
          })()
        : parseFields(body.fields)
      : [];
  const resolvedToken = signMode === "token"
    ? (() => {
        const rawToken = String(tokenRaw || user.signatureToken || "").trim();
        if (!rawToken) {
          throw badRequest("El usuario no tiene token de firma configurado.");
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

export const buildStandaloneUserSignedPath = (user, sessionId, originalName = "documento.pdf") => {
  const safeName = sanitizeStorageSegment(originalName, "documento.pdf");
  const fileName = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  return `users/${user.cedula}/signed/${sessionId}/${fileName}`;
};

export const resolveSigningStoragePlan = async ({ context, file }) => {
  if (context.documentVersionId) {
    const documentVersion = await getDocumentVersionStorageContext(context.documentVersionId);
    if (!documentVersion?.id) {
      throw notFound("No se encontró la versión documental indicada para la firma.");
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

export const processSinglePdfSigning = async ({ file, context }) => {
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

    console.info("[PdfSigningService] processSinglePdfSigning storage plan", {
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

    console.info("[PdfSigningService] signer result", {
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

export const assertSignContextBeforeSigning = async (context) => {
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

export const parseFields = (rawFields) => {
  let parsed;
  try {
    parsed = JSON.parse(rawFields || "[]");
  } catch {
    throw badRequest("La configuración de campos de firma no es un JSON válido.");
  }
  if (!Array.isArray(parsed) || !parsed.length) {
    throw badRequest("Debe incluir al menos un campo de firma.");
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

// El tercer argumento existe para las pruebas: en producción nadie lo pasa.
export const resolveFieldsForPdf = async (filePath, fields, { getPageCount = getPdfPageCount } = {}) => {
  const totalPages = await getPageCount(filePath);
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

const asBoolean = (value) =>
  String(value ?? "").trim().toLowerCase() === "true" || String(value ?? "").trim() === "1";

export const persistSignatureWorkflowResult = async ({ context, result }) => {
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

// ¿Puede esta persona leer un documento firmado que NO está en su espacio personal? Lo autoriza
// cualquiera de los TRES papeles del entregable: quien responde de él, quien lo encargó o quien
// tiene que firmarlo. Eran cuatro hasta el 2026-08-23, y el que sobraba era «dueño del documento»:
// una copia del primero que sólo refrescaba uno de los cuatro caminos de relevo. La consulta vivía
// en el controller.
//
// La versión cuelga DIRECTAMENTE del entregable desde el 2026-08-23: la tabla `documents` que había
// en medio era una cascara 1:1 sin ni una columna propia, y se retiró con ella el JOIN que hacía
// falta para saltarla.
export const userCanAccessStoredDocument = async ({ userId, requestedPath }) => {
  if (!pool) {
    throw new Error("La conexión a PostgreSQL no está disponible.");
  }
  const [rows] = await pool.query(
    `SELECT dv.id
     FROM document_versions dv
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
     LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
     WHERE (
       dv.working_file_path = ?
       OR dv.final_file_path = ?
     )
       AND (
         -- El d.owner_person_id = ? que abria este OR se retiro el 2026-08-23: era una COPIA de
         -- ti.assigned_person_id, el termino de al lado, tomada al crear el documento y
         -- refrescada por uno solo de los cuatro relevos. O sea que aportaba exactamente cero
         -- casos nuevos y podia dar acceso a quien ya no responde del entregable.
         ti.assigned_person_id = ?
         -- Quien ENCARGO el entregable. Antes era el creador de la TAREA, retirado el 2026-08-23:
         -- estaba NULL en el camino automatico, asi que como predicado de propiedad casi nunca
         -- respondia. El dato equivalente vive en la misma fila del entregable.
         OR ti.created_by_person_id = ?
         OR sr.assigned_person_id = ?
       )
     LIMIT 1`,
    [requestedPath, requestedPath, Number(userId), Number(userId), Number(userId)]
  );
  return Boolean(rows?.length);
};
