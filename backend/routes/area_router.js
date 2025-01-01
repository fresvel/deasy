import { Router } from "express";
import { createArea, getAreas} from "../controllers/empresa/area_controler.js";

const router = new Router();

router.post("/", createArea)
router.get("/", getAreas)

export default router
