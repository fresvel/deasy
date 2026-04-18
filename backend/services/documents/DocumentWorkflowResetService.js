import { ensureFillFlowForDocumentVersion } from "../admin/TaskGenerationService.js";
import { transitionDocumentVersionState } from "./DocumentStateService.js";
import {
  getSignatureRequestStatusIdByCode,
  SIGNATURE_REQUEST_STATUS,
} from "./DocumentWorkflowCatalog.js";
import { resolveCurrentSignatureStep } from "./DocumentSignatureWorkflowService.js";

const RESET_NOTE = "Reset manual del flujo";

const getLatestDocumentVersionForTaskItem = async (connection, definitionId, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT
       ti.id AS task_item_id,
       t.id AS task_id,
       t.term_id,
       pdv.process_id,
       trm.term_type_id,
       trm.start_date AS term_start_date,
       YEAR(trm.start_date) AS term_year,
       d.id AS document_id,
       dv.id AS document_version_id,
       dv.version AS document_version,
       dv.status AS document_version_status,
       dv.template_artifact_id,
       dv.payload_mongo_id,
       dv.payload_hash,
       dv.payload_object_path,
       dv.format,
       dv.render_engine,
       dv.working_file_path,
       dv.final_file_path
     FROM task_items ti
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     INNER JOIN terms trm ON trm.id = t.term_id
     INNER JOIN documents d ON d.task_item_id = ti.id
     INNER JOIN document_versions dv ON dv.document_id = d.id
     INNER JOIN (
       SELECT document_id, MAX(version) AS max_version
       FROM document_versions
       GROUP BY document_id
     ) latest
       ON latest.document_id = dv.document_id
      AND latest.max_version = dv.version
     WHERE ti.id = ?
       AND t.process_definition_id = ?
     LIMIT 1`,
    [taskItemId, definitionId]
  );
  return rows?.[0] || null;
};

const getCurrentFillOwnership = async (connection, documentVersionId, userId) => {
  const [rows] = await connection.query(
    `SELECT
       dff.id AS document_fill_flow_id,
       dff.current_step_order,
       fr.id AS fill_request_id
     FROM document_fill_flows dff
     INNER JOIN fill_flow_steps ffs
       ON ffs.fill_flow_template_id = dff.fill_flow_template_id
      AND ffs.step_order = dff.current_step_order
     INNER JOIN fill_requests fr
       ON fr.document_fill_flow_id = dff.id
      AND fr.fill_flow_step_id = ffs.id
     WHERE dff.document_version_id = ?
       AND fr.assigned_person_id = ?
       AND fr.status IN ('pending', 'in_progress')
     LIMIT 1`,
    [documentVersionId, userId]
  );
  return rows?.[0] || null;
};

const getCurrentSignatureOwnership = async (connection, documentVersionId, userId) => {
  const currentStep = await resolveCurrentSignatureStep(connection, documentVersionId);
  if (!currentStep?.stepOrder) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT
       sfi.id AS signature_flow_instance_id,
       sr.id AS signature_request_id
     FROM signature_flow_instances sfi
     INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     WHERE sfi.document_version_id = ?
       AND sfs.step_order = ?
       AND sr.assigned_person_id = ?
       AND LOWER(srs.code) IN ('pendiente', 'en_progreso')
       AND sr.responded_at IS NULL
     LIMIT 1`,
    [documentVersionId, Number(currentStep.stepOrder), userId]
  );
  return rows?.[0] || null;
};

