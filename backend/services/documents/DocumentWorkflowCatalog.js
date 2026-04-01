export const SIGNATURE_REQUEST_STATUS = Object.freeze({
  PENDING: "pendiente",
  IN_PROGRESS: "en_progreso",
  COMPLETED: "completado",
  REJECTED: "rechazado",
  CANCELLED: "cancelado",
});

export const SIGNATURE_STATUS = Object.freeze({
  SIGNED: "firmado",
  FAILED: "fallido",
  INVALID: "invalido",
  CANCELLED: "cancelado",
});

export const FILL_REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  APPROVED: "approved",
  REJECTED: "rejected",
  RETURNED: "returned",
  CANCELLED: "cancelled",
});

const normalizeCode = (value) => String(value || "").trim().toLowerCase();

export const getCatalogIdByCode = async (connection, tableName, code) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM ${tableName}
     WHERE LOWER(code) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [normalizeCode(code)]
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};

export const getSignatureRequestStatusIdByCode = (connection, code) =>
  getCatalogIdByCode(connection, "signature_request_statuses", code);

export const getSignatureStatusIdByCode = (connection, code) =>
  getCatalogIdByCode(connection, "signature_statuses", code);

export const getDefaultSignatureTypeId = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_types
     WHERE LOWER(code) IN ('electronic', 'digital')
     ORDER BY CASE LOWER(code) WHEN 'electronic' THEN 0 ELSE 1 END, id ASC
     LIMIT 1`
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};
