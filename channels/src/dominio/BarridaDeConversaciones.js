/**
 * Borra las conversaciones que no tienen base legal para conservarse.
 *
 * ── LA REGLA, Y POR QUÉ NO ES UN PLAZO ──────────────────────────────────────────────────────────
 *
 * **Se conserva la conversación de quien tuvo una interacción legítima; la de quien no, se borra.**
 *
 * La propuso el dueño, y es mejor que el plazo fijo que yo planteaba: **un plazo borra por igual lo
 * justificado y lo que no**. Esta regla conserva exactamente lo que tiene base legal y elimina
 * exactamente lo que no la tiene, que es lo que piden la **juridicidad** (Art. 7) y la
 * **minimización** (Art. 10.f) de la LOPDP.
 *
 * ── QUIÉN PUEDE LLEGAR AL NÚMERO SIN HABER ACEPTADO NADA ────────────────────────────────────────
 *
 * Por el registro no: el enlace con el número aparece **en el paso 3**, y para llegar ahí hay que
 * haber aceptado en el paso 1. Pero alguien puede recibir el número de otra persona, o de una
 * captura. **Esa persona no consintió nada, y su dato no está cubierto por nada.**
 *
 * ⚠️ **Y no se resuelve con un plazo largo**: da igual cuánto se espere, nunca habrá base legal para
 * esa conversación. Por eso la regla mira la BASE, no el reloj.
 */
export default class BarridaDeConversaciones {
  /**
   * @param {object} cliente  el canal, que sabe listar y borrar sus conversaciones
   * @param {object} deasy    quien sabe qué números verificaron
   */
  constructor({ cliente, deasy, ahora = () => Date.now(), graciaMs = 60 * 60 * 1000 } = {}) {
    this.cliente = cliente;
    this.deasy = deasy;
    this.ahora = ahora;
    // ⚠️ UNA CONVERSACIÓN RECIÉN ABIERTA NO SE TOCA. Quien está verificándose ahora mismo aún no
    // figura como verificado --lo estará en segundos-- y sin esta gracia la barrida le borraría el
    // mensaje mientras lo está mandando.
    this.graciaMs = graciaMs;
  }

  /**
   * Una pasada.
   *
   * @returns {Promise<{revisadas: number, borradas: number, motivo?: string}>}
   */
  async unaPasada() {
    const chats = await this.cliente.getChats();

    // Sólo conversaciones de una persona. Un grupo no se borra ni se conserva por esta regla: el
    // canal ya los ignora al recibir, así que aquí tampoco se tocan.
    const privados = (chats ?? []).filter((c) => !c.isGroup && String(c.id?._serialized ?? "").endsWith("@c.us"));
    const candidatos = privados.filter((c) => this.ahora() - (c.timestamp ?? 0) * 1000 > this.graciaMs);
    if (!candidatos.length) return { revisadas: privados.length, borradas: 0 };

    const numeros = candidatos.map((c) => String(c.id._serialized).replace("@c.us", ""));
    const verificados = await this.deasy.numerosVerificados(numeros);

    // ⚠️ SIN RESPUESTA NO SE BORRA NADA. `null` significa que el backend no contestó; tratarlo como
    // «ninguno verificó» borraría TODAS las conversaciones de golpe. Un fallo de red no puede tener
    // consecuencias irreversibles.
    if (!verificados) {
      return { revisadas: privados.length, borradas: 0, motivo: "sin_respuesta_del_backend" };
    }

    let borradas = 0;
    for (const chat of candidatos) {
      const numero = String(chat.id._serialized).replace("@c.us", "");
      if (verificados.has(numero)) continue;
      try {
        await chat.delete();
        borradas += 1;
      } catch (error) {
        // Que una falle no puede parar las demás: cada conversación es independiente.
        console.error(`[barrida] no se pudo borrar una conversación — ${error.message}`);
      }
    }

    if (borradas) {
      // Se dice CUÁNTAS, nunca de quién: el registro no es sitio para números de nadie.
      console.log(`[barrida] ${borradas} conversación(es) sin base legal, borradas`);
    }
    return { revisadas: privados.length, borradas };
  }
}
