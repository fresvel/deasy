// EXPERIMENTO F7 (2026-10-06) · El `datos/` de `firmas` para el flujo de firma.
// Movido desde `services/documents/DocumentWorkflowResetService.js` sin cambiar ninguna consulta.
// Toca SOLO tablas de `firmas`: signature_flow_instances, signature_requests,
// signature_flow_steps, signature_request_statuses.

export const getSignatureOwnershipAtStep = async (connection, documentVersionId, stepOrder, userId) => {
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
    [documentVersionId, stepOrder, userId]
  );
  return rows?.[0] || null;
};

export const findSignatureInstanceIdByDocumentVersion = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_flow_instances
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return Number(rows?.[0]?.id || 0);
};

export const cancelSignatureRequestsOfInstance = async (connection, instanceId, cancelledStatusId) => {
  await connection.query(
    // `UPDATE ... SET ... FROM`, no `UPDATE ... INNER JOIN ... SET`: lo segundo es MySQL y
    // PostgreSQL lo rechaza en tiempo de EJECUCION, no de carga. Las columnas del SET van sin
    // cualificar; en la parte derecha si vale `sr.`.
    `UPDATE signature_requests sr
        SET status_id = ?,
            responded_at = COALESCE(sr.responded_at, NOW())
       FROM signature_request_statuses srs
      WHERE srs.id = sr.status_id
        AND sr.instance_id = ?
        AND LOWER(srs.code) IN ('pendiente', 'en_progreso')`,
    [cancelledStatusId, instanceId]
  );
};

export const cancelSignatureInstance = async (connection, instanceId, cancelledStatusId) => {
  await connection.query(
    `UPDATE signature_flow_instances
     SET status_id = ?
     WHERE id = ?`,
    [cancelledStatusId, instanceId]
  );
};
