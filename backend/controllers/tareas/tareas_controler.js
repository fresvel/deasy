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
              ta.id AS assignment_id,
              ta.status AS assignment_status,
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
       FROM task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
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
       INNER JOIN unit_positions up ON up.id = ta.position_id
       INNER JOIN units u ON u.id = up.unit_id
       LEFT JOIN position_assignments pa
         ON pa.position_id = ta.position_id AND pa.is_current = 1
       WHERE (ta.assigned_person_id = ? OR (ta.assigned_person_id IS NULL AND pa.person_id = ?))
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



