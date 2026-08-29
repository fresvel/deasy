import { Router } from "express";
import { getBootstrapStatus, initializeBootstrap } from "../controllers/system/bootstrap_controller.js";
import { listarPaises, listarProvincias, listarCiudades } from "../controllers/system/geografia_controller.js";
import { getInstitucionPublica } from "../controllers/system/institucion_controller.js";

const router = Router();

router.get("/bootstrap/status", getBootstrapStatus);
router.post("/bootstrap/initialize", initializeBootstrap);

// El catalogo geografico, SIN autenticar: lo consume el formulario de registro, que por definicion
// lo usa quien todavia no tiene cuenta. Son nombres de paises y divisiones administrativas publicas.
// La institución de este despliegue: su nombre, su país y cómo llama ese país al documento de
// identidad. Sin autenticar, como la geografía: lo consume el registro.
router.get("/institucion", getInstitucionPublica);

router.get("/geografia/paises", listarPaises);
router.get("/geografia/provincias", listarProvincias);
router.get("/geografia/ciudades", listarCiudades);

export default router;
