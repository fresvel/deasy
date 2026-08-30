/**
 * El ÚNICO sitio del servicio que llama al backend.
 *
 * Aquí viven las cuatro cosas que cambian juntas: la dirección, la clave compartida, la forma
 * exacta de las dos peticiones y qué hacer si no contesta. Repartidas, ese conocimiento queda en
 * cinco sitios y se desincroniza — que es el olor que la norma del repositorio pone primero.
 *
 * Es el mismo criterio que `httpClient` en el frontend, que `patrones-diseno.md` nombra como uno de
 * los tres sitios donde un patrón se gana el sueldo.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────────────────────────
 * No decide nada. No sabe si una llave caducó, no marca teléfonos y no toca la base de Deasy.
 */
export default class ClienteDeDeasy {
  /**
   * @param {string} base   dirección del backend EN LA RED INTERNA
   * @param {string} clave  la clave compartida (`INTERNAL_SERVICE_KEY`)
   * @param {Function} [fetch]  inyectable, para poder probar sin red
   */
  constructor({ base, clave, fetch: fetchInyectado } = {}) {
    if (!base) throw new Error("ClienteDeDeasy necesita la dirección del backend.");
    if (!clave) throw new Error("ClienteDeDeasy necesita la clave del servicio interno.");
    this.base = String(base).replace(/\/+$/, "");
    this.clave = clave;
    this.fetch = fetchInyectado ?? globalThis.fetch;
  }

  async pedir(ruta, cuerpo) {
    return this.fetch(`${this.base}${ruta}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Por CABECERA y no por parámetro: los parámetros acaban en los registros del servidor.
        "x-deasy-servicio": this.clave,
      },
      body: JSON.stringify(cuerpo),
    });
  }

  /**
   * ¿Esta llave sigue viva?
   *
   * ⚠️ **No pregunta de quién es el número, y ya no lo recibe.** Ése es el cambio de C2b: el número
   * no sale del backend, y quien compara es quien sabe de qué país es. Aquí sólo se sondea, para no
   * hacerle a alguien el segundo paso de Telegram —compartir su contacto— con una llave muerta.
   *
   * ⚠️ Si el backend NO CONTESTA, esto LANZA en vez de devolver un rechazo. La diferencia importa:
   * la política distingue «tu llave no vale» de «esto es culpa nuestra», y decirle al usuario lo
   * primero cuando pasa lo segundo le hace reintentar cambiando cosas que están bien.
   */
  async estadoDeLlave(llave) {
    const respuesta = await this.pedir("/internal/verificacion/estado", { llave });

    if (respuesta.status === 404) {
      // ⚠️ DOS COSAS DISTINTAS RESPONDEN 404 AQUÍ, y confundirlas sale carísimo: el endpoint cuando
      // la llave no vale, y el GUARD cuando nuestra clave compartida no es la buena —que contesta
      // 404 a propósito, para no confirmarle a un desconocido que la ruta existe—.
      //
      // Se distinguen por el cuerpo: el endpoint SIEMPRE manda `estado`; el guard, un `message`.
      // Sin esta distinción, una clave mal puesta en un entorno haría que el canal le dijera «tu
      // enlace no vale» a TODO EL MUNDO, para siempre y sin una sola pista de por qué.
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!cuerpo?.estado) {
        throw new Error(
          "El backend devolvió 404 sin estado: casi seguro que INTERNAL_SERVICE_KEY no coincide."
        );
      }
      return { valida: false, estado: cuerpo.estado };
    }
    if (!respuesta.ok) {
      throw new Error(`El backend respondió ${respuesta.status} al consultar la llave.`);
    }
    return { valida: true };
  }

  /**
   * Le cuenta al backend LO QUE OBSERVÓ: este número mandó esta llave por este canal.
   *
   * ⚠️ **No manda un veredicto, manda un hecho.** El transporte prueba de qué número viene el
   * mensaje; si ese número es el que había que verificar lo decide el backend, que es el único que
   * sabe el país del número guardado. Antes lo decidía este servicio comparando la cola de ocho
   * dígitos, y así `+51 99 111 2233` valía por `+593 99 111 2233`.
   *
   * ⚠️ Un **409** no lanza: la llave no valía, o el número no era. Al usuario hay que decirle qué
   * pasó, no «error interno» — lo primero le dice qué hacer.
   */
  async confirmarVerificacion({ llave, numero, canal }) {
    const respuesta = await this.pedir("/internal/verificacion/confirmar", { llave, numero, canal });

    if (respuesta.status === 409) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      return { confirmado: false, estado: cuerpo.estado ?? "desconocida" };
    }
    if (!respuesta.ok) {
      throw new Error(`El backend respondió ${respuesta.status} al confirmar la llave.`);
    }
    return { confirmado: true };
  }
}
