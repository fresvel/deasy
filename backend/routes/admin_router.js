import { Router } from "express";
import { createProgram } from "../controllers/empresa/program_controler.js";

import { createFacultad } from "../controllers/admin/facultad_controler.js";


import { createPerfil } from "../controllers/admin/perfil_controler.js";
import { createProceso } from "../controllers/admin/proceso_controler.js";

const router = new Router();

router.post("/program", createProgram)

router.post("/faculty", createFacultad)

router.post("/perfil", createPerfil)
router.post("/process", createProceso)

export default router;
