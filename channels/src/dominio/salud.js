/**
 * Cómo se traduce lo que un canal sabe de sí mismo a un veredicto que una pantalla pueda pintar.
 *
 * ── POR QUÉ ESTO NO ES UN BOOLEANO ──────────────────────────────────────────────────────────────
 *
 * Porque un booleano ya mintió. `CanalTelegram` devolvía `conectado: true` mientras el sondeo
 * llevaba horas fallando con `EAI_AGAIN api.telegram.org`: la bandera decía «arranqué y nadie me
 * paró», que no es lo mismo que «funciono». La pantalla habría pintado un verde sobre un canal
 * muerto — y eso es exactamente lo que costó trece horas de silencio el 2026-08-31.
 *
 * Así que se devuelven DOS cosas: el veredicto y **QUÉ LO RESPALDA**. Sin lo segundo, quien pinta no
 * puede distinguir una prueba de una suposición, y acaba pintándolas igual.
 */

/** El veredicto. */
export const SALUD = Object.freeze({
  SANO: "sano",
  /** Dice estar bien, pero no hay nada que lo confirme — o arrastra un error. */
  DEGRADADO: "degradado",
  /** WhatsApp esperando que alguien escanee. No es un fallo: es una tarea pendiente. */
  SIN_VINCULAR: "sin_vincular",
  /**
   * ⚠️ DISTINTO DE `CAIDO` A PROPÓSITO: un canal bloqueado NO SE ARREGLA REINICIANDO. Es
   * `TOS_BLOCK` (baneo), `CONFLICT` (otro se llevó la sesión) o `DEPRECATED_VERSION` (WhatsApp
   * cambió y la librería se quedó atrás). Cada uno pide una acción distinta de una persona.
   */
  BLOQUEADO: "bloqueado",
  CAIDO: "caido",
  DESCONOCIDO: "desconocido",
});

/** Qué respalda el veredicto. Es lo que decide si la pantalla puede pintar verde. */
export const EVIDENCIA = Object.freeze({
  /** El bucle de Telegram respondió. Es el nivel más alto: el sondeo **es** la recepción. */
  SONDEO: "sondeo",
  /** La plataforma contestó a una pregunta directa (`getState`). */
  PLATAFORMA: "plataforma",
  /** ⚠️ SÓLO la bandera interna del canal. Con esto NUNCA se pinta verde. */
  AFIRMACION: "afirmacion",
});

/**
 * Los estados de WhatsApp que significan «esto no se arregla solo».
 * Vienen de `WAState` de `whatsapp-web.js`, y se nombran aquí para no depender de importarla.
 */
export const ESTADOS_BLOQUEADO = Object.freeze([
  "TOS_BLOCK",
  "SMB_TOS_BLOCK",
  "CONFLICT",
  "DEPRECATED_VERSION",
  "PROXYBLOCK",
]);
