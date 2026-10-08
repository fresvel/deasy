// EXPERIMENTO F7 (2026-10-06) · El `datos/` de `firmas` para el flujo de firma.
// Movido desde `services/documents/DocumentWorkflowResetService.js` sin cambiar ninguna consulta.
// Toca SOLO tablas de `firmas`: signature_flow_instances, signature_requests, signature_flow_steps.
//
// EL ESTADO ES UNA COLUMNA, no un catalogo, desde la fase 3 del frente 24: donde habia un
// `INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id` y un `LOWER(srs.code) IN (…)`
// ahora hay `sr.status IN (…)`. Una tabla menos en cada consulta, y el vocabulario cerrado por CHECK.

export const getSignatureOwnershipAtStep = async (connection, documentVersionId, stepOrder, userId) => {
  const [rows] = await connection.query(
    `SELECT
       sfi.id AS signature_flow_instance_id,
       sr.id AS signature_request_id
     FROM signature_flow_instances sfi
     INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     WHERE sfi.document_version_id = ?
       AND sfs.step_order = ?
       AND sr.assigned_person_id = ?
       AND sr.status IN ('pendiente', 'en_progreso')
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

export const cancelSignatureRequestsOfInstance = async (connection, instanceId, estadoCancelado) => {
  await connection.query(
    // Aqui habia un `UPDATE … SET … FROM signature_request_statuses` que solo existia para traducir
    // el codigo a id. Sin catalogo no hace falta `FROM` ninguno, asi que tampoco la trampa que el
    // comentario de al lado avisaba: `UPDATE … INNER JOIN … SET` es MySQL y PostgreSQL lo rechaza en
    // tiempo de EJECUCION. Se queda escrito porque la trampa sigue viva en el resto del repositorio.
    `UPDATE signature_requests
        SET status = ?,
            responded_at = COALESCE(responded_at, NOW())
      WHERE instance_id = ?
        AND status IN ('pendiente', 'en_progreso')`,
    [estadoCancelado, instanceId]
  );
};

export const cancelSignatureInstance = async (connection, instanceId, estadoCancelado) => {
  await connection.query(
    `UPDATE signature_flow_instances
     SET status = ?
     WHERE id = ?`,
    [estadoCancelado, instanceId]
  );
};

// REABRIR UN RECORRIDO RECHAZADO. Es la otra mitad del arreglo del atasco (frente 24, §11): al
// rechazar sin que nadie haya firmado, el documento vuelve a «Observado» y se corrige. Cuando
// regresa a la fase de firma hay que volver a convocar, y NO se puede crear una instancia nueva:
// `uq_signature_flow_instances_document` admite UNA por version de documento. Asi que se reabre la
// que hay.
//
// Las solicitudes rechazadas vuelven a `pendiente` y pierden su `responded_at`: a quien rechazo se
// le pregunta otra vez, que es el sentido de haber corregido el documento.
export const reabrirRecorridoDeFirma = async (connection, instanceId, estadoPendiente) => {
  await connection.query(
    `UPDATE signature_requests
        SET status = ?,
            responded_at = NULL
      WHERE instance_id = ?
        AND status = 'rechazado'`,
    [estadoPendiente, instanceId]
  );
  await connection.query(
    `UPDATE signature_flow_instances
     SET status = ?
     WHERE id = ?`,
    [estadoPendiente, instanceId]
  );
};
