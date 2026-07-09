import { randomInt } from "node:crypto";

// Código de verificación de 6 dígitos. Es un control de seguridad: `Math.random()`
// no es criptográficamente seguro y su salida es predecible a partir de muestras previas.
export const generateVerificationCode = () => {
  return String(randomInt(100000, 1000000));
};
