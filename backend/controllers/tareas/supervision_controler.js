import SqlAdminService from "../../services/admin/SqlAdminService.js";

const service = new SqlAdminService();

// F-C (scope por jefe): entregables atascados (sin responsable o con titular que se fue) en las unidades que el
// usuario actual encabeza + descendientes. Accesible a cualquier persona autenticada (un jefe puede ser Usuario).
export const getMySupervisedStuckTasks = async (req, res) => {
  try {
    const result = await service.listSupervisorStuckTaskItems(req.user?.uid ?? null);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
