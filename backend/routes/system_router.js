import { Router } from "express";
import { getBootstrapStatus, initializeBootstrap } from "../controllers/system/bootstrap_controller.js";
import { listarPaises, listarProvincias, listarCiudades } from "../controllers/system/geografia_controller.js";

const router = Router();

router.get("/bootstrap/status", getBootstrapStatus);
router.post("/bootstrap/initialize", initializeBootstrap);

// El catalogo geografico, SIN autenticar: lo consume el formulario de registro, que por definicion
// lo usa quien todavia no tiene cuenta. Son nombres de paises y divisiones administrativas publicas.
router.get("/geografia/paises", listarPaises);
router.get("/geografia/provincias", listarProvincias);
router.get("/geografia/ciudades", listarCiudades);

export default router;
