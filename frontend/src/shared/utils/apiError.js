/**
 * Extrae el mensaje presentable de un error de axios.
 *
 * Existe porque el backend NO tiene un contrato unico de error, y cada vista de auth se habia adaptado
 * al suyo a mano. Hay dos formas vivas:
 *
 *   { ok: false, error: "Codigo invalido o expirado" }
 *       -> verify_email.js, reset_password.js: el mensaje HUMANO viaja en `error`, y no hay `message`.
 *
 *   { success: false, message: "Error al agregar titulo", error: "<detalle tecnico>" }
 *       -> el helper fail() de dossier_controler.js:123 y la mayoria de controllers: el mensaje humano
 *          esta en `message` y `error` es el volcado de la excepcion, que NO debe verse.
 *
 * De ahi la precedencia `message` -> `error`: cubre las dos sin mostrar nunca un stack al usuario. Con la
 * primera forma no hay `message`, asi que cae a `error`, que es el texto correcto; con la segunda gana
 * `message` y el detalle tecnico se ignora. Invertir el orden romperia la segunda forma.
 *
 * Lo correcto de verdad seria unificar el contrato en el backend; mientras tanto, la traduccion vive en
 * un solo sitio en vez de en cinco.
 *
 * @param {unknown} error Error capturado (normalmente de axios).
 * @param {string} fallback Texto a usar cuando no se puede sacar nada mejor.
 * @returns {string}
 */
export const resolveApiErrorMessage = (error, fallback = "Ocurrió un error inesperado.") => {
  const data = error?.response?.data;
  // Se evalua candidato a candidato, no con `a || b`: un mensaje en blanco es truthy y se llevaria el
  // turno del siguiente, dejando al usuario con el fallback generico habiendo un motivo real disponible.
  const candidates = [data?.message, data?.error, error?.message];
  const usable = candidates.find((value) => typeof value === "string" && value.trim());
  return usable ?? fallback;
};
