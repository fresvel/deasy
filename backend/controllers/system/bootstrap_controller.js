import SystemBootstrapService from "../../services/system/SystemBootstrapService.js";

// ⚠️ PEREZOSO: instanciar aqui, a nivel de modulo, revienta en cuanto este fichero entra en un ciclo
// —y entra, porque `routes/system_router.js` vive hoy en `dominios/organizacion/` con dos rutas de
// bootstrap dentro, y la puerta de ese dominio lo reexporta—. El sintoma fue
// «Cannot access 'SystemBootstrapService' before initialization» al cargar su propio test.
// Es la CUARTA vez que muerde el mismo patron el 2026-10-07.
let bootstrapService = null;
const servicio = () => (bootstrapService ??= new SystemBootstrapService());

export const getBootstrapStatus = async (_req, res) => {
  try {
    const status = await servicio().getBootstrapStatus();
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
    const result = await servicio().initializeSystem(req.body || {});
    const status = await servicio().getBootstrapStatus();
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
