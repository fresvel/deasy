export const DOCUMENT_STATUSES = Object.freeze([
  "Inicial",
  "Pendiente de llenado",
  "En proceso",
  "Observado",
  "Listo para firma",
  "Pendiente de firma",
  "Firmado parcial",
  "Firmado completo",
  "Final",
  "Archivado",
  "Cancelado",
]);

export const DOCUMENT_VERSION_STATUSES = Object.freeze([
  "Borrador",
  "Pendiente de llenado",
  "En llenado",
  "En revisión de llenado",
  "Observado",
  "Listo para firma",
  "Pendiente de firma",
  "Firmado parcial",
  "Firmado completo",
  "Final",
  "Archivado",
  "Cancelado",
]);

const DOCUMENT_STATUS_TRANSITIONS = Object.freeze({
  Inicial: ["Pendiente de llenado", "Listo para firma", "Cancelado", "Archivado"],
  "Pendiente de llenado": ["En proceso", "Observado", "Listo para firma", "Cancelado", "Archivado"],
  "En proceso": ["Pendiente de llenado", "Observado", "Listo para firma", "Cancelado", "Archivado"],
  Observado: ["En proceso", "Pendiente de llenado", "Cancelado", "Archivado"],
  "Listo para firma": ["Pendiente de firma", "Cancelado", "Archivado"],
  "Pendiente de firma": ["Firmado parcial", "Firmado completo", "Cancelado", "Archivado"],
  "Firmado parcial": ["Pendiente de firma", "Firmado completo", "Cancelado", "Archivado"],
  "Firmado completo": ["Final", "Archivado"],
  Final: ["Archivado"],
  Archivado: [],
  Cancelado: [],
});

const DOCUMENT_VERSION_STATUS_TRANSITIONS = Object.freeze({
  Borrador: ["Pendiente de llenado", "Listo para firma", "Cancelado", "Archivado"],
  "Pendiente de llenado": ["En llenado", "En revisión de llenado", "Observado", "Listo para firma", "Cancelado", "Archivado"],
  "En llenado": ["En revisión de llenado", "Observado", "Listo para firma", "Cancelado", "Archivado"],
  "En revisión de llenado": ["Pendiente de llenado", "En llenado", "Observado", "Listo para firma", "Cancelado", "Archivado"],
  Observado: ["En llenado", "Pendiente de llenado", "Cancelado", "Archivado"],
  "Listo para firma": ["Pendiente de firma", "Cancelado", "Archivado"],
  "Pendiente de firma": ["Firmado parcial", "Firmado completo", "Cancelado", "Archivado"],
  "Firmado parcial": ["Pendiente de firma", "Firmado completo", "Cancelado", "Archivado"],
  "Firmado completo": ["Final", "Archivado"],
  Final: ["Archivado"],
  Archivado: [],
  Cancelado: [],
});

export const normalizeDocumentStatus = (status) => {
  const value = String(status || "").trim();
  if (!value) return "Inicial";
  const normalizedLegacy = value.toLowerCase();
  if (normalizedLegacy === "rechazado") return "Observado";
  if (normalizedLegacy === "aprobado") return "Final";
  if (DOCUMENT_STATUSES.includes(value)) return value;
  return "Inicial";
};

export const normalizeDocumentVersionStatus = (status) => {
  const value = String(status || "").trim();
  if (!value) return "Borrador";
  const normalizedLegacy = value.toLowerCase();
  if (normalizedLegacy === "rechazado") return "Observado";
  if (normalizedLegacy === "aprobado") return "Final";
  if (DOCUMENT_VERSION_STATUSES.includes(value)) return value;
  return "Borrador";
};

export const assertDocumentStatusValue = (status) => {
  const normalized = normalizeDocumentStatus(status);
  if (!DOCUMENT_STATUSES.includes(normalized)) {
    throw new Error(`Estado de documento inválido: ${status}`);
  }
  return normalized;
};

