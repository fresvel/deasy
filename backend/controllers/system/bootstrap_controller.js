import SystemBootstrapService from "../../services/system/SystemBootstrapService.js";

const bootstrapService = new SystemBootstrapService();

export const getBootstrapStatus = async (_req, res) => {
  try {
    const status = await bootstrapService.getBootstrapStatus();
    return res.json({
      ok: true,
      ...status
    });
  } catch (error) {
    console.error("Error consultando estado de bootstrap:", error);
    return res.status(Number(error?.statusCode || 500)).json({
      ok: false,
      message: error?.message || "No se pudo consultar el estado del sistema."
    });
  }
};

export const initializeBootstrap = async (req, res) => {
  try {
    const result = await bootstrapService.initializeSystem(req.body || {});
    const status = await bootstrapService.getBootstrapStatus();
    return res.status(201).json({
      ok: true,
      message: result.message,
      admin: result.admin,
      gestor: result.gestor,
      usuario: result.usuario,
      preconfig: result.preconfig,
      ...status
    });
  } catch (error) {
    console.error("Error inicializando bootstrap del sistema:", error);
    return res.status(Number(error?.statusCode || 500)).json({
      ok: false,
      message: error?.message || "No se pudo inicializar el sistema."
    });
  }
};
