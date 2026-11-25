import {
  generateTasksForTerm,
  launchProcessDefinitionInTerm,
  getTermLaunchStatus,
  getDefinitionLaunchInfo
} from "../../services/admin/TaskGenerationService.js";

export const generateTasksForTermController = async (req, res) => {
  try {
    const termId = Number(req.params.termId);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ message: "termId invalido." });
    }
    const result = await generateTasksForTerm(termId);
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: "Error al generar tareas para el periodo.",
      error: error.message
    });
  }
};

// Lanzamiento explícito de una configuración en un periodo (primero o relanzamiento).
export const launchProcessDefinitionController = async (req, res) => {
  try {
    const definitionId = Number(req.params.definitionId);
    const termId = Number(req.body?.term_id ?? req.params.termId);
    if (!definitionId || Number.isNaN(definitionId)) {
      return res.status(400).json({ message: "definitionId invalido." });
    }
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ message: "Se requiere un periodo (term_id) valido." });
    }
    const relaunch = Boolean(req.body?.relaunch);
    const reason = req.body?.reason ? String(req.body.reason) : null;
    const createdByUserId = req.user?.uid ? Number(req.user.uid) : null;

    const result = await launchProcessDefinitionInTerm(definitionId, termId, {
      createdByUserId,
      relaunch,
      reason
    });
    return res.json(result);
  } catch (error) {
    // Este catch tenia un 400 HARDCODEADO: era el unico de los cuatro endpoints de
    // lanzamiento que no devolvia 500 ante "no encontrado" — devolvia 400. Ni uno ni otro:
    // ahora respeta el codigo del error de negocio (404 si la configuracion no existe).
    return res.status(error.statusCode ?? 400).json({
      message: "Error al lanzar la configuracion en el periodo.",
      error: error.message
    });
  }
};

// Info de lanzamiento de una configuración (periodos disponibles + historial de corridas).
export const getDefinitionLaunchInfoController = async (req, res) => {
  try {
    const definitionId = Number(req.params.definitionId);
    if (!definitionId || Number.isNaN(definitionId)) {
      return res.status(400).json({ message: "definitionId invalido." });
    }
    const result = await getDefinitionLaunchInfo(definitionId);
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: "Error al obtener la informacion de lanzamiento de la configuracion.",
      error: error.message
    });
  }
};

// Estado de lanzamiento de un periodo (qué procesos están lanzados/relanzados/pendientes).
export const getTermLaunchStatusController = async (req, res) => {
  try {
    const termId = Number(req.params.termId);
    if (!termId || Number.isNaN(termId)) {
      return res.status(400).json({ message: "termId invalido." });
    }
    const result = await getTermLaunchStatus(termId);
    return res.json(result);
  } catch (error) {
    return res.status(error.statusCode ?? 500).json({
      message: "Error al obtener el estado de lanzamiento del periodo.",
      error: error.message
    });
  }
};
