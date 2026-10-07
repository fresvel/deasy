import { estadoDeVerificacion } from "../services/users/estadoDeVerificacion.js";

// La puerta DE VERDAD del registro en tres pasos.
//
// ⚠️ **EL GUARDIÁN DEL ROUTER NO ES UNA PUERTA.** Un `beforeEach` de Vue decide qué pantalla se
// pinta; quien tenga el token llama a la API directamente y se salta el navegador entero. Este
// repositorio ya tropezó con eso y lo dejó escrito donde dolió — `services/users/UserWorkspaceRepository.js`, en `getTaskItemsForTaskIds`:
//
//     «El bloqueo era solo visual: la API los servía igual.»
//
// Aquel caso repartía los entregables de unos docentes a otros. Aquí sería peor: la verificación del
// teléfono es la condición de entrada, y sin este middleware bastaría con no abrir el navegador.
//
// El guardián del router se queda, pero como la mitad AMABLE: te lleva al paso que te falta en vez
// de darte un 403 sin explicación.

/**
 * Deja pasar sólo a quien tenga correo Y teléfono verificados.
 *
 * ⚠️ Necesita que `loadAccessContext` --o quien sea-- haya dejado la persona con sus `emails` y sus
 * `telefonos` en `req.persona`. Si no está, se relee: es una consulta más, y prefiero pagarla a
 * dejar la puerta abierta por un orden de middlewares que alguien cambie dentro de seis meses.
 *
 * @param {Function} leerPersona  cómo obtener la persona; se inyecta para poder probarlo sin base
 */
export const exigeVerificacionCompleta = (leerPersona) => async (req, res, next) => {
  try {
    const persona = req.persona ?? (await leerPersona(req.user?.uid));
    if (!persona) {
      // No se dice «no existe»: quien llega aquí trae un token válido, así que esto es un estado
      // roto nuestro, no un dato que el usuario pueda arreglar.
      return res.status(401).json({ message: "Sesión no válida." });
    }

    const estado = estadoDeVerificacion(persona);
    if (estado.completo) return next();

    // El cuerpo dice QUÉ falta, para que el frontend pueda llevar a la pantalla correcta sin tener
    // que adivinarlo ni pedir otra cosa. Un 403 a secas obligaría a una segunda petición.
    return res.status(403).json({
      message: "Falta completar la verificación de tu cuenta.",
      verificacion: estado,
    });
  } catch (error) {
    next(error);
  }
};

export default exigeVerificacionCompleta;
