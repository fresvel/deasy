// Máquina de estados de `fill_requests` — la lógica que antes vivía en
// `controllers/sign/sign_workflow_controller.js` (fase D del plan de calidad, §5-D).
//
// Las cinco acciones del flujo de entrega —start, approve, return, reject, cancel— comparten un
// único recorrido: resolver al actor, cargar el contexto de la solicitud, comprobar que la acción
// es legal, escribir el nuevo estado y propagar el progreso del documento. El controller solo
// traduce esto a HTTP.
//
// EL ORDEN DE LOS GUARDS ES CONTRATO y está congelado por
// `tests/characterization/flows/zzzz_sign_workflow.test.mjs`:
//   pool caído (500) -> actor inválido (500) -> id inválido (400) -> no existe (404) ->
//   no es tuya (403) -> sin responsable resoluble (409) -> transición ilegal (409) ->
//   (solo approve) falta el PDF en working (500).
//
// Los errores de NEGOCIO llevan `statusCode` (ver `errors/HttpError.js`); los que no lo llevan son
// fallos de verdad y el controller los devuelve como 500. Ese contrato es el que impide que un
// fallo de infraestructura se disfrace de culpa del cliente.

import UserRepository from "../auth/UserRepository.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors/HttpError.js";
import { getPostgresPool } from "../../config/postgres.js";
import { FILL_REQUEST_STATUS } from "./DocumentWorkflowCatalog.js";
import { syncDocumentProgressFromFillRequest } from "./DocumentProgressService.js";
import { addDocumentObservation } from "./DocumentObservationService.js";

const userRepository = new UserRepository();

const getCurrentUser = async (rawUserId, findUserById) => {
  const userId = Number(rawUserId);
  if (!userId || Number.isNaN(userId)) {
    throw new Error("Usuario autenticado inválido.");
  }
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado.");
  }
  return user;
};

export const getFillRequestContext = async (connection, fillRequestId) => {
  const [rows] = await connection.query(
    `SELECT
       fr.id,
       fr.fill_flow_step_id,
       fr.assigned_person_id,
       fr.status,
       fr.is_manual,
       dff.id AS document_fill_flow_id,
       dff.fill_flow_template_id,
       dff.document_version_id,
       ffs.step_order,
       dv.working_file_path,
       ti.id AS task_item_id,
       ti.process_definition_template_id,
       ti.user_started_at
     FROM fill_requests fr
     INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
     INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
     INNER JOIN document_versions dv ON dv.id = dff.document_version_id
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     WHERE fr.id = ?
     LIMIT 1`,
    [fillRequestId]
  );
  return rows?.[0] || null;
};

export const reactivatePreviousFillStepIfNeeded = async (connection, context) => {
  const currentStepOrder = Number(context?.step_order || 0);
  if (currentStepOrder <= 1) {
    return null;
  }

  const previousStepOrder = currentStepOrder - 1;
  const [previousStepRows] = await connection.query(
    `SELECT ffs.id
     FROM document_fill_flows dff
     INNER JOIN fill_flow_steps ffs ON ffs.fill_flow_template_id = dff.fill_flow_template_id
     WHERE dff.id = ?
       AND ffs.step_order = ?
     LIMIT 1`,
    [context.document_fill_flow_id, previousStepOrder]
  );
  const previousStep = previousStepRows?.[0];
  if (!previousStep?.id) {
    return null;
  }

  await connection.query(
    `UPDATE fill_requests
     SET status = ?,
         responded_at = NULL,
         response_note = NULL
     WHERE document_fill_flow_id = ?
       AND fill_flow_step_id = ?`,
    [FILL_REQUEST_STATUS.PENDING, context.document_fill_flow_id, Number(previousStep.id)]
  );

  return previousStepOrder;
};

export const requiresSignaturePdfForFinalFillApproval = async (connection, context) => {
  if (!context?.process_definition_template_id || !context?.fill_flow_template_id) {
    return false;
  }

  const [fillRows] = await connection.query(
    `SELECT MAX(step_order) AS max_step_order
     FROM fill_flow_steps
     WHERE fill_flow_template_id = ?`,
    [context.fill_flow_template_id]
  );
  const maxStepOrder = Number(fillRows?.[0]?.max_step_order || 0);
  if (!maxStepOrder || Number(context.step_order) !== maxStepOrder) {
    return false;
  }

  const [signatureRows] = await connection.query(
    `SELECT COUNT(sfs.id) AS total
     FROM signature_flow_templates sft
     INNER JOIN signature_flow_steps sfs ON sfs.template_id = sft.id
     WHERE sft.process_definition_template_id = ?
       AND sft.is_active = 1`,
    [context.process_definition_template_id]
  );
  const totalSignatureSteps = Number(signatureRows?.[0]?.total || 0);
  if (!totalSignatureSteps) {
    return false;
  }

  const workingPath = String(context.working_file_path || "").trim().toLowerCase();
  return !workingPath.endsWith(".pdf");
};

