/**
 * Qué hacer cuando llega un mensaje por cualquier canal.
 *
 * UNA CLASE, SIN JERARQUÍA, y es deliberado: hay UNA política, no varias. Si algún día
 * hay otra cosa que interpretar —un comando del bot, una respuesta a una encuesta— será
 * OTRO manejador al lado, no una jerarquía sobre éste. La norma del repositorio es clara:
 * un patrón sin eje real de variación es coste sin premio.
 *
 * ── LO QUE ESTA CLASE NO SABE, A PROPÓSITO ──────────────────────────────────────────────
 *
 * No sabe de Telegram, ni de WhatsApp, ni de módems. No sabe cómo se prueba un número:
 * eso es del canal (ver `Canal`). No sabe si una llave caducó: eso es del backend, que es
 * donde están los datos.
 *
 * Sabe exactamente dos cosas: en qué orden preguntar, y qué hacer con cada respuesta.
 */

/** Por qué se rechazó. El canal decide cómo contárselo al usuario; aquí sólo se nombra. */
export const MOTIVOS = Object.freeze({
  SIN_LLAVE: "sin_llave",
  // Tres motivos y no uno, porque son tres mensajes distintos para el usuario: «este enlace no es
  // valido», «caduco, pide otro» y «ya lo usaste, pide otro». Solo los dos ultimos le dicen que
  // repita SIN cambiar nada de lo que hizo.
  LLAVE_DESCONOCIDA: "llave_desconocida",
  LLAVE_CADUCADA: "llave_caducada",
  LLAVE_CONSUMIDA: "llave_consumida",
  FALTA_NUMERO: "falta_numero",
  NUMERO_DISTINTO: "numero_distinto",
  BACKEND_CAIDO: "backend_caido",
});

// El backend nombra los estados; aqui se traducen a motivos. En un solo sitio, para que anadir un
// estado no obligue a buscar donde se interpretaba.
const MOTIVO_POR_ESTADO = Object.freeze({
  desconocida: MOTIVOS.LLAVE_DESCONOCIDA,
  caducada: MOTIVOS.LLAVE_CADUCADA,
  consumida: MOTIVOS.LLAVE_CONSUMIDA,
});

export default class VerificacionDeTelefono {
  /** @param {object} deasy el cliente del backend — el ÚNICO que habla con él */
  constructor(deasy) {
    this.deasy = deasy;
  }

  /**
   * @param {import('./MensajeEntrante.js').default} mensaje
   * @returns {Promise<{verificado: boolean, motivo?: string, numeroEsperado?: string}>}
   */
  async procesar(mensaje) {
    if (!mensaje?.tieneLlave) {
      return { verificado: false, motivo: MOTIVOS.SIN_LLAVE };
    }

    // Se pregunta ANTES de mirar el número, y el orden importa: si la llave no vale, no hay
    // con qué comparar. Al revés se compararía contra un número inventado.
    let peticion;
    try {
      peticion = await this.deasy.resolverLlave(mensaje.llave);
    } catch {
      // Que el backend no conteste NO es culpa del usuario y NO es un rechazo: es un fallo
      // nuestro. Se distingue para que el canal pueda decir «vuelve a intentarlo» en vez de
      // «tus datos no son correctos», que sería mentira.
      return { verificado: false, motivo: MOTIVOS.BACKEND_CAIDO };
    }

    if (!peticion?.valida) {
      return {
        verificado: false,
        motivo: MOTIVO_POR_ESTADO[peticion?.estado] ?? MOTIVOS.LLAVE_DESCONOCIDA,
      };
    }

    // El canal no pudo probar el número todavía. NO es un rechazo: Telegram llega aquí en
    // su primer paso, y lo que toca es pedirle el contacto. Por eso se devuelve el número
    // esperado: el canal lo necesita para comparar cuando lo tenga.
    if (!mensaje.tieneNumero) {
      return { verificado: false, motivo: MOTIVOS.FALTA_NUMERO, numeroEsperado: peticion.numero };
    }

    if (!this.constructor.mismoNumero(mensaje.numeroProbado, peticion.numero)) {
      return { verificado: false, motivo: MOTIVOS.NUMERO_DISTINTO };
    }

    // Se resolvió hace un instante, pero entre aquel instante y éste la llave puede haber dejado de
    // valer: dos mensajes casi a la vez, o el usuario pulsando dos veces. Quien manda es la
    // confirmación, no la resolución — y su rechazo se traduce al MISMO motivo que si hubiera
    // llegado ya usada, porque para el usuario es exactamente lo mismo.
    const confirmacion = await this.deasy.confirmarVerificacion({
      llave: mensaje.llave,
      numero: peticion.numero,
      canal: mensaje.canal,
    });

    if (confirmacion?.confirmado === false) {
      return {
        verificado: false,
        motivo: MOTIVO_POR_ESTADO[confirmacion.estado] ?? MOTIVOS.LLAVE_CONSUMIDA,
      };
    }

    return { verificado: true };
  }

  /**
   * Dos números son el mismo si lo son marcando.
   *
   * `+593 99 111 2233`, `593991112233` y `0991112233` son el mismo teléfono escrito por
   * tres sitios distintos: el usuario lo teclea en el registro, Telegram lo devuelve con
   * prefijo internacional y un SMS lo trae en otro formato. Comparar las cadenas tal cual
   * rechazaría verificaciones legítimas — y el usuario no tendría forma de entender por qué.
   *
   * Se comparan sólo los dígitos, y por la DERECHA: es lo que sobrevive a que uno lleve
   * prefijo de país y el otro un cero nacional.
   */
  static mismoNumero(a, b) {
    const soloDigitos = (n) => String(n ?? "").replace(/\D/g, "");
    const x = soloDigitos(a);
    const y = soloDigitos(b);
    if (!x || !y) return false;
    // Ocho dígitos es más que cualquier número nacional sin prefijo, y menos que el más
    // corto del mundo entero: comparar menos abriría la puerta a coincidencias por azar.
    const largo = Math.min(x.length, y.length, 8);
    return x.slice(-largo) === y.slice(-largo);
  }
}
