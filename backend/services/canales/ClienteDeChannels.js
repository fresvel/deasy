/**
 * Lo único del backend que sabe hablar con el microservicio `channels`.
 *
 * ── SE PREGUNTA, NO SE ESCUCHA ──────────────────────────────────────────────────────────────────
 *
 * La alternativa era que `channels` mantuviera un socket contra el backend y avisara de cada cambio.
 * Se descartó por un motivo que no es de gusto: **quien puede estar muerto no puede ser el
 * responsable de avisar de que lo está.** El 2026-08-31 ese servicio murió de un `SIGKILL` y estuvo
 * TRECE HORAS parado; un proceso muerto no manda eventos, y desde aquí el silencio es indistinguible
 * de «no ha cambiado nada». Preguntando, **la ausencia de respuesta ES la respuesta** — y por eso
 * `noAlcanzable()` no es un error, es un estado.
 *
 * Ver `docs/arquitecturas/pestana-de-canales.md` §4alt.
 */
export default class ClienteDeChannels {
  /**
   * @param {string} base   la URL interna del servicio. NO pasa por el proxy: nginx devuelve 404
   *                        para todo lo interno a propósito.
   * @param {string} clave  la MISMA `INTERNAL_SERVICE_KEY` que `channels` usa para hablar con
   *                        nosotros. Es la misma relación de confianza en el otro sentido.
   */
  constructor({ base = process.env.CHANNELS_URL, clave = process.env.INTERNAL_SERVICE_KEY, tiempoLimiteMs = 4000 } = {}) {
    this.base = String(base ?? "").replace(/\/$/, "");
    this.clave = clave;
    this.tiempoLimiteMs = tiempoLimiteMs;
  }

  get configurado() {
    return Boolean(this.base && this.clave);
  }

  async estado() {
    return this.pedir("/estado");
  }

  /**
   * El código de vinculación.
   *
   * ⚠️ Se distingue el 409 --«no hay QR que dar»-- de un fallo, porque son mensajes distintos para
   * quien mira: uno dice «el canal está bien, no hace falta» y el otro «no se pudo comprobar».
   */
  async codigoDeVinculacion() {
    const r = await this.pedir("/qr");
    if (r.alcanzable && r.codigo === 409) return { alcanzable: true, hayQr: false };
    return r;
  }

  async pedir(ruta) {
    if (!this.configurado) {
      return this.noAlcanzable("el backend no tiene configurado dónde está el servicio de canales");
    }

    // ⚠️ CON LÍMITE DE TIEMPO. Sin esto, un `channels` medio vivo --el proceso en pie pero la
    // petición colgada-- dejaría la pantalla de administración girando para siempre, que desde fuera
    // se parece demasiado a «la aplicación está rota».
    const corte = AbortSignal.timeout(this.tiempoLimiteMs);
    try {
      const respuesta = await fetch(`${this.base}${ruta}`, {
        headers: { "x-clave-servicio": this.clave },
        signal: corte,
      });
      const cuerpo = await respuesta.json().catch(() => ({}));
      return { alcanzable: true, codigo: respuesta.status, ...cuerpo };
    } catch (error) {
      return this.noAlcanzable(error.message);
    }
  }

  /** No poder hablar con el servicio NO es un error de la pantalla: es el estado del sistema. */
  noAlcanzable(motivo) {
    return { alcanzable: false, error: motivo };
  }
}
