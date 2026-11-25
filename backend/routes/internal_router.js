import express from "express";
import { requiereServicioInterno } from "../middlewares/servicioInterno.js";
import { estadoDeLlave, confirmarLlave, numerosVerificados } from "../dominios/identidad/index.js";

// Rutas que SÓLO llaman los microservicios de Deasy, nunca un navegador.
//
// ⚠️ Van bajo `/internal/` y ADEMÁS nginx devuelve 404 para `/api/internal/`. Las dos capas hacen
// falta: el proxy publica el backend entero bajo `/api/`, así que sin la regla estas rutas estarían
// en internet, y sin la clave una regla mal copiada en otro entorno las dejaría al aire.
const router = express.Router();

router.use(requiereServicioInterno);

// Dos rutas y no tres: la sonda dice si la llave vive, y `confirmar` COMPARA Y CONSUME en una
// transacción. Antes eran «resolver» (que entregaba el número) y «consumir», con la comparación en
// medio y en el otro lado de la red — ver C2b.
router.post("/verificacion/estado", estadoDeLlave);
router.post("/verificacion/confirmar", confirmarLlave);
// La barrida de conversaciones: `channels` pregunta cuales de estos numeros verificaron alguna vez,
// para conservar solo lo que tiene base legal. En LOTE, porque pregunta por todas de una vez.
router.post("/verificacion/numeros-verificados", numerosVerificados);

export default router;
