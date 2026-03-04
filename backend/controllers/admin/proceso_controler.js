import SqlAdminService from "../../services/admin/SqlAdminService.js";

const service = new SqlAdminService();

export const createProceso = async (req, res) => {
  console.log("Creando Nuevo Proceso (SQL)");
  try {
    const created = await service.create("processes", req.body ?? {});
    res.json({ result: created });
  } catch (error) {
    console.log("Error Creating Proceso");
    console.error(error.message);
    res.status(400).send({
      message: "Error al crear el proceso",
      error: error.message
    });
  }
};
