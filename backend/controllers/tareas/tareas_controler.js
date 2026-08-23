import { getPostgresPool } from "../../config/postgres.js";

export const getuserTarea = async (req, res) => {
  console.log("Buscando Tareas por parámetros (SQL)");
  try {
    const cedula = req.query?.usuario || req.body?.usuario;
    if (!cedula) {
      return res.status(400).json({ message: "Se requiere la cedula del usuario." });
    }
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }
    const [persons] = await pool.query("SELECT id FROM persons WHERE cedula = ? LIMIT 1", [cedula]);
    const personId = persons?.[0]?.id;
    if (!personId) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const filters = [];
    const params = [personId, personId];
    if (req.query?.process_id) {
      filters.push("p.id = ?");
      params.push(Number(req.query.process_id));
    }
    if (req.query?.process_slug) {
      filters.push("p.slug = ?");
      params.push(String(req.query.process_slug));
    }
    if (req.query?.term_id) {
      filters.push("t.term_id = ?");
      params.push(Number(req.query.term_id));
    }
    if (req.query?.status) {
      filters.push("ta.status = ?");
      params.push(String(req.query.status));
    }

    const whereExtra = filters.length ? ` AND ${filters.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT t.id AS task_id,
              t.status AS task_status,
              t.start_date,
              t.end_date,
              t.term_id,
              -- assignment_id/assignment_status salian de task_assignments, retirada el
              -- 2026-08-23. El id pasa a ser el de la TENENCIA, que es lo que de verdad relaciona a
              -- esta persona con esta tarea; el estado NO tiene sucesor y desaparece: era una
              -- columna sin escritores, se quedaba en 'pendiente' para siempre.
              te.id AS assignment_id,
              pdv.id AS process_definition_id,
              pdv.variation_key,
              pdv.definition_version,
              pdv.name AS process_definition_name,
              tis.task_item_count,
              tis.task_item_names,
              p.id AS process_id,
              p.name AS process_name,
              p.slug AS process_slug,
              u.id AS unit_id,
              u.name AS unit_name
       FROM task_item_tenures te
       INNER JOIN task_items ti_te ON ti_te.id = te.task_item_id
       INNER JOIN tasks t ON t.id = ti_te.task_id
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       LEFT JOIN (
         SELECT
           ti.task_id,
           COUNT(*) AS task_item_count,
           GROUP_CONCAT(DISTINCT tar_dl.display_name ORDER BY ti.sort_order SEPARATOR ' | ') AS task_item_names
         FROM task_items ti
         LEFT JOIN template_artifacts tar
           ON tar.id = ti.template_artifact_id
           LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
         GROUP BY ti.task_id
       ) tis
         ON tis.task_id = t.id
       INNER JOIN processes p ON p.id = pdv.process_id
       INNER JOIN unit_positions up ON up.id = ti_te.responsible_position_id
       INNER JOIN units u ON u.id = up.unit_id
       LEFT JOIN position_assignments pa
         ON pa.position_id = ti_te.responsible_position_id AND pa.is_current = 1
       -- El segundo termino cubre lo ABANDONADO: tenencia abierta sin persona, y quien ocupa hoy el
       -- puesto responsable la ve. te.ended_at IS NULL es nuevo y hace falta: sin el, una tenencia
       -- CERRADA sin persona (las hay: son el rastro de cada abandono) le daria la tarea al ocupante
       -- actual por cada abandono historico.
       WHERE (te.person_id = ? OR (te.person_id IS NULL AND te.ended_at IS NULL AND pa.person_id = ?))
       ${whereExtra}
       ORDER BY t.start_date DESC`,
      params
    );
    res.json(rows || []);
  } catch (error) {
    console.log("Error Buscando Tareas por Usuario");
    console.error(error.message);
    res.status(500).json({ message: error.message });
  }
};



