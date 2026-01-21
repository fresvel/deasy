import { Router } from "express";
import { getPrograms, createProgram } from "../controllers/empresa/program_controler.js";

const router = new Router();

router.get("/", getPrograms);
router.post("/", createProgram);

export default router;
