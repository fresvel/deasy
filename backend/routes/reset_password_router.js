import { Router } from "express";
import {
  requestPasswordReset,
  verifyResetCode,
  resetPassword
} from "../controllers/users/reset_password.js";
import { limitaYCuenta } from "../middlewares/limitaIntentos.js";

const router = Router();

// Anonima y MANDA UN CORREO: se cuenta siempre, salga bien o mal, porque el envio ya costo.
router.post("/request", limitaYCuenta("reset_password"), requestPasswordReset);
// Adivinable: un codigo corto sin freno se prueba entero.
router.post("/verify", limitaYCuenta("reset_password"), verifyResetCode);
router.post("/reset", limitaYCuenta("reset_password"), resetPassword);

export default router;
