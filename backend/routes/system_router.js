import { Router } from "express";
import { getBootstrapStatus, initializeBootstrap } from "../controllers/system/bootstrap_controller.js";

const router = Router();

router.get("/bootstrap/status", getBootstrapStatus);
router.post("/bootstrap/initialize", initializeBootstrap);

export default router;
