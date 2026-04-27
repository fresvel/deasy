import UserRepository from "../../services/auth/UserRepository.js";
import { getMariaDBPool } from "../../config/mariadb.js";
import { FILL_REQUEST_STATUS } from "../../services/documents/DocumentWorkflowCatalog.js";
import { syncDocumentProgressFromFillRequest } from "../../services/documents/DocumentProgressService.js";

const userRepository = new UserRepository();
const pool = getMariaDBPool();

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

const getFillRequestContext = async (connection, fillRequestId) => {
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

const reactivatePreviousFillStepIfNeeded = async (connection, context) => {
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

const requiresSignaturePdfForFinalFillApproval = async (connection, context) => {
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

const assertFillActionAllowed = ({ action, currentStatus, assignedPersonId, currentUserId, isManual }) => {
  const normalizedStatus = String(currentStatus || "").trim().toLowerCase();

  if (assignedPersonId && Number(assignedPersonId) !== Number(currentUserId)) {
    throw new Error("No puedes operar una solicitud de llenado asignada a otro usuario.");
  }

  if (!assignedPersonId && !isManual) {
    throw new Error("La solicitud de llenado no tiene un responsable resoluble.");
  }

  const allowedByAction = {
    start: new Set([FILL_REQUEST_STATUS.PENDING]),
    approve: new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS]),
    return: new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS]),
    reject: new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS]),
    cancel: new Set([FILL_REQUEST_STATUS.PENDING, FILL_REQUEST_STATUS.IN_PROGRESS]),
  };

  if (!allowedByAction[action]?.has(normalizedStatus)) {
    throw new Error(`La solicitud no puede pasar de ${currentStatus} usando la acción ${action}.`);
  }
};

const updateFillRequestStatus = async ({ req, res, action, nextStatus }) => {
  if (!pool) {
    return res.status(500).json({ error: "La conexión con MariaDB no está disponible." });
  }

  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser(req);
    const fillRequestId = Number(req.params?.requestId);
    if (!fillRequestId || Number.isNaN(fillRequestId)) {
      return res.status(400).json({ error: "Solicitud de llenado inválida." });
    }

    await connection.beginTransaction();
    const context = await getFillRequestContext(connection, fillRequestId);
    if (!context) {
      await connection.rollback();
      return res.status(404).json({ error: "Solicitud de llenado no encontrada." });
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
          "El último paso del flujo de llenado requiere un PDF en working para habilitar la firma."
        );
      }
    }

    const note = String(req.body?.note || req.body?.response_note || "").trim() || null;
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

    return res.json({
      message: "Solicitud de llenado actualizada.",
      fillRequestId,
      status: nextStatus,
      documentVersionId: progress?.documentVersionId ?? Number(context.document_version_id),
      flowStatus: progress?.flowStatus ?? null,
    });
  } catch (error) {
    await connection.rollback();
    console.error("[sign_workflow_controller] Error fill request:", error);
    return res.status(500).json({ error: error.message || "No se pudo actualizar la solicitud de llenado." });
  } finally {
    connection.release();
  }
};

export const startFillRequest = (req, res) =>
  updateFillRequestStatus({ req, res, action: "start", nextStatus: FILL_REQUEST_STATUS.IN_PROGRESS });

export const approveFillRequest = (req, res) =>
  updateFillRequestStatus({ req, res, action: "approve", nextStatus: FILL_REQUEST_STATUS.APPROVED });

export const returnFillRequest = (req, res) =>
  updateFillRequestStatus({ req, res, action: "return", nextStatus: FILL_REQUEST_STATUS.RETURNED });

export const rejectFillRequest = (req, res) =>
  updateFillRequestStatus({ req, res, action: "reject", nextStatus: FILL_REQUEST_STATUS.REJECTED });

export const cancelFillRequest = (req, res) =>
  updateFillRequestStatus({ req, res, action: "cancel", nextStatus: FILL_REQUEST_STATUS.CANCELLED });
