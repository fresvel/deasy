import { Router } from "express";
import { createProgram } from "../controllers/empresa/program_controler.js";

import { createFacultad } from "../controllers/admin/facultad_controler.js";


import { createPerfil } from "../controllers/admin/perfil_controler.js";
import { createProceso } from "../controllers/admin/proceso_controler.js";
import { generateTasksForTermController } from "../controllers/admin/task_generation_controller.js";
import sqlAdminRouter from "./sql_admin_router.js";
import { authMiddleware } from "../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../middlewares/rbac.js";

const router = new Router();

router.use(authMiddleware, loadAccessContext);

router.post("/program", requirePermissions("processes.create"), createProgram)

router.post("/faculty", requirePermissions("processes.create"), createFacultad)

router.post("/perfil", requirePermissions("processes.create"), createPerfil)
router.post("/process", requirePermissions("processes.create"), createProceso)
router.post("/terms/:termId/generate-tasks", requirePermissions("processes.create"), generateTasksForTermController)

router.use("/sql", sqlAdminRouter);

export default router;
