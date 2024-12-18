import multer from "multer";
import { Router } from "express";
import { informe_parcial } from "../controllers/tutorias/informeparcial_ctl.js";


const router = new Router();

const upload =multer({dest:"uploads", filename:"hello"})

router.post("/parcial", upload.single("file"), informe_parcial)

export default router;