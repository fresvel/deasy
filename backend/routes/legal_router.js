import { Router } from "express";

import { documentosVigentes } from "../controllers/legal/legal_controller.js";

const router = new Router();

// ⚠️ SIN AUTENTICACION, y es correcto: hay que poder leer lo que se acepta ANTES de tener cuenta.
// No expone datos de nadie -- son los textos que el sistema ofrece a todo el mundo.
router.get("/documentos", documentosVigentes);

export default router;
