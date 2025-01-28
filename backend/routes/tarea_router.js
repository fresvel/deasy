import { Router } from "express";
import { createTarea, createLoteTareas, getuserTarea, getTareaspendientes } from "../controllers/tareas/tareas_controler.js";

const router = new Router();


router.post('/', createTarea);

router.post('/lote', createLoteTareas);

router.get('/', getuserTarea);

router.get('/pendiente', getTareaspendientes);


export default router
