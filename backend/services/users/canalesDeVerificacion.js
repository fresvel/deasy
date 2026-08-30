// Qué canales puede ofrecer ESTE despliegue para probar un teléfono, y cómo se le habla a cada uno.
//
// Vive aparte del controlador y del servicio a propósito: es una regla de despliegue, no transporte
// ni base de datos, y tiene tres consumidores previstos — la petición de verificación, la pestaña de
// administración (C7) y la pantalla de registro (C8). Es lógica pura y se prueba sin red.
//
// ⚠️ EN TODOS LOS CANALES ESCRIBE EL USUARIO. No mandamos nada: componemos el enlace que abre su
// aplicación con la llave ya puesta. Por eso ninguno cuesta por mensaje y por eso no existe el
// ataque de coste — quien paga el SMS es quien lo envía.

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
 * Los canales configurados, ya compuestos con la llave.
 *
 * Devuelve SÓLO los que existen. Un canal sin configurar no aparece como `null`: si apareciera, la
 * pantalla tendría que distinguir «no lo ofrecemos» de «lo ofrecemos y falló», y son cosas
 * distintas. Ausente significa que no se ofrece.
 *
 * @param {string} llave  la llave de un solo uso que viaja en el enlace
 * @param {object} env    de dónde se lee la configuración; se inyecta para poder probarlo
 */
export const canalesConfigurados = (llave, env = process.env) => {
  const enlaces = {};
  // Telegram admite 64 caracteres y sólo `A-Za-z0-9_-` en el payload de `start`. La llave se genera
  // ya dentro de ese alfabeto (`base64url`), así que aquí no hay que escapar nada — y si algún día
  // hubiera que escaparla, el canal dejaría de funcionar en ejecución, no aquí.
  if (env.TELEGRAM_BOT_USERNAME) {
    enlaces.telegram = `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${llave}`;
  }
  if (env.WHATSAPP_NUMERO) {
    enlaces.whatsapp = `https://wa.me/${env.WHATSAPP_NUMERO}?text=${encodeURIComponent(llave)}`;
  }
  if (env.SMS_NUMERO) {
    enlaces.sms = { numero: env.SMS_NUMERO, texto: llave };
  }
  return enlaces;
};

/** ¿Este despliegue puede verificar teléfonos? Con cero canales, la respuesta honesta es que no. */
export const hayAlgunCanal = (env = process.env) => Object.keys(canalesConfigurados("x", env)).length > 0;
