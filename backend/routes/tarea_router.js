import { Router } from "express";
import { getuserTarea } from "../controllers/tareas/tareas_controler.js";
import { getMySupervisedStuckTasks } from "../controllers/tareas/supervision_controler.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = new Router();


router.get('/', getuserTarea);

// Scope por jefe: entregables atascados en las unidades que el usuario encabeza + descendientes.
router.get('/supervised-stuck', authMiddleware, getMySupervisedStuckTasks);


export default router
