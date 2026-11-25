import BitacoraDeCanales from "./BitacoraDeCanales.js";
import ClienteDeChannels from "./ClienteDeChannels.js";

/**
 * Mira cómo están los canales aunque no haya nadie mirando.
 *
 * ── QUÉ CIERRA, Y QUÉ NO CERRABA LA PANTALLA ────────────────────────────────────────────────────
 *
 * `C7A` arregló que la pantalla mintiera. **No arregló que nadie mire.** El 2026-08-31 el servicio
 * estuvo TRECE HORAS parado: la pantalla habría enseñado el fallo perfectamente… a quien la hubiera
 * abierto, y nadie la abrió porque nadie sospechaba.
 *
 * ── POR QUÉ PREGUNTA EN VEZ DE ESCUCHAR ─────────────────────────────────────────────────────────
 *
 * Por lo mismo que la pantalla: **quien puede estar muerto no puede avisar de que lo está.** Un
 * `channels` caído no manda eventos, y desde aquí el silencio sería indistinguible de «nada ha
 * cambiado». Preguntando, **no obtener respuesta ES la respuesta**.
 *
 * ⚠️ **VIVE EN EL PROCESO DEL BACKEND, que está fijado a UNA instancia** (`replicas: 1` en el
 * compose, por el tiempo real). Con dos instancias las dos vigilarían y **cada aviso llegaría por
 * duplicado**. Si algún día se escala, esto necesita una elección de líder o mudarse a una tarea
 * programada — no basta con quitar el `replicas: 1`.
 */
export default class VigilanteDeCanales {
  /**
   * @param {object} avisador  quien sabe avisar. Se inyecta para poder probar sin correo ni sockets.
   */
  constructor({
    cliente = new ClienteDeChannels(),
    bitacora = new BitacoraDeCanales(),
    avisador = null,
    cadaMs = 60_000,
    umbralMs = 5 * 60_000,
    ahora = () => Date.now(),
  } = {}) {
    this.cliente = cliente;
    this.bitacora = bitacora;
    this.avisador = avisador;
    this.cadaMs = cadaMs;
    // ⚠️ NO SE AVISA DE UN CANAL CAÍDO: SE AVISA DE UNO QUE **LLEVA** CAÍDO. Sin este umbral, cada
    // despliegue mandaría una alerta --al arrancar todo parece caído unos segundos-- y un vigilante
    // que avisa de más deja de leerse, con lo que el aviso que importaba se pierde entre los que no.
    this.umbralMs = umbralMs;
    this.ahora = ahora;
    this.reloj = null;
  }

  iniciar() {
    if (this.reloj) return;
    this.reloj = setInterval(() => {
      this.unaVuelta().catch((error) => {
        console.error(`[vigilante] la vuelta falló: ${error.message}`);
      });
    }, this.cadaMs);
    // Que no impida al proceso terminar: es una tarea de fondo, no una razón para seguir vivo.
    this.reloj.unref?.();
    console.log(`[vigilante] canales: comprobando cada ${this.cadaMs / 1000}s`);
  }

  detener() {
    clearInterval(this.reloj);
    this.reloj = null;
  }

  /** Una comprobación completa. Es la unidad que se prueba: sin temporizador y sin red. */
  async unaVuelta() {
    const respuesta = await this.cliente.estado();
    const observado = this.aEstados(respuesta);
    const abiertos = await this.bitacora.abiertos();

    for (const [canal, estado] of observado) {
      const tramo = abiertos.get(canal);
      // Sólo se anota si CAMBIÓ. Un estado igual al anterior no es noticia.
      if (!tramo || tramo.salud !== estado.salud) {
        await this.bitacora.cambio(canal, estado);
        continue;
      }
      await this.quizaAvisar(canal, estado, tramo);
    }
  }

  /**
   * Lo que devuelve `channels`, traducido a lo que se vigila.
   *
   * ⚠️ **«servicio» es un canal más aquí, y es el que importa.** Si `channels` no contesta, los
   * canales no aparecen en la respuesta — y sin esta fila, un servicio muerto se vería como «no ha
   * cambiado nada», que es exactamente el silencio de las trece horas.
   */
  aEstados(respuesta) {
    if (!respuesta?.alcanzable) {
      return new Map([["servicio", { salud: "caido", detalle: respuesta?.error ?? "no contesta" }]]);
    }
    const estados = new Map([["servicio", { salud: "sano", evidencia: "plataforma", detalle: "responde" }]]);
    for (const canal of respuesta.canales ?? []) {
      estados.set(canal.nombre, {
        salud: canal.salud,
        evidencia: canal.evidencia ?? null,
        detalle: canal.detalle ?? null,
      });
    }
    return estados;
  }

  /**
   * ⚠️ **EL AVISO VA EN LA TRANSICIÓN, NO EN EL ESTADO.** Sin `avisado_at`, un canal caído mandaría
   * un correo por vuelta: sesenta en una hora. Es el mismo patrón que ya usa `CanalTelegram` con su
   * `ultimoError` --avisar la primera vez y al recuperarse-- y funciona por la misma razón.
   */
  async quizaAvisar(canal, estado, tramo) {
    if (tramo.avisado_at) return;
    if (VigilanteDeCanales.ESTADOS_SANOS.includes(estado.salud)) return;

    const llevaMs = this.ahora() - new Date(tramo.desde).getTime();
    if (llevaMs < this.umbralMs) return;

    await this.avisador?.canalCaido({
      canal,
      salud: estado.salud,
      detalle: estado.detalle,
      minutos: Math.round(llevaMs / 60_000),
    });
    await this.bitacora.marcarAvisado(tramo.id);
  }

  /** `sin_vincular` NO entra: es una tarea pendiente de una persona, y ésa sí merece un aviso. */
  static ESTADOS_SANOS = ["sano"];
}
