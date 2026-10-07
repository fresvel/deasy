// EXPERIMENTO F7 (2026-10-06) · El `datos/` de `tareas` para las versiones documentales.
// Movido tal cual desde `services/documents/DocumentWorkflowResetService.js`: mismas consultas,
// mismos nombres, misma forma de retorno. Aqui NO hay reglas: no se decide nada, solo se pregunta
// y se escribe. La conexion llega por parametro y nunca se pide un pool.

export const getLatestDocumentVersionForTaskItem = async (connection, definitionId, taskItemId, documentId = null) => {
  // El filtro por documento se retiro con la tabla (2026-08-23): era `AND d.id = ?` sobre una
  // relacion 1:1, o sea que no podia recortar nada. El parametro se acepta y se ignora.
  const params = [taskItemId, definitionId];
  const [rows] = await connection.query(
    `SELECT
       ti.id AS task_item_id,
       t.id AS task_id,
       t.term_id,
       pdv.process_id,
       trm.term_type_id,
       trm.start_date AS term_start_date,
       YEAR(trm.start_date) AS term_year,
       ti.id AS document_id,
       dv.id AS document_version_id,
       dv.version_label AS document_version,
       dv.status AS document_version_status,
       dv.template_artifact_id,
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
     INNER JOIN document_versions dv ON dv.task_item_id = ti.id
     INNER JOIN (
       SELECT task_item_id, MAX(version) AS max_version
       FROM document_versions
       GROUP BY task_item_id
     ) latest
       ON latest.task_item_id = dv.task_item_id
      AND latest.max_version = dv.version
     WHERE ti.id = ?
       AND t.process_definition_id = ?

     LIMIT 1`,
    params
  );
  return rows?.[0] || null;
};

export const getMaxDocumentVersionForTaskItem = async (connection, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT MAX(version) AS max_version
     FROM document_versions
     WHERE task_item_id = ?`,
    [taskItemId]
  );
  return Number(rows?.[0]?.max_version || 0);
};

export const insertDocumentVersion = async (connection, fila) => {
  const [insertResult] = await connection.query(
    `INSERT INTO document_versions (
       task_item_id,
       version,
       template_artifact_id,
       payload_hash,
       payload_object_path,
       working_file_path,
       final_file_path,
       format,
       render_engine,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fila.taskItemId,
      fila.version,
      fila.templateArtifactId,
      fila.payloadHash,
      fila.payloadObjectPath,
      fila.workingFilePath,
      fila.finalFilePath,
      fila.format,
      fila.renderEngine,
      fila.status,
    ]
  );
  return Number(insertResult.insertId);
};
