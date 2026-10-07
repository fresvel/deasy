// Qué canales puede ofrecer ESTE despliegue para probar un teléfono, y cómo se le habla a cada uno.
//
// Vive aparte del controlador y del servicio a propósito: es una regla de despliegue, no transporte
// ni base de datos, y tiene tres consumidores previstos — la petición de verificación, la pestaña de
// administración (C7) y la pantalla de registro (C8). Es lógica pura y se prueba sin red.
//
import QRCode from "qrcode";

// ⚠️ EN TODOS LOS CANALES ESCRIBE EL USUARIO. No mandamos nada: componemos el enlace que abre su
// aplicación con la llave ya puesta.
//
// De ahí sale una propiedad que conviene no perder al añadir canales: **paga quien envía, así que
// no hay ataque de coste**. Nadie puede hacernos gastar pidiendo llaves en bucle, porque emitir una
// llave no cuesta nada. Es permanente desde que se descartó el SMS (2026-09-01): el OTP saliente era
// la única variante que lo habría roto, y con él llegaba el fraude de bombeo de SMS.

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
  return enlaces;
};

/** ¿Este despliegue puede verificar teléfonos? Con cero canales, la respuesta honesta es que no. */
export const hayAlgunCanal = (env = process.env) => Object.keys(canalesConfigurados("x", env)).length > 0;

/**
 * Los canales con su código QR ya dibujado.
 *
 * ⚠️ **EL QR NO ES UN ADORNO: es la mitad del canal.** Quien se registra desde el ORDENADOR no puede
 * pulsar un enlace que abre una aplicación de móvil —o la abre en el ordenador, que es donde no está
 * su número—. Y quien se registra desde el MÓVIL no puede escanear su propia pantalla. Por eso van
 * las dos formas, y desde el principio: el enlace para el móvil, el QR para el ordenador.
 *
 * Se genera AQUÍ y no en la pantalla por lo mismo que los enlaces: el frontend no tiene por qué
 * saber qué se codifica en cada canal.
 */
export const canalesConQR = async (llave, env = process.env) => {
  const canales = canalesConfigurados(llave, env);
  const dibujar = (texto) =>
    QRCode.toDataURL(texto, { margin: 1, width: 320, errorCorrectionLevel: "M" });

  const salida = {};
  for (const [nombre, enlace] of Object.entries(canales)) {
    salida[nombre] = { enlace, qr: await dibujar(enlace) };
  }
  return salida;
};
