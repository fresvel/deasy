// Política de contraseñas ÚNICA del sistema.
//
// Antes estaba duplicada entre el middleware de registro (middlewares/val_password.js)
// y SqlAdminService (alta/cambio de contraseña por admin), con criterios que ya habían
// empezado a divergir. Una política de seguridad que difiere entre dos puertas de
// entrada es una vía de escape esperando a ser encontrada.
//
// La regla: al menos 3 de los 4 criterios OBLIGATORIOS.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_CRITERIA = 3;

// `special` se EVALÚA pero NO cuenta para el umbral: es una sugerencia. Se mantiene
// así porque el middleware lo reporta en `details` como pista para el usuario. Si
// alguna vez se decide que sea obligatorio, es una decisión de producto (endurece la
// política), no un refactor.
const REQUIRED_CRITERIA = ["length", "lowercase", "uppercase", "number"];

// Regex de caracteres especiales, idéntica a la que usaba el middleware.
const SPECIAL_CHARS = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

// Evalúa cada criterio y decide. Devuelve la evaluación completa (incluido `special`,
// informativo) para que cada llamador construya su propia respuesta.
export const evaluatePasswordPolicy = (password) => {
  const value = String(password ?? "");
  const criteria = {
    length: value.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
    special: SPECIAL_CHARS.test(value),
  };
  const passedCount = REQUIRED_CRITERIA.filter((key) => criteria[key]).length;
  return { criteria, passedCount, passed: passedCount >= PASSWORD_MIN_CRITERIA };
};

// Mensaje del throw en los flujos de servicio (SqlAdminService). El middleware conserva
// su propio texto para no alterar la respuesta HTTP que ya devuelve.
export const PASSWORD_POLICY_MESSAGE =
  "La contraseña debe cumplir al menos 3 criterios: 8+ caracteres, mayúscula, minúscula, número.";

export const assertPasswordPolicy = (password) => {
  if (!evaluatePasswordPolicy(password).passed) {
    throw new Error(PASSWORD_POLICY_MESSAGE);
  }
};
