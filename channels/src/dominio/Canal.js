/**
 * El contrato que cumple todo canal de mensajería.
 *
 * Es lo ÚNICO polimórfico del servicio, y se gana el sueldo porque hay un eje real de
 * variación: **el canal se elige en EJECUCIÓN** —quien se registra decide por dónde prueba su
 * número, y el servicio monta sólo los que estén configurados—.
 *
 * ⚠️ **Aquí ponía «hay tres, y con tres deja de discutirse». Hoy hay DOS** (el SMS se descartó
 * el 2026-09-01; el porqué, abajo). Y el argumento se sostenía sobre el número, que era el
 * argumento flojo: lo que justifica el polimorfismo no es cuántos hay, sino que **prueban el
 * número de formas que no se parecen** —una llega en un paso, la otra en dos— y que la política
 * no debe saber ninguna. Con un `switch` por canal, cada forma nueva toca el sitio donde se
 * decide si alguien queda verificado, que es el peor lugar del servicio para andar tocando.
 *
 * Sigue habiendo un tercero previsto (la app propia), y con él el número volverá a tres. Pero
 * si algún día quedara **uno solo**, esta abstracción habría que revisarla en vez de defenderla.
 *
 * ── LA RESPONSABILIDAD QUE NO SE VE, Y ES LA QUE IMPORTA ────────────────────────────────
 *
 * Un canal NO entrega «lo que llegó». Entrega un `MensajeEntrante` NORMALIZADO, y con él
 * asume una obligación: si pone `numeroProbado`, está afirmando que **ese número es de
 * quien escribe** y que lo ha comprobado con lo que su transporte le permita.
 *
 * Cada canal lo prueba de forma distinta, y por eso vive aquí y no en la política:
 *
 *   · WhatsApp — llega un identificador de conversación. Si es `@c.us`, ESE es el teléfono.
 *                Si es `@lid` —el identificador OPACO al que WhatsApp está migrando— NO se
 *                puede deducir: hay que preguntárselo a WhatsApp, y si no contesta con un
 *                teléfono, se RECHAZA.
 *   · Telegram — NO llega. El bot recibe un identificador, no un teléfono. Hay que pedirlo
 *                con un botón, y además exigir que el `user_id` del contacto coincida con el
 *                de quien escribe: sin eso, cualquiera reenvía la tarjeta de contacto de OTRA
 *                persona y verifica un número ajeno.
 *
 * ⚠️ **NINGUNO de los dos regala el número, y eso importa más que la mecánica.** Lo que ambos
 * conservan es que **quien afirma el número es la plataforma, sobre una sesión que ella misma
 * autenticó** — no quien escribe. Ésa es la propiedad que hace válida una verificación entrante,
 * y es exactamente la que le falta al SMS: su cabecera de origen la rellena el emisor y es
 * falsificable desde una pasarela SMPP (`10.1145/3615667`), lo que la convierte en un ataque
 * completo (`10.1145/3696011`). Por eso el SMS se descartó, y no por ser incómodo.
 *
 * Si la política tuviera que saber esas dos cosas, sería un `switch` por canal disfrazado
 * de clase. Así, la política pregunta una sola cosa: «¿me das un número probado?».
 */
export default class Canal {
  /** `telegram` · `whatsapp`. Identifica el canal en los avisos y en el registro. */
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
