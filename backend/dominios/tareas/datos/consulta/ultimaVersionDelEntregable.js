// LA ÚLTIMA VERSIÓN DOCUMENTAL de un entregable, con su tarea y su periodo.
//
// ⚠️ `datos/consulta/` porque CRUZA: `process_definition_versions` y `terms` son de **procesos**. De
// `tareas` nombra `task_items`, `tasks` y `document_versions`.
//
// ⚠️ ESTA CONSULTA VINO DEL PILOTO DE F7, que se escribió el 2026-10-06 — **antes de que existiera la
// comprobación E**. Al integrar el piloto, la E la marcó: estaba en `datos/` y cruzaba. No es que el
// piloto estuviera mal; es que la regla que lo ordena llegó después, y eso es justo lo que una puerta
// sirve para encontrar.
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
       dv.edicion_id,
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
