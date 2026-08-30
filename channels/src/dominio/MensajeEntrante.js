/**
 * Lo que un canal entrega cuando ya tiene todo lo que necesita.
 *
 * Es una clase y no un objeto suelto por una razón concreta: `numeroProbado` es una
 * AFIRMACIÓN del canal —«he comprobado que este número es de quien escribe»— y conviene
 * que construirlo obligue a decidirlo, en vez de que sea un campo que a veces se olvida.
 */
export default class MensajeEntrante {
  /**
   * @param {string} canal          quién lo entrega: `telegram` · `whatsapp` · `sms`
   * @param {string} llave          lo que el usuario trajo, y que el backend tiene que reconocer
   * @param {string|null} numeroProbado  el número, SOLO si el canal pudo probar que es suyo
   * @param {object} contexto       lo que el canal necesite para contestarle (chat, sesión…)
   */
  constructor({ canal, llave, numeroProbado = null, contexto = {} } = {}) {
    if (!canal) throw new Error("Un mensaje entrante tiene que decir de qué canal viene.");
    this.canal = canal;
    this.llave = String(llave ?? "").trim();
    this.numeroProbado = numeroProbado ? String(numeroProbado).trim() : null;
    this.contexto = contexto;
    Object.freeze(this);
  }

  get tieneLlave() {
    return this.llave.length > 0;
  }

  get tieneNumero() {
    return this.numeroProbado !== null && this.numeroProbado.length > 0;
  }
}
