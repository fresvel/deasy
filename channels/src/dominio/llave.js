/**
 * Sacar la llave de lo que el usuario escribe.
 *
 * ⚠️ Vive aquí y no dentro de un canal porque **la usan los tres**. Estaba en `CanalTelegram` como
 * método estático cuando era el único; duplicarla en WhatsApp habría creado dos criterios sobre qué
 * es una llave, y el día que uno cambie el otro se queda mintiendo.
 */

/**
 * @returns {string|null} la llave, o `null` si eso no puede ser una llave nuestra
 *
 * Se acepta con `/start` delante --así la entrega Telegram desde su enlace profundo-- y también a
 * secas, porque quien no puede pulsar el enlace la copia y la pega, y en WhatsApp **no hay `/start`
 * en absoluto**: el texto es la llave.
 */
export const llaveDe = (texto) => {
  const limpio = String(texto ?? "").trim();
  if (!limpio) return null;

  const conStart = limpio.startsWith("/start");
  const candidato = conStart ? limpio.slice("/start".length).trim() : limpio;

  // El alfabeto es el que impone Telegram al payload de `start`; cualquier otra cosa no es una llave
  // nuestra, y tratarla como tal sólo produce consultas inútiles al backend.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(candidato)) return null;

  // ⚠️ CON `/start` VALE CUALQUIER LONGITUD: quien llega así viene de un enlace NUESTRO, así que no
  // hay ambigüedad. A PELO se exige que sea larga, y esto no es un capricho: «hola», «ok» y «test»
  // pasan el alfabeto perfectamente, y sin este mínimo cada saludo se convertía en una consulta al
  // backend preguntando por una llave inventada. En WhatsApp eso sería CADA MENSAJE que alguien mande
  // al número, que es mucho peor que en Telegram --allí sólo se habla con el bot a propósito--.
  //
  // Nuestras llaves son 32 bytes en base64url --43 caracteres--, así que 20 deja margen de sobra sin
  // dejar pasar una palabra suelta.
  return conStart || candidato.length >= 20 ? candidato : null;
};