// Estados desde los que cada acción es legal. Es un `Map` y no un objeto literal por una razón
// medida: con un objeto, `allowedByAction["toString"]` devuelve el método heredado de
// `Object.prototype` y `?.has` reventaba con un TypeError (500) en vez de con el 409 de siempre.
// Hoy la acción la fija el router, así que no era alcanzable; con un `Map` deja de depender de eso.
const ALLOWED_STATUSES_BY_ACTION = new Map([
  ["start", new Set([FILL_REQUEST_STATUS.PENDING])],
  ["approve", new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS])],
  ["return", new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS])],
  ["reject", new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS])],
  ["cancel", new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS])],
]);

export const assertFillActionAllowed = ({ action, currentStatus, assignedPersonId, currentUserId, isManual }) => {
  const normalizedStatus = String(currentStatus || "").trim().toLowerCase();

  if (assignedPersonId && Number(assignedPersonId) !== Number(currentUserId)) {
    throw forbidden("No puedes operar una solicitud de entrega asignada a otro usuario.");
  }

  // Sin responsable y sin modo manual no hay a quién comparar: el guard de propiedad de arriba no
  // puede pronunciarse. Eso NO lo convierte en un fallo del servidor —la petición es correcta y el
  // servidor está sano—, sino en un CONFLICTO con el estado del recurso: la solicitud está mal
  // configurada y no se puede operar hasta que alguien le asigne responsable. Por eso 409 y no 500
  // (antes era 500 y se lo llevaba cualquier usuario autenticado; ver `sin_responsable_*`).
  if (!assignedPersonId && !isManual) {
    throw conflict("La solicitud de entrega no tiene un responsable resoluble.");
  }

  if (!ALLOWED_STATUSES_BY_ACTION.get(action)?.has(normalizedStatus)) {
    throw conflict(`La solicitud no puede pasar de ${currentStatus} usando la acción ${action}.`);
  }
};

// Punto de entrada único de las cinco acciones. Devuelve el resultado de negocio; NO sabe de HTTP.
// El segundo argumento existe para las pruebas: en producción nadie lo pasa.
export const updateFillRequestStatus = async (
  { userId, requestId, action, nextStatus, note = null },
  { pool = getPostgresPool(), findUserById = (id) => userRepository.findById(id) } = {},
) => {
  if (!pool) {
    throw new Error("La conexión con PostgreSQL no está disponible.");
  }

  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser(userId, findUserById);
    const fillRequestId = Number(requestId);
    if (!fillRequestId || Number.isNaN(fillRequestId)) {
      throw badRequest("Solicitud de entrega inválida.");
    }

    await connection.beginTransaction();
    const context = await getFillRequestContext(connection, fillRequestId);
    if (!context) {
      throw notFound("Solicitud de entrega no encontrada.");
    }

    assertFillActionAllowed({
      action,
      currentStatus: context.status,
      assignedPersonId: context.assigned_person_id,
      currentUserId: user.id,
      isManual: Boolean(context.is_manual),
    });

    if (action === "approve") {
      const requiresPdf = await requiresSignaturePdfForFinalFillApproval(connection, context);
      if (requiresPdf) {
        throw new Error(
          "El último paso del flujo de entrega requiere un PDF en working para habilitar la firma."
        );
      }
    }

    const shouldRespondNow = nextStatus !== FILL_REQUEST_STATUS.IN_PROGRESS;
    const assignedPersonId = context.assigned_person_id || (context.is_manual ? Number(user.id) : null);
    await connection.query(
      `UPDATE fill_requests
       SET assigned_person_id = ?,
           status = ?,
           responded_at = ?,
           response_note = ?
       WHERE id = ?`,
      [
        assignedPersonId,
        nextStatus,
        shouldRespondNow ? new Date() : null,
        note,
        fillRequestId,
      ]
    );

    if (action === "return") {
      await reactivatePreviousFillStepIfNeeded(connection, context);
    }

    // Auto-captura: una devolución/rechazo de revisión con motivo queda como observación del hilo.
    if ((action === "return" || action === "reject") && note && context.task_item_id) {
      await addDocumentObservation(connection, {
        taskItemId: context.task_item_id,
        documentVersionId: context.document_version_id,
        fillRequestId,
        phase: "review",
        kind: action === "reject" ? "rejection_reason" : "return_reason",
        message: note,
        authorPersonId: user.id
      });
    }

    if (action === "start" && context.task_item_id && !context.user_started_at) {
      await connection.query(
        `UPDATE task_items
         SET user_started_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND user_started_at IS NULL`,
        [Number(context.task_item_id)]
      );
    }

    const progress = await syncDocumentProgressFromFillRequest(connection, fillRequestId);
    await connection.commit();

    return {
      fillRequestId,
      status: nextStatus,
      documentVersionId: progress?.documentVersionId ?? Number(context.document_version_id),
      flowStatus: progress?.flowStatus ?? null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
