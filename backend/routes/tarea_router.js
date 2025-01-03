import { Router } from "express";
import { createTarea, createLoteTareas, getuserTarea } from "../controllers/tareas/tareas_controler.js";

const router = new Router();


router.post('/', createTarea);

router.post('/lote', createLoteTareas);

router.get('/', getuserTarea);



export default router
