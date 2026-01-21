import { getMariaDBPool } from "../../config/mariadb.js";
import SqlAdminService from "../../services/admin/SqlAdminService.js";

const service = new SqlAdminService();

export const createProgram = async (req, res) => {
  console.log("Creando Nueva Unidad (compat /program)");
  try {
    const payload = { ...(req.body ?? {}) };
    if (!payload.slug && payload.code) {
      payload.slug = payload.code;
    }
    const created = await service.create("units", payload);
    res.json(created);
  } catch (error) {
    console.log("Error Creating Unit")
    console.error(error.message);
    res.status(400).send({
      message: "Error al crear la unidad",
      error: error.message
    });
  }
};

export const getPrograms = async (req, res) => {
  console.log("Listando unidades (compat /program)");
  try {
    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }

    const conditions = [];
    const params = [];

    if (req.query.unit_type_id) {
      conditions.push("u.unit_type_id = ?");
      params.push(Number(req.query.unit_type_id));
    }
    if (req.query.unit_type) {
      conditions.push("ut.name = ?");
      params.push(String(req.query.unit_type));
    }
    if (req.query.is_active !== undefined) {
      conditions.push("u.is_active = ?");
      params.push(Number(req.query.is_active) === 1 ? 1 : 0);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `SELECT u.*, ut.name AS unit_type_name
       FROM units u
       LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
       ${whereClause}
       ORDER BY u.name ASC`,
      params
    );
    res.json(rows || []);
  } catch (error) {
    console.log("Error Listando Unidades")
    res.status(500).json({ message: error.message });
  }
};
