import { getPostgresPool } from "../../config/postgres.js";

const VALID_PHASES = new Set(["review", "signature"]);
const VALID_KINDS = new Set(["observation", "return_reason", "rejection_reason", "internal_note"]);

// Versión documental actual de un entregable (un documento principal por task_item).
export const getCurrentDocumentVersionId = async (connection, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT dv.id
     FROM documents d
     INNER JOIN document_versions dv ON dv.document_id = d.id
     WHERE d.task_item_id = ?
     ORDER BY dv.version DESC, dv.id DESC
     LIMIT 1`,
    [taskItemId]
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
};

// Inserta una observación. Reutilizable desde la auto-captura (devolución/rechazo) y desde el
// endpoint manual. Resuelve la versión documental actual si no se indica.
export const addDocumentObservation = async (connection, {
  taskItemId,
  documentVersionId = null,
  fillRequestId = null,
  signatureRequestId = null,
  phase,
  kind = "observation",
  message,
  authorPersonId,
  targetPersonId = null
}) => {
  const normalizedMessage = String(message || "").trim();
  if (!authorPersonId || !normalizedMessage) {
    return null;
  }
  if (!VALID_PHASES.has(phase)) {
    throw new Error("Fase de observación inválida.");
  }
  const normalizedKind = VALID_KINDS.has(kind) ? kind : "observation";

  // Se puede invocar con taskItemId (revisión) o con documentVersionId (firma): se completa el faltante.
  let resolvedTaskItemId = taskItemId ? Number(taskItemId) : null;
  if (!resolvedTaskItemId && documentVersionId) {
    const [rows] = await connection.query(
      `SELECT d.task_item_id
       FROM document_versions dv
       INNER JOIN documents d ON d.id = dv.document_id
       WHERE dv.id = ?
       LIMIT 1`,
      [Number(documentVersionId)]
    );
    resolvedTaskItemId = rows?.[0]?.task_item_id ? Number(rows[0].task_item_id) : null;
  }
  if (!resolvedTaskItemId) {
    return null;
  }
  const versionId = documentVersionId || await getCurrentDocumentVersionId(connection, resolvedTaskItemId);
  if (!versionId) {
    // Sin versión documental no hay dónde anclar la observación (FK NOT NULL); se omite en silencio
    // para no romper el flujo principal (p. ej. una devolución antes de materializar el documento).
    return null;
  }
  const [result] = await connection.query(
    `INSERT INTO document_workflow_observations
       (task_item_id, document_version_id, fill_request_id, signature_request_id,
        phase, kind, message, author_person_id, target_person_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      resolvedTaskItemId,
      versionId,
      fillRequestId ? Number(fillRequestId) : null,
      signatureRequestId ? Number(signatureRequestId) : null,
      phase,
      normalizedKind,
      normalizedMessage,
      Number(authorPersonId),
      targetPersonId ? Number(targetPersonId) : null
    ]
  );
  return Number(result.insertId);
};

// ¿El usuario está en la cadena de revisión/firma del entregable (tiene/tuvo una solicitud asignada)?
// ⚠️ `isUserInTaskItemChain` VIVIÓ AQUÍ Y SE RETIRÓ el 2026-08-22.
//
// Era la segunda de tres implementaciones del conjunto de participantes —miraba sólo entrega y
// firma, un subconjunto estricto de lo que ya filtraba `getAccessibleTaskItemForUser`—. Sus dos
// llamadores la usaban como `isOwner || inChain` para decidir si alguien podía comentar.
//
// Hoy la pregunta la contesta `services/documents/DeliverableAccessService.js`, que es el único
// sitio donde se declara quién participa en un entregable y por qué.

// Hilo de observaciones de un entregable (con nombres de autor/destino/resolutor).
export const listDocumentObservations = async (taskItemId, connection = null) => {
  const conn = connection || getPostgresPool();
  const [rows] = await conn.query(
    `SELECT
       o.id,
       o.task_item_id,
       o.document_version_id,
       o.fill_request_id,
       o.signature_request_id,
       o.phase,
       o.kind,
       o.message,
       o.author_person_id,
       CONCAT_WS(' ', author.first_name, author.last_name) AS author_name,
       o.target_person_id,
       CONCAT_WS(' ', target.first_name, target.last_name) AS target_name,
       o.resolved_by_person_id,
       CONCAT_WS(' ', resolver.first_name, resolver.last_name) AS resolved_by_name,
       o.resolved_at,
       o.created_at
     FROM document_workflow_observations o
     LEFT JOIN persons author ON author.id = o.author_person_id
     LEFT JOIN persons target ON target.id = o.target_person_id
     LEFT JOIN persons resolver ON resolver.id = o.resolved_by_person_id
     WHERE o.task_item_id = ?
     ORDER BY o.created_at ASC, o.id ASC`,
    [Number(taskItemId)]
  );
  return rows;
};

export const getObservationById = async (observationId, connection = null) => {
  const conn = connection || getPostgresPool();
  const [rows] = await conn.query(
    "SELECT id, task_item_id, author_person_id, resolved_at FROM document_workflow_observations WHERE id = ? LIMIT 1",
    [Number(observationId)]
  );
  return rows?.[0] || null;
};

// Marca una observación como resuelta (idempotente: no re-resuelve).
export const resolveDocumentObservation = async (observationId, resolvedByPersonId, connection = null) => {
  const conn = connection || getPostgresPool();
  await conn.query(
    `UPDATE document_workflow_observations
     SET resolved_by_person_id = ?, resolved_at = CURRENT_TIMESTAMP
     WHERE id = ? AND resolved_at IS NULL`,
    [Number(resolvedByPersonId), Number(observationId)]
  );
};
