// EXPERIMENTO F7 (2026-10-06) · El `datos/` de `plantillas` para el flujo de llenado.
// Movido desde `services/documents/DocumentWorkflowResetService.js` sin cambiar ninguna consulta.
// Toca SOLO tablas de `plantillas`: document_fill_flows, fill_flow_steps, fill_requests.

export const getCurrentFillOwnership = async (connection, documentVersionId, userId) => {
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
       AND fr.status IN ('pendiente', 'en_progreso')
     LIMIT 1`,
    [documentVersionId, userId]
  );
  return rows?.[0] || null;
};

export const findFillFlowIdByDocumentVersion = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM document_fill_flows
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return Number(rows?.[0]?.id || 0);
};

export const cancelFillRequestsOfFlow = async (connection, flowId, nota) => {
  await connection.query(
    `UPDATE fill_requests
     SET status = 'cancelado',
         responded_at = COALESCE(responded_at, NOW()),
         response_note = COALESCE(response_note, ?)
     WHERE document_fill_flow_id = ?
       AND status IN ('pendiente', 'en_progreso', 'devuelto')`,
    [nota, flowId]
  );
};

export const cancelFillFlow = async (connection, flowId) => {
  await connection.query(
    `UPDATE document_fill_flows
     SET status = 'cancelado'
     WHERE id = ?`,
    [flowId]
  );
};

// EL AVANCE DEL RECORRIDO. La escribía `services/documents/DocumentProgressService.js` por su cuenta,
// y la destapó la comprobación C al integrar el piloto. Quien CALCULA el estado y el paso siguiente
// sigue siendo ese servicio: aquí sólo se guarda lo que ya decidió.
export const actualizarAvanceDelFlujo = async (connection, flowId, estado, pasoSiguiente) => {
  await connection.query(
    `UPDATE document_fill_flows
     SET status = ?,
         current_step_order = ?
     WHERE id = ?`,
    [estado, pasoSiguiente, flowId]
  );
};
