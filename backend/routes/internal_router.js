import express from "express";
import { requiereServicioInterno } from "../middlewares/servicioInterno.js";
import { resolverLlave, consumirLlave } from "../controllers/users/telefono_verificacion_controller.js";

// Rutas que SÓLO llaman los microservicios de Deasy, nunca un navegador.
//
// ⚠️ Van bajo `/internal/` y ADEMÁS nginx devuelve 404 para `/api/internal/`. Las dos capas hacen
// falta: el proxy publica el backend entero bajo `/api/`, así que sin la regla estas rutas estarían
// en internet, y sin la clave una regla mal copiada en otro entorno las dejaría al aire.
const router = express.Router();

router.use(requiereServicioInterno);

router.post("/verificacion/resolver", resolverLlave);
router.post("/verificacion/consumir", consumirLlave);

export default router;