export const assertDocumentVersionStatusValue = (status) => {
  const normalized = normalizeDocumentVersionStatus(status);
  if (!DOCUMENT_VERSION_STATUSES.includes(normalized)) {
    throw new Error(`Estado de versión documental inválido: ${status}`);
  }
  return normalized;
};

export const canTransitionDocumentStatus = (fromStatus, toStatus) => {
  const from = normalizeDocumentStatus(fromStatus);
  const to = assertDocumentStatusValue(toStatus);
  if (from === to) return true;
  return (DOCUMENT_STATUS_TRANSITIONS[from] || []).includes(to);
};

export const canTransitionDocumentVersionStatus = (fromStatus, toStatus) => {
  const from = normalizeDocumentVersionStatus(fromStatus);
  const to = assertDocumentVersionStatusValue(toStatus);
  if (from === to) return true;
  return (DOCUMENT_VERSION_STATUS_TRANSITIONS[from] || []).includes(to);
};

export const deriveDocumentStatusFromVersionStatus = (versionStatus) => {
  const normalized = normalizeDocumentVersionStatus(versionStatus);
  switch (normalized) {
    case "Borrador":
      return "Inicial";
    case "Pendiente de llenado":
      return "Pendiente de llenado";
    case "En llenado":
    case "En revisión de llenado":
      return "En proceso";
    case "Observado":
      return "Observado";
    case "Listo para firma":
      return "Listo para firma";
    case "Pendiente de firma":
      return "Pendiente de firma";
    case "Firmado parcial":
      return "Firmado parcial";
    case "Firmado completo":
      return "Firmado completo";
    case "Final":
      return "Final";
    case "Archivado":
      return "Archivado";
    case "Cancelado":
      return "Cancelado";
    default:
      return "Inicial";
  }
};

export const transitionDocumentVersionState = async (connection, documentVersionId, nextStatus) => {
  const targetStatus = assertDocumentVersionStatusValue(nextStatus);
  const [rows] = await connection.query(
    `SELECT id, document_id, status
     FROM document_versions
     WHERE id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  const current = rows?.[0];
  if (!current) {
    throw new Error(`No existe la document_version ${documentVersionId}.`);
  }
  const currentStatus = normalizeDocumentVersionStatus(current.status);
  if (!canTransitionDocumentVersionStatus(currentStatus, targetStatus)) {
    throw new Error(`Transición inválida de versión documental: ${currentStatus} -> ${targetStatus}`);
  }

  await connection.query(
    `UPDATE document_versions
     SET status = ?
     WHERE id = ?`,
    [targetStatus, documentVersionId]
  );

  const documentStatus = deriveDocumentStatusFromVersionStatus(targetStatus);
  await transitionDocumentState(connection, Number(current.document_id), documentStatus, { allowDirect: true });

  return {
    documentVersionId: Number(documentVersionId),
    previousStatus: currentStatus,
    nextStatus: targetStatus,
    documentId: Number(current.document_id),
    documentStatus,
  };
};

export const transitionDocumentState = async (
  connection,
  documentId,
  nextStatus,
  { allowDirect = false } = {},
) => {
  const targetStatus = assertDocumentStatusValue(nextStatus);
  const [rows] = await connection.query(
    `SELECT id, status
     FROM documents
     WHERE id = ?
     LIMIT 1`,
    [documentId]
  );
  const current = rows?.[0];
  if (!current) {
    throw new Error(`No existe el documento ${documentId}.`);
  }
  const currentStatus = normalizeDocumentStatus(current.status);
  if (!allowDirect && !canTransitionDocumentStatus(currentStatus, targetStatus)) {
    throw new Error(`Transición inválida de documento: ${currentStatus} -> ${targetStatus}`);
  }

  await connection.query(
    `UPDATE documents
     SET status = ?
     WHERE id = ?`,
    [targetStatus, documentId]
  );

  return {
    documentId: Number(documentId),
    previousStatus: currentStatus,
    nextStatus: targetStatus,
  };
};
