import { Router } from "express";
import { createProgram } from "../controllers/empresa/program_controler.js";

import { createFacultad } from "../controllers/admin/facultad_controler.js";


import { createPerfil } from "../controllers/admin/perfil_controler.js";
import { createProceso } from "../controllers/admin/proceso_controler.js";
import {
  generateTasksForTermController,
  launchProcessDefinitionController,
  getTermLaunchStatusController,
  getDefinitionLaunchInfoController
} from "../controllers/admin/task_generation_controller.js";
import sqlAdminRouter from "./sql_admin_router.js";
import { authMiddleware } from "../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../middlewares/rbac.js";

const router = new Router();

router.use(authMiddleware, loadAccessContext);

router.post("/program", requirePermissions("units.create"), createProgram)

router.post("/faculty", requirePermissions("units.create"), createFacultad)

router.post("/perfil", requirePermissions("people.create"), createPerfil)
router.post("/process", requirePermissions("process_definitions.create"), createProceso)
router.post("/terms/:termId/generate-tasks", requirePermissions("process_execution.create"), generateTasksForTermController)
router.get("/terms/:termId/launch-status", requirePermissions("process_execution.read"), getTermLaunchStatusController)
router.get("/process-definitions/:definitionId/launch-info", requirePermissions("process_execution.read"), getDefinitionLaunchInfoController)
router.post("/process-definitions/:definitionId/launch", requirePermissions("process_execution.create"), launchProcessDefinitionController)

router.use("/sql", sqlAdminRouter);

export default router;
