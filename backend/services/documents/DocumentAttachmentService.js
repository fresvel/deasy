// LOS ANEXOS de una versión documental: listar, añadir, encontrar y borrar.
//
// Único dueño de la escritura de `document_attachments` (dominio `tareas`). Antes del 2026-10-07 esa
// tabla la escribía `controllers/users/user_controler.js` —un controller— y era el único escritor,
// así que mover sus consultas aquí no cambia la propiedad: la pone donde se puede comprobar.
//
// Aquí NO hay HTTP ni reglas de autorización: quién puede ver un anexo lo decide
// `getAccessibleTaskItemDocumentForUser` antes de llamar, y el 403/404/409 lo traduce el controller.
// Lo que sí vive aquí es el ORDEN del anexo, que es una regla de la tabla: el siguiente es el máximo
// más uno, y se calcula con la misma conexión que inserta.

export const listAttachmentsOfDocumentVersion = async (conexion, documentVersionId) => {
  const [rows] = await conexion.query(
    `SELECT * FROM document_attachments
     WHERE document_version_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [Number(documentVersionId)]
  );
  return rows || [];
};

export const nextAttachmentOrder = async (conexion, documentVersionId) => {
  const [rows] = await conexion.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
     FROM document_attachments WHERE document_version_id = ?`,
    [Number(documentVersionId)]
  );
  return Number(rows?.[0]?.next_order || 1);
};

export const insertAttachment = async (conexion, fila) => {
  const [insertResult] = await conexion.query(
    `INSERT INTO document_attachments
      (document_version_id, kind, file_path, file_name, mime_type, size_bytes, description, uploaded_by_person_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(fila.documentVersionId),
      fila.kind,
      fila.filePath,
      fila.fileName,
      fila.mimeType,
      fila.sizeBytes,
      fila.description,
      fila.uploadedByPersonId,
      fila.sortOrder,
    ]
  );
  return Number(insertResult.insertId);
};

// ⚠️ UNA SOLA CONSULTA DONDE HABÍA DOS. El controller la tenía repetida con dos proyecciones
// distintas —`id, file_path` para borrar y `file_path, file_name, mime_type` para descargar—, mismo
// FROM, mismo JOIN, mismo WHERE y mismo LIMIT. Queda una que proyecta las cuatro columnas; quien no
// usa alguna la ignora.
//
// El `INNER JOIN document_versions` es la comprobación que importa y no se puede quitar: el anexo
// debe pertenecer a una versión documental DE ESTE entregable, cualquiera de sus instancias.
export const findAttachmentOfTaskItem = async (conexion, attachmentId, taskItemId) => {
  const [rows] = await conexion.query(
    `SELECT da.id, da.file_path, da.file_name, da.mime_type
     FROM document_attachments da
     INNER JOIN document_versions dv ON dv.id = da.document_version_id
     WHERE da.id = ? AND dv.task_item_id = ?
     LIMIT 1`,
    [Number(attachmentId), Number(taskItemId)]
  );
  return rows?.[0] ?? null;
};

export const deleteAttachment = async (conexion, attachmentId) => {
  await conexion.query(`DELETE FROM document_attachments WHERE id = ?`, [Number(attachmentId)]);
};
