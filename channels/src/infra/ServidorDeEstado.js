import http from "node:http";

/**
 * El único puerto que abre este servicio, y sólo para que el backend pregunte cómo están los canales.
 *
 * ── POR QUÉ SE PREGUNTA EN VEZ DE AVISAR ────────────────────────────────────────────────────────
 *
 * La alternativa era que `channels` mantuviera un socket contra el backend y le notificara cada
 * cambio. **Se descartó, y por un motivo que no es de gusto: quien puede estar muerto no puede ser
 * el responsable de avisar de que lo está.** El 2026-08-31 este servicio murió de un `SIGKILL` y
 * estuvo TRECE HORAS parado; un proceso muerto no manda eventos, y desde el backend el silencio es
 * indistinguible de «no ha cambiado nada». Preguntando, **la ausencia de respuesta ES la respuesta**.
 *
 * ── SIN PUERTO PUBLICADO ────────────────────────────────────────────────────────────────────────
 *
 * Sólo la red interna de compose, como el firmador. Al navegador no se le ha perdido nada aquí: lo
 * que ve una persona pasa por el backend, que es quien sabe de sesiones y de permisos.
 */
export default class ServidorDeEstado {
  /**
   * @param {object[]} canales  los canales montados
   * @param {string} clave      la MISMA `INTERNAL_SERVICE_KEY` que este servicio usa para hablar con
   *                            el backend. Es la misma relación de confianza en el otro sentido: una
   *                            segunda clave para el mismo par de servicios sería más superficie sin
   *                            más seguridad.
   * @param {number} puerto
   */
  constructor({ canales, clave, puerto = 3050, arrancado = new Date().toISOString() }) {
    this.canales = canales;
    this.clave = clave;
    this.puerto = puerto;
    this.arrancado = arrancado;
    this.servidor = null;
    // La comprobación ACTIVA se cachea: la pantalla sondea cada 5 s, y preguntarle a la plataforma
    // doce veces por minuto es maltratarla --Telegram tiene sus límites, y `getState()` de WhatsApp
    // cruza Puppeteer--. El estado pasivo se sirve siempre fresco; el activo, cada 30 s.
    this.cacheActiva = new Map();
    this.segundosDeCache = 30;
  }

  async iniciar() {
    this.servidor = http.createServer((peticion, respuesta) => {
      this.atender(peticion, respuesta).catch((error) => {
        this.responder(respuesta, 500, { error: error.message });
      });
    });
    await new Promise((listo) => this.servidor.listen(this.puerto, listo));
    console.log(`[channels] estado: escuchando en :${this.puerto} (sin publicar)`);
  }

  async detener() {
    await new Promise((listo) => this.servidor?.close(listo) ?? listo());
  }

  async atender(peticion, respuesta) {
    // ⚠️ 404 Y NO 401 cuando la clave falla, igual que el guard del backend: un 401 confirmaría que
    // aquí hay algo, y quien no tiene la clave no tiene por qué saberlo.
    if (peticion.headers["x-clave-servicio"] !== this.clave) {
      return this.responder(respuesta, 404, { error: "no encontrado" });
    }

    const ruta = new URL(peticion.url, "http://interno").pathname;

    if (ruta === "/estado") {
      return this.responder(respuesta, 200, {
        servicio: { arrancado: this.arrancado },
        canales: await this.estadoDeTodos(),
      });
    }

    if (ruta === "/qr") {
      const canal = this.canales.find((c) => c.nombre === "whatsapp");
      if (!canal) return this.responder(respuesta, 404, { error: "no hay canal de whatsapp" });
      const codigo = canal.codigoDeVinculacion?.() ?? null;
      // ⚠️ 409 Y NO 404: «no hay QR que dar» no es lo mismo que «no existe esta ruta», y el que pide
      // necesita saber la diferencia para enseñar el mensaje correcto.
      if (!codigo) return this.responder(respuesta, 409, { error: "el canal no necesita vincularse" });
      return this.responder(respuesta, 200, codigo);
    }

    return this.responder(respuesta, 404, { error: "no encontrado" });
  }

  async estadoDeTodos() {
    return Promise.all(this.canales.map((canal) => this.estadoDe(canal)));
  }

  /**
   * El estado del canal, con la plataforma ya consultada.
   *
   * ⚠️ **EL ORDEN IMPORTA Y ME LO SALTÉ LA PRIMERA VEZ.** Al preguntar DESPUÉS de leer el estado, el
   * canal calculaba su veredicto sin saber lo que la plataforma acababa de decir: salía
   * `{salud: "caido", evidencia: "afirmacion", estadoPlataforma: "CONNECTED"}` — tres campos que se
   * contradicen entre sí, y con la afirmación ganándole a la prueba, que es exactamente lo contrario
   * de lo que este diseño existe para hacer.
   *
   * Se pregunta PRIMERO, el canal lo guarda, y entonces se le pide su veredicto.
   */
  async estadoDe(canal) {
    // Preguntar PRIMERO --el canal se guarda lo que le digan-- y leer después. Lo que devuelva la
    // comprobación se superpone al final: es la única vía por la que un fallo de la propia
    // comprobación llega a verse, y no requiere que el servidor escriba dentro del canal.
    const confirmacion = await this.confirmarConLaPlataforma(canal);
    return { nombre: canal.nombre, ...(await canal.estado()), ...confirmacion };
  }

  /**
   * La comprobación ACTIVA: lo que distingue «arrancó» de «funciona».
   *
   * Si el canal no sabe hacerla, no se inventa nada: se devuelve lo que hay. Es preferible un estado
   * que diga `afirmacion` a uno que finja una prueba que no tiene.
   */
  async confirmarConLaPlataforma(canal) {
    if (typeof canal.comprobarPlataforma !== "function") return {};

    const guardado = this.cacheActiva.get(canal.nombre);
    const ahora = Date.now();
    if (guardado && ahora - guardado.en < this.segundosDeCache * 1000) return guardado.valor;

    let valor;
    try {
      valor = (await canal.comprobarPlataforma()) ?? {};
    } catch (error) {
      // El fallo de la comprobación ES información, no un motivo para no contestar.
      valor = { ultimoError: error.message };
    }
    this.cacheActiva.set(canal.nombre, { en: ahora, valor });
    return valor;
  }

  responder(respuesta, codigo, cuerpo) {
    const texto = JSON.stringify(cuerpo);
    respuesta.writeHead(codigo, { "content-type": "application/json; charset=utf-8" });
    respuesta.end(texto);
  }
}
