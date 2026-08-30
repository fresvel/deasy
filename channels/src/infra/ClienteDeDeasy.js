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
   * ¿De qué número es esta llave?
   *
   * Devuelve `{ valida: false, estado }` cuando el backend dice que no vale, con el motivo dentro:
   * «no existe», «caducó» y «ya se usó» son tres mensajes distintos para el usuario, y sólo los dos
   * últimos significan «repite sin cambiar nada».
   *
   * ⚠️ Si el backend NO CONTESTA, esto LANZA en vez de devolver un rechazo. La diferencia importa:
   * la política distingue «tu llave no vale» de «esto es culpa nuestra», y decirle al usuario lo
   * primero cuando pasa lo segundo le hace reintentar cambiando cosas que están bien.
   */
  async resolverLlave(llave) {
    const respuesta = await this.pedir("/internal/verificacion/resolver", { llave });

    if (respuesta.status === 404) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      return { valida: false, estado: cuerpo.estado ?? "desconocida" };
    }
    if (!respuesta.ok) {
      throw new Error(`El backend respondió ${respuesta.status} al resolver la llave.`);
    }

    const { numero } = await respuesta.json();
    return { valida: true, numero };
  }

  /**
   * Consume la llave. El backend marca el canal; aquí sólo se avisa.
   *
   * ⚠️ Un **409** NO es un fallo del sistema, y por eso no lanza: significa que la llave dejó de
   * valer ENTRE que se resolvió y se confirmó — el usuario pulsó dos veces, o llegaron dos mensajes
   * casi a la vez. Al usuario hay que decirle «ya se usó, pide otra», no «error interno»: lo primero
   * le dice qué hacer y lo segundo le hace esperar a que lo arreglemos nosotros.
   *
   * El resto de códigos SÍ lanzan, por la misma razón que en `resolverLlave`: un backend que no
   * contesta no debe parecerle al usuario un problema de su llave.
   */
  async confirmarVerificacion({ llave, canal }) {
    const respuesta = await this.pedir("/internal/verificacion/consumir", { llave, canal });

    if (respuesta.status === 409) {
      const cuerpo = await respuesta.json().catch(() => ({}));
      return { confirmado: false, estado: cuerpo.estado ?? "consumida" };
    }
    if (!respuesta.ok) {
      throw new Error(`El backend respondió ${respuesta.status} al consumir la llave.`);
    }
    return { confirmado: true };
  }
}
