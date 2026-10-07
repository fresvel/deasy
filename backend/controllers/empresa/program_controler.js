import { getPostgresPool } from "../../config/postgres.js";
import { listUnits } from "../../services/admin/org/unitListing.js";
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
    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const rows = await listUnits(pool, {
      unitTypeId: req.query.unit_type_id,
      unitType: req.query.unit_type,
      isActive: req.query.is_active,
    });
    res.json(rows);
  } catch (error) {
    console.log("Error Listando Unidades")
    res.status(500).json({ message: error.message });
  }
};
