import { Router } from "express";
import { validateToken } from "../middlewares/val_token.js";
import { listVisibleVacancies } from "../controllers/empresa/vacancy_controler.js";

const router = new Router();

router.get("/", validateToken, listVisibleVacancies);

export default router;
