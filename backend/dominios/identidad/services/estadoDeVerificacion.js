// Qué le falta a una persona para poder usar el sistema.
//
// ⚠️ **TODO SE DERIVA, NADA SE GUARDA.** No hay una columna `verificado` en `persons`, y no la habrá:
// una bandera almacenada puede acabar contradiciendo a las filas de las que debería salir, y
// entonces hay dos verdades y ninguna forma de saber cuál manda. Es el mismo motivo por el que
// `telefonos` tampoco tiene una — está escrito en el esquema y en `TelefonoVerificacionService`.
//
// ⚠️ Y SUSTITUYE A `verify: { email, whatsapp }`, que tenía dos problemas: no lo leía nadie, y
// mentía por omisión — decía «whatsapp» cuando la verificación pasó a ser por CUALQUIERA de los
// tres canales.

/**
 * ¿Tiene algún correo verificado?
 *
 * Se mira la lista entera y no sólo el principal: si alguien verificó un correo y después marcó
 * otro como principal, seguiría siendo cierto que probó ser dueño de una dirección suya.
 */
const tieneCorreoVerificado = (emails = []) =>
  emails.some((correo) => Boolean(Number(correo?.verificado)));

/**
 * ¿Tiene algún teléfono verificado?
 *
 * ⚠️ **BASTA CON UN CANAL, Y VERIFICAR UNO NO VERIFICA LOS OTROS.** Es la regla que fijó el dueño el
 * 2026-08-31 y es la que el modelo ya hacía: cada canal guarda lo suyo en `telefono_canales`, porque
 * probar que un número tiene Telegram no prueba que tenga WhatsApp. Lo que prueban los tres por
 * igual es que **el número es tuyo**, y eso es lo único que se pide aquí.
 */
const tieneTelefonoVerificado = (telefonos = []) =>
  telefonos.some((telefono) =>
    (telefono?.canales ?? []).some((canal) => Boolean(canal?.verificado))
  );

/**
 * @param {object} persona  tal como sale de `findById` — con sus `emails` y sus `telefonos`
 * @returns {{correo: boolean, telefono: boolean, completo: boolean}}
 */
export const estadoDeVerificacion = (persona) => {
  const correo = tieneCorreoVerificado(persona?.emails);
  const telefono = tieneTelefonoVerificado(persona?.telefonos);
  return { correo, telefono, completo: correo && telefono };
};

/**
 * El primer paso que le falta, o `null` si no le falta ninguno.
 *
 * El ORDEN importa y es el del registro: primero el correo. No es capricho — el correo es la llave
 * de acceso desde que se retiró el documento, así que es lo primero que hay que asegurar; el
 * teléfono es el segundo factor, y sin correo no habría a dónde volver si se pierde.
 */
export const primerPasoPendiente = (persona) => {
  const estado = estadoDeVerificacion(persona);
  if (!estado.correo) return "correo";
  if (!estado.telefono) return "telefono";
  return null;
};