const cancelOpenFillRequests = async (connection, documentVersionId) => {
  const [flows] = await connection.query(
    `SELECT id
     FROM document_fill_flows
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  const flowId = Number(flows?.[0]?.id || 0);
  if (!flowId) {
    return;
  }

  await connection.query(
    `UPDATE fill_requests
     SET status = 'cancelled',
         responded_at = COALESCE(responded_at, NOW()),
         response_note = COALESCE(response_note, ?)
     WHERE document_fill_flow_id = ?
       AND status IN ('pending', 'in_progress', 'returned')`,
    [RESET_NOTE, flowId]
  );

  await connection.query(
    `UPDATE document_fill_flows
     SET status = 'cancelled'
     WHERE id = ?`,
    [flowId]
  );
};

const cancelOpenSignatureRequests = async (connection, documentVersionId) => {
  const [instances] = await connection.query(
    `SELECT id
     FROM signature_flow_instances
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  const instanceId = Number(instances?.[0]?.id || 0);
  if (!instanceId) {
    return;
  }

  const cancelledStatusId = await getSignatureRequestStatusIdByCode(
    connection,
    SIGNATURE_REQUEST_STATUS.CANCELLED
  );
  if (!cancelledStatusId) {
    throw new Error("No existe el estado cancelado para solicitudes de firma.");
  }

  await connection.query(
    `UPDATE signature_requests sr
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     SET sr.status_id = ?,
         sr.responded_at = COALESCE(sr.responded_at, NOW())
     WHERE sr.instance_id = ?
       AND LOWER(srs.code) IN ('pendiente', 'en_progreso')`,
    [cancelledStatusId, instanceId]
  );

  await connection.query(
    `UPDATE signature_flow_instances
     SET status_id = ?
     WHERE id = ?`,
    [cancelledStatusId, instanceId]
  );
};

const createResetDocumentVersion = async (connection, currentVersion) => {
  const [maxRows] = await connection.query(
    `SELECT MAX(version) AS max_version
     FROM document_versions
     WHERE document_id = ?`,
    [currentVersion.document_id]
  );
  const nextVersion = Number((Number(maxRows?.[0]?.max_version || 0) + 0.1).toFixed(1));

  const [insertResult] = await connection.query(
    `INSERT INTO document_versions (
       document_id,
       version,
       template_artifact_id,
       payload_mongo_id,
       payload_hash,
       payload_object_path,
       working_file_path,
       final_file_path,
       format,
       render_engine,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(currentVersion.document_id),
      nextVersion,
      currentVersion.template_artifact_id ?? null,
      currentVersion.payload_mongo_id ?? null,
      currentVersion.payload_hash ?? null,
      currentVersion.payload_object_path ?? null,
      null,
      null,
      currentVersion.format ?? null,
      currentVersion.render_engine ?? null,
      "Borrador",
    ]
  );

  return {
    id: Number(insertResult.insertId),
    version: nextVersion,
  };
};

export const resetDocumentWorkflowForTaskItem = async ({
  connection,
  userId,
  definitionId,
  taskItemId,
}) => {
  const currentVersion = await getLatestDocumentVersionForTaskItem(connection, definitionId, taskItemId);
  if (!currentVersion?.document_version_id) {
    const error = new Error("No se encontró una versión documental activa para ese entregable.");
    error.statusCode = 404;
    throw error;
  }

  const documentVersionId = Number(currentVersion.document_version_id);
  const fillOwnership = await getCurrentFillOwnership(connection, documentVersionId, userId);
  const signatureOwnership = await getCurrentSignatureOwnership(connection, documentVersionId, userId);
  if (!fillOwnership && !signatureOwnership) {
    const error = new Error(
      "Solo el responsable del paso actual de llenado o firma puede resetear este flujo."
    );
    error.statusCode = 403;
    throw error;
  }

  await cancelOpenFillRequests(connection, documentVersionId);
  await cancelOpenSignatureRequests(connection, documentVersionId);
  await transitionDocumentVersionState(connection, documentVersionId, "Cancelado");

  const nextVersion = await createResetDocumentVersion(connection, currentVersion);
  await ensureFillFlowForDocumentVersion(connection, nextVersion.id);

  return {
    documentId: Number(currentVersion.document_id),
    previousDocumentVersionId: documentVersionId,
    previousDocumentVersion: Number(currentVersion.document_version || 0),
    newDocumentVersionId: nextVersion.id,
    newDocumentVersion: nextVersion.version,
    resetBy: fillOwnership ? "fill" : "signature",
  };
};
