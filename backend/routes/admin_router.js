import { Router } from "express";
import { createProgram } from "../controllers/empresa/program_controler.js";



import { createProceso } from "../controllers/admin/proceso_controler.js";
import {
  generateTasksForTermController,
  launchProcessDefinitionController,
  getTermLaunchStatusController,
  getDefinitionLaunchInfoController
} from "../controllers/admin/task_generation_controller.js";
import { codigoDeVinculacion, estadoDeCanales } from "../controllers/canales/canales_controller.js";
import sqlAdminRouter from "./sql_admin_router.js";
import { authMiddleware } from "../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../middlewares/rbac.js";

const router = new Router();

router.use(authMiddleware, loadAccessContext);

router.post("/program", requirePermissions("units.create"), createProgram)


router.post("/process", requirePermissions("process_definitions.create"), createProceso)
router.post("/terms/:termId/generate-tasks", requirePermissions("process_execution.create"), generateTasksForTermController)
router.get("/terms/:termId/launch-status", requirePermissions("process_execution.read"), getTermLaunchStatusController)
router.get("/process-definitions/:definitionId/launch-info", requirePermissions("process_execution.read"), getDefinitionLaunchInfoController)
router.post("/process-definitions/:definitionId/launch", requirePermissions("process_execution.create"), launchProcessDefinitionController)

// ── LOS CANALES DE MENSAJERIA ──────────────────────────────────────────────────────────────────
//
// ⚠️ SON DOS PERMISOS DISTINTOS Y NO UNA GRADACION CUALQUIERA. `read` enseña si el canal esta vivo;
// `manage` enseña el CODIGO DE VINCULACION, y quien lo escanea decide QUE CUENTA DE WHATSAPP ES el
// canal de la institucion. Es una toma de control de la identidad del canal, no «ver un dato»: quien
// vigila no tiene por que poder vincular.
router.get("/canales", requirePermissions("channels.read"), estadoDeCanales)
router.get("/canales/whatsapp/qr", requirePermissions("channels.manage"), codigoDeVinculacion)

router.use("/sql", sqlAdminRouter);

export default router;
