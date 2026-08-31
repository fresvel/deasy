/**
 * El ÚNICO sitio que habla con la API de Telegram.
 *
 * Mismo criterio que `ClienteDeDeasy`: la dirección, el token, la forma de las peticiones y qué
 * hacer si no contesta viven juntos, porque cambian juntos.
 *
 * ── TRES ATADURAS DE TELEGRAM QUE HAY QUE SABER ANTES DE TOCAR ESTO ─────────────────────────────
 *
 * 1. **`getUpdates` y los webhooks son MUTUAMENTE EXCLUYENTES.** Si hay un webhook puesto,
 *    `getUpdates` responde 409 y el canal no recibe nada. Por eso `olvidarWebhook()` se llama al
 *    arrancar: es idempotente y evita un fallo que, si no, se diagnostica a ciegas.
 *
 * 2. **Un solo consumidor.** Cada actualización se entrega UNA vez: dos procesos sondeando se
 *    roban los mensajes entre ellos, y el síntoma es intermitente. De ahí que el servicio corra en
 *    una instancia y que haya UN BOT POR ENTORNO.
 *
 * 3. **El sondeo es largo.** `timeout` es de Telegram, no nuestro: la petición se queda abierta
 *    hasta que hay algo o hasta que vence. No es una espera activa.
 *
 * ⚠️ El token ES el bot: quien lo tiene lee todo lo que se le escriba y puede hablar en su nombre.
 * No se registra, no se enseña en errores y no viaja en la URL más que aquí dentro.
 */
export default class ClienteDeTelegram {
  /**
   * @param {string} token        el de BotFather
   * @param {Function} [fetch]    inyectable, para poder probar sin red
   * @param {number} [timeout]    segundos que Telegram mantiene abierta la espera
   */
  constructor({ token, fetch: fetchInyectado, timeout = 30 } = {}) {
    if (!token) throw new Error("CanalTelegram necesita el token del bot (TELEGRAM_BOT_TOKEN).");
    this.token = token;
    this.fetch = fetchInyectado ?? globalThis.fetch;
    this.timeout = timeout;
  }

  async pedir(metodo, cuerpo = {}) {
    const respuesta = await this.fetch(`https://api.telegram.org/bot${this.token}/${metodo}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const datos = await respuesta.json().catch(() => ({}));
    if (!datos?.ok) {
      // El mensaje de Telegram se conserva porque dice exactamente qué pasa («bot was blocked by
      // the user», «chat not found»); el token no aparece en él.
      throw new Error(`Telegram rechazó ${metodo}: ${datos?.description ?? respuesta.status}`);
    }
    return datos.result;
  }

  /** Quiénes somos. Sirve de comprobación de vida: si esto falla, el token no vale. */
  async quienSoy() {
    return this.pedir("getMe");
  }

  /**
   * Quita el webhook si lo hubiera. Idempotente, y sin él `getUpdates` puede dar 409 para siempre.
   *
   * `drop_pending_updates` se queda en `false` A PROPÓSITO: si alguien escribió mientras el
   * servicio estaba caído, su verificación sigue siendo válida —la llave dura quince minutos— y
   * tirar los mensajes le haría repetir sin saber por qué.
   */
  async olvidarWebhook() {
    return this.pedir("deleteWebhook", { drop_pending_updates: false });
  }

  /**
   * Las actualizaciones desde `offset`.
   *
   * ⚠️ El `offset` es lo que las CONFIRMA: pedir a partir de `ultimo + 1` es lo que le dice a
   * Telegram que las anteriores ya están tratadas. Si no se avanza, llegan una y otra vez.
   */
  async actualizaciones(offset) {
    return this.pedir("getUpdates", {
      offset,
      timeout: this.timeout,
      // Sólo mensajes: ni ediciones, ni pulsaciones de botones, ni nada de canales.
      allowed_updates: ["message"],
    });
  }

  async escribir(chatId, texto, tecladoExtra = {}) {
    return this.pedir("sendMessage", { chat_id: chatId, text: texto, ...tecladoExtra });
  }

  /**
   * El botón que PIDE el contacto. Es la única forma de que un bot sepa un número de teléfono:
   * Telegram no se lo da, y el usuario tiene que entregarlo a propósito.
   */
  static get BOTON_CONTACTO() {
    return {
      reply_markup: {
        keyboard: [[{ text: "📱 Compartir mi número", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    };
  }

  /** Retira el teclado cuando ya no hace falta, para no dejarlo puesto en la conversación. */
  static get SIN_TECLADO() {
    return { reply_markup: { remove_keyboard: true } };
  }
}
