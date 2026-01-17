import { Router } from "express";
import { createProgram } from "../controllers/empresa/program_controler.js";

import { createFacultad } from "../controllers/admin/facultad_controler.js";


import { createPerfil } from "../controllers/admin/perfil_controler.js";
import { createProceso } from "../controllers/admin/proceso_controler.js";
import { generateTasksForTermController } from "../controllers/admin/task_generation_controller.js";
import sqlAdminRouter from "./sql_admin_router.js";

const router = new Router();

router.post("/program", createProgram)

router.post("/faculty", createFacultad)

router.post("/perfil", createPerfil)
router.post("/process", createProceso)
router.post("/terms/:termId/generate-tasks", generateTasksForTermController)

router.use("/sql", sqlAdminRouter);

export default router;
