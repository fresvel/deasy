/**
 * El contrato que cumple todo canal de mensajería.
 *
 * Es lo ÚNICO polimórfico del servicio, y se gana el sueldo porque hay un eje real de
 * variación: el canal se elige en ejecución, hay tres, y habrá un cuarto (la app propia).
 * Con dos era defendible; con tres deja de discutirse.
 *
 * ── LA RESPONSABILIDAD QUE NO SE VE, Y ES LA QUE IMPORTA ────────────────────────────────
 *
 * Un canal NO entrega «lo que llegó». Entrega un `MensajeEntrante` NORMALIZADO, y con él
 * asume una obligación: si pone `numeroProbado`, está afirmando que **ese número es de
 * quien escribe** y que lo ha comprobado con lo que su transporte le permita.
 *
 * Cada canal lo prueba de forma distinta, y por eso vive aquí y no en la política:
 *
 *   · SMS entrante — el número viene en la cabecera del mensaje. Lo prueba el transporte.
 *   · WhatsApp     — el número llega con el mensaje. Igual.
 *   · Telegram     — NO llega. El bot recibe un identificador, no un teléfono. Hay que
 *                    pedirlo con un botón, y además exigir que el `user_id` del contacto
 *                    coincida con el de quien escribe: sin eso, cualquiera reenvía la
 *                    tarjeta de contacto de OTRA persona y verifica un número ajeno.
 *
 * Si la política tuviera que saber esas tres cosas, sería un `switch` por canal disfrazado
 * de clase. Así, la política pregunta una sola cosa: «¿me das un número probado?».
 */
export default class Canal {
  /** `telegram` · `whatsapp` · `sms`. Identifica el canal en los avisos y en el registro. */
  get nombre() {
    throw new Error("Un canal tiene que decir su nombre.");
  }

  /** Abre la conexión. Idempotente: llamarlo dos veces no abre dos. */
  async iniciar() {
    throw new Error(`${this.constructor.name} no implementa iniciar().`);
  }

  /** La cierra y suelta lo que tenga. Se llama al apagar el servicio. */
  async detener() {
    throw new Error(`${this.constructor.name} no implementa detener().`);
  }

  /**
   * Qué le pasa al canal ahora mismo. Lo lee la pantalla de administración.
   *
   * `{ conectado, necesitaVinculacion, qr, detalle }` — `qr` sólo cuando hay uno que
   * enseñar (WhatsApp esperando que alguien lo escanee).
   */
  async estado() {
    throw new Error(`${this.constructor.name} no implementa estado().`);
  }

  /**
   * Registra a quién avisar cuando llegue un mensaje COMPLETO.
   *
   * «Completo» quiere decir: con su llave y, si el canal pudo probarlo, con el número. Un
   * canal que necesita dos pasos —Telegram: primero la llave, luego el contacto— resuelve
   * ese baile por dentro y avisa UNA vez. La política nunca ve medio mensaje.
   */
  alRecibir(_manejador) {
    throw new Error(`${this.constructor.name} no implementa alRecibir().`);
  }
}
