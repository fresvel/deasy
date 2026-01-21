import { getMariaDBPool } from "../../config/mariadb.js";
import SqlAdminService from "../../services/admin/SqlAdminService.js";

const sqlService = new SqlAdminService();


export const createTarea = async (req, res) => {
  console.log("Creando Nueva Tarea (SQL)");
  try {
    const created = await sqlService.create("tasks", req.body ?? {});
    res.json({ result: created });
  } catch (error) {
    console.log("Error Creating Tarea");
    console.error(error.message);
    res.status(400).send({
      message: "Error al crear la tarea",
      error: error.message
    });
  }
};

export const createLoteTareas = async (req, res) => {
  console.log("Creando Lote de Tareas (SQL)");
  try {
    const tareas = Array.isArray(req.body?.tareas) ? req.body.tareas : [];
    if (!tareas.length) {
      return res.status(400).json({ message: "No se recibieron tareas para insertar." });
    }
    const createdIds = [];
    for (const tarea of tareas) {
      const created = await sqlService.create("tasks", tarea);
      createdIds.push(created?.id);
    }
    res.json({ result: "ok", created_ids: createdIds });
  } catch (error) {
    console.log("Error Creating Lote de Tareas");
    console.error(error.message);
    res.status(400).json({ message: error.message });
  }
};


export const getuserTarea = async (req, res) => {
  console.log("Buscando Tareas por parámetros (SQL)");
  try {
    const cedula = req.query?.usuario || req.body?.usuario;
    if (!cedula) {
      return res.status(400).json({ message: "Se requiere la cedula del usuario." });
    }
    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
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
              pv.id AS process_version_id,
              pv.version AS process_version,
              pv.name AS process_version_name,
              p.id AS process_id,
              p.name AS process_name,
              p.slug AS process_slug,
              u.id AS unit_id,
              u.name AS unit_name
       FROM task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
       INNER JOIN process_versions pv ON pv.id = t.process_version_id
       INNER JOIN processes p ON p.id = pv.process_id
       LEFT JOIN units u ON u.id = p.unit_id
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

export const getTareas = async (req, res) => {
  console.log("Buscando Todas las Tareas (SQL)");
  try {
    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }
    const [rows] = await pool.query("SELECT * FROM tasks ORDER BY created_at DESC");
    res.json(rows || []);
  } catch (error) {
    res.status(400).json({ message: "Error al buscar tareas", error: error.message });
  }
};


export const getTareaspendientes = async (req, res) => {
  console.log("Buscando Tareas Pendientes (SQL)");
  try {
    const cedula = req.query?.usuario;
    if (!cedula) {
      return res.status(400).json({ message: "Se requiere la cedula del usuario." });
    }
    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }
    const [persons] = await pool.query("SELECT id FROM persons WHERE cedula = ? LIMIT 1", [cedula]);
    const personId = persons?.[0]?.id;
    if (!personId) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const [rows] = await pool.query(
      `SELECT t.id AS task_id,
              t.status AS task_status,
              t.start_date,
              t.end_date,
              t.term_id,
              ta.id AS assignment_id,
              ta.status AS assignment_status,
              pv.id AS process_version_id,
              pv.version AS process_version,
              pv.name AS process_version_name,
              p.id AS process_id,
              p.name AS process_name,
              p.slug AS process_slug,
              u.id AS unit_id,
              u.name AS unit_name
       FROM task_assignments ta
       INNER JOIN tasks t ON t.id = ta.task_id
       INNER JOIN process_versions pv ON pv.id = t.process_version_id
       INNER JOIN processes p ON p.id = pv.process_id
       LEFT JOIN units u ON u.id = p.unit_id
       LEFT JOIN position_assignments pa
         ON pa.position_id = ta.position_id AND pa.is_current = 1
       WHERE (ta.assigned_person_id = ? OR (ta.assigned_person_id IS NULL AND pa.person_id = ?))
         AND ta.status = 'pendiente'
       ORDER BY t.start_date DESC`,
      [personId, personId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Ninguna tarea pendiente encontrada" });
    }
    res.json(rows);
  } catch (error) {
    console.log("Error Buscando Tareas Pendientes");
    console.error(error.message);
    res.status(500).json({ message: error.message });
  }
};
