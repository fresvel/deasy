// Comparar dos escrituras de un teléfono, y componer la internacional.
//
// ⚠️ ESTO VIVE EN EL BACKEND A PROPÓSITO, y es el cambio de C2b. Antes comparaba el microservicio
// `channels`, que NO sabe de qué país es el número guardado, así que sólo podía mirar la cola:
// comparaba los últimos ocho dígitos. Con esa regla `+51 99 111 2233` (Perú) y `+593 99 111 2233`
// (Ecuador) son el mismo teléfono — medido, no supuesto. Eso permitía registrar el número de otro y
// verificarlo desde una línea propia con la misma cola, que es exactamente lo que la verificación
// existe para impedir.
//
// El backend sí sabe el país (`telefonos.pais_id` -> `paises.phone_code`), así que aquí la
// comparación puede ser EXACTA. La regla es: se normalizan las dos a internacional y tienen que
// salir iguales.

/**
 * El prefijo internacional sin `+` y sin el cero nacional: `0991112233` de Ecuador es `593991112233`.
 *
 * ⚠️ El cero se quita SIEMPRE que esté al principio, no sólo uno: hay quien guarda el número con el
 * formato local completo. Y el prefijo se limpia de todo lo que no sea dígito porque en la base
 * conviven `+593`, `593` y `00593`.
 */
export const aFormatoInternacional = (numero, phoneCode) => {
  const prefijo = String(phoneCode ?? "").replace(/\D/g, "").replace(/^00/, "");
  const local = String(numero ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return `${prefijo}${local}`;
};

/** La parte local, sin prefijo de país y sin el cero nacional. */
const parteLocal = (numero) => String(numero ?? "").replace(/\D/g, "").replace(/^0+/, "");

/**
 * ¿El número que llegó por el canal es el que hay guardado?
 *
 * @param {object} guardado  `{ numero, phone_code }` tal como salen de `telefonos` + `paises`
 * @param {string} probado   lo que el transporte asegura que envió el mensaje
 *
 * Se aceptan tres escrituras del número que llega, y **ninguna más**:
 *
 *   1. La internacional completa — `593991112233`, con `+`, con `00` o a secas. Es la que dan
 *      Telegram, WhatsApp y cualquier pasarela de SMS.
 *   2. La local con cero — `0991112233`.
 *   3. La local sin cero — `991112233`.
 *
 * Las dos últimas existen por el SMS **nacional** desde módem propio, que es el único transporte que
 * puede entregar un número sin país. Y se exige **igualdad exacta** con la parte local, no que
 * termine igual: aceptar un sufijo es justo el agujero que trajo este módulo aquí.
 *
 * ⚠️ Si el teléfono guardado NO tiene país, se RECHAZA. Sin prefijo no hay comparación
 * internacional posible, y la alternativa —comparar sólo la parte local— volvería a dar por bueno
 * el número de otro país. `telefonos.pais_id` es nullable, así que el caso existe de verdad.
 */
export const numerosIguales = (guardado, probado) => {
  const prefijo = String(guardado?.phone_code ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!prefijo) return false;

  const local = parteLocal(guardado?.numero);
  if (!local) return false;

  const llega = String(probado ?? "").replace(/\D/g, "").replace(/^00/, "");
  if (!llega) return false;

  return llega === `${prefijo}${local}` || llega === local || llega === `0${local}`;
};
