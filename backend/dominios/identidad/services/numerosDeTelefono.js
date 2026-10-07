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

/**
 * La parte local, sin prefijo de país y sin el cero nacional.
 *
 * ⚠️ **ES LA FORMA EN QUE SE GUARDA, no sólo en la que se compara.** Hasta el 2026-08-31 sólo se
 * usaba al LEER —`aFormatoInternacional`, `numerosIguales` y el `numero_completo` del SQL— mientras
 * que al ESCRIBIR se guardaba lo que llegara. Y como `uq_telefonos_numero` es un índice sobre la
 * cadena cruda, `0987651100` y `987651100` eran dos números distintos para la base: **el mismo
 * teléfono se registró dos veces** con dos personas, comprobado en el navegador.
 *
 * El cero es el prefijo de marcación NACIONAL: no forma parte del número, igual que no forma parte
 * del E.164. Quitarlo al guardar es lo que hace que el índice único signifique lo que dice.
 */
export const parteLocal = (numero) => String(numero ?? "").replace(/\D/g, "").replace(/^0+/, "");

/**
 * ¿Este teléfono está guardado de forma que se pueda comparar?
 *
 * `numero` guarda la parte LOCAL y el país vive en `pais_id`. Guardar el prefijo DENTRO de `numero`
 * compone `593593…`, que no es el teléfono de nadie — y hasta el 2026-08-31 esos registros
 * verificaban igual, por la rama local que ya no existe. Ahora fallarían, pero fallarían al final
 * del camino y diciendo «ese número no es el tuyo», que es MENTIRA y no dice qué arreglar.
 *
 * Por eso se detecta antes: es corrupción del dato, no un intento fallido.
 */
export const numeroMalGuardado = (guardado) => {
  const prefijo = String(guardado?.phone_code ?? "").replace(/\D/g, "").replace(/^00/, "");
  const local = parteLocal(guardado?.numero);
  return Boolean(prefijo) && Boolean(local) && local.startsWith(prefijo);
};

/**
 * ¿El número que llegó por el canal es el que hay guardado?
 *
 * @param {object} guardado  `{ numero, phone_code }` tal como salen de `telefonos` + `paises`
 * @param {string} probado   lo que el transporte asegura que envió el mensaje
 *
 * Se acepta **UNA sola escritura**: la internacional completa — `593991112233`, con `+`, con `00`
 * o a secas. Es la que dan Telegram y WhatsApp.
 *
 * ⚠️ **HUBO DOS MÁS Y SE RETIRARON EL 2026-08-31** (la parte local con cero y sin él). Existían por
 * un canal **nacional** desde módem propio, único transporte capaz de entregar un número sin país. Se
 * pagaba permisividad por un canal que no existía, y la factura llegó: un teléfono guardado MAL —con
 * el prefijo del país dentro de `numero`— se verificó igualmente, porque su «parte local» casaba con
 * el internacional que llegaba.
 *
 * Es la misma familia que el agujero de `C2b`: en cuanto se compara algo que no lleva país, el país
 * deja de pintar nada.
 *
 * ⚠️ **Y ESTA REGLA YA ES PERMANENTE.** Aquí se prometía reinstaurar la forma local «si el canal
 * nacional acababa necesitándola». **Ese canal se descartó el 2026-09-01** —ver el frente 15— y con
 * él muere el único motivo que quedaba para aflojarla. Los dos canales vivos entregan el número con
 * su país. Si alguien vuelve a proponer la forma local, que traiga un transporte nuevo Y el país por
 * otra vía: sin país no hay comparación que valga.
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

  return llega === `${prefijo}${local}`;
};
