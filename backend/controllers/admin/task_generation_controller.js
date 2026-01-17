import { generateTasksForTerm } from "../../services/admin/TaskGenerationService.js";

export const generateTasksForTermController = async (req, res) => {
  try {
    const termId = Number(req.params.termId);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ message: "termId invalido." });
    }
    const result = await generateTasksForTerm(termId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Error al generar tareas para el periodo.",
      error: error.message
    });
  }
};
