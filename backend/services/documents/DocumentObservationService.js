import { conTransaccion, getPostgresPool } from "../../config/postgres.js";

const VALID_PHASES = new Set(["review", "signature"]);
const VALID_KINDS = new Set(["observation", "return_reason", "rejection_reason", "internal_note"]);

// Versión documental actual de un entregable (un documento principal por task_item).
export const getCurrentDocumentVersionId = async (connection, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT dv.id
     FROM document_versions dv
     WHERE dv.task_item_id = ?
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
  // UN turno, no dos. Eran `turnoId` y `turnoId`, y los dos llegaban del mismo
  // sitio desde el 3b: cual venia relleno lo decidia `phase`, que sigue siendo el parametro que lo
  // dice. Colapsados con su columna el 2026-10-09.
  turnoId = null,
  phase,
  kind = "observation",
  message,
  authorPersonId,
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
      `SELECT dv.task_item_id
       FROM document_versions dv
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
       (task_item_id, document_version_id, turno_id,
        phase, kind, message, author_person_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      resolvedTaskItemId,
      versionId,
      turnoId ? Number(turnoId) : null,
      phase,
      normalizedKind,
      normalizedMessage,
      Number(authorPersonId),
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
       o.turno_id,
       o.phase,
       o.kind,
       o.message,
       o.author_person_id,
       CONCAT_WS(' ', author.first_name, author.last_name) AS author_name,
       o.resolved_by_person_id,
       CONCAT_WS(' ', resolver.first_name, resolver.last_name) AS resolved_by_name,
       o.resolved_at,
       o.created_at
     FROM document_workflow_observations o
     LEFT JOIN persons author ON author.id = o.author_person_id
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

// REGISTRAR una observación, con su transacción. Antes la abría el controller.
//
// La abre aquí porque aquí está la regla: `addDocumentObservation` puede devolver vacío cuando el
// entregable no tiene versión documental, y entonces no hay nada que confirmar. Un controller no
// tiene por qué saber eso.
export const registrarObservacionDelEntregable = async ({ taskItemId, phase, kind, message, authorPersonId }) =>
  conTransaccion((conexion) =>
    addDocumentObservation(conexion, { taskItemId, phase, kind, message, authorPersonId })
  );
