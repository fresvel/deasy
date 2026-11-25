import { Router } from "express";
import { getuserTarea } from "../controllers/tareas/tareas_controler.js";
import {
  getMySupervisedStuckTasks,
  supervisorHandoverTaskItem,
  supervisorResetTaskItemWorkflow,
} from "../controllers/tareas/supervision_controler.js";
import { authMiddleware } from "../middlewares/auth.js";

const router = new Router();


router.get('/', getuserTarea);

// Scope por jefe: entregables atascados en las unidades que el usuario encabeza + descendientes.
router.get('/supervised-stuck', authMiddleware, getMySupervisedStuckTasks);

// Las dos acciones del jefe sobre un entregable atascado de su unidad. Sin permiso de admin a
// proposito: la legitimidad la da el ALCANCE (encabezar la unidad), no el rol, y la comprueba
// `assertSupervisesTaskItem` antes que nada.
router.post('/supervised-stuck/:taskItemId/handover', authMiddleware, supervisorHandoverTaskItem);
router.post('/supervised-stuck/:taskItemId/reset', authMiddleware, supervisorResetTaskItemWorkflow);


export default router
