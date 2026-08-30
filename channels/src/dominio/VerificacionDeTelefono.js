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
  // Lo dicta el BACKEND desde C2b. Antes se decidía aquí comparando los últimos ocho dígitos, sin
  // saber el país: `+51 99 111 2233` valía por `+593 99 111 2233`.
  numero_distinto: MOTIVOS.NUMERO_DISTINTO,
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
   * @returns {Promise<{verificado: boolean, motivo?: string}>}
   */
  async procesar(mensaje) {
    if (!mensaje?.tieneLlave) {
      return { verificado: false, motivo: MOTIVOS.SIN_LLAVE };
    }

    // Se SONDEA antes de nada, y el orden importa: Telegram llega aquí en su primer paso sin
    // número, y lo siguiente que hace es pedirle el contacto al usuario. Pedírselo con una llave
    // muerta es hacerle compartir sus datos para nada.
    let sonda;
    try {
      sonda = await this.deasy.estadoDeLlave(mensaje.llave);
    } catch {
      // Que el backend no conteste NO es culpa del usuario y NO es un rechazo: es un fallo
      // nuestro. Se distingue para que el canal pueda decir «vuelve a intentarlo» en vez de
      // «tus datos no son correctos», que sería mentira.
      return { verificado: false, motivo: MOTIVOS.BACKEND_CAIDO };
    }

    if (!sonda?.valida) {
      return {
        verificado: false,
        motivo: MOTIVO_POR_ESTADO[sonda?.estado] ?? MOTIVOS.LLAVE_DESCONOCIDA,
      };
    }

    // El canal no pudo probar el número todavía. NO es un rechazo: es el primer paso de Telegram, y
    // lo que toca es pedir el contacto.
    //
    // ⚠️ Aquí se devolvía además `numeroEsperado`, «porque el canal lo necesita para comparar
    // después». No lo necesitaba —ningún canal lo leía— y comparar ya no es cosa suya: se retiró en
    // C2b junto con el resto de la comparación local.
    if (!mensaje.tieneNumero) {
      return { verificado: false, motivo: MOTIVOS.FALTA_NUMERO };
    }

    // Y aquí se le cuenta al backend LO QUE SE OBSERVÓ, no una conclusión: este número mandó esta
    // llave por este canal. Si el número es el que había que verificar lo decide él, que es el
    // único que sabe de qué país es el número guardado.
    let confirmacion;
    try {
      confirmacion = await this.deasy.confirmarVerificacion({
        llave: mensaje.llave,
        numero: mensaje.numeroProbado,
        canal: mensaje.canal,
      });
    } catch {
      return { verificado: false, motivo: MOTIVOS.BACKEND_CAIDO };
    }

    if (!confirmacion?.confirmado) {
      return {
        verificado: false,
        motivo: MOTIVO_POR_ESTADO[confirmacion?.estado] ?? MOTIVOS.LLAVE_CONSUMIDA,
      };
    }

    return { verificado: true };
  }
}
