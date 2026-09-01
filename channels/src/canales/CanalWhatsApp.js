import Canal from "../dominio/Canal.js";
import MensajeEntrante from "../dominio/MensajeEntrante.js";
import { llaveDe } from "../dominio/llave.js";

/**
 * WhatsApp.
 *
 * ── POR QUÉ ES MÁS SIMPLE QUE TELEGRAM ──────────────────────────────────────────────────────────
 *
 * Aquí el número **viene con el mensaje**: `msg.from` es el identificador de quien escribe, y lo
 * pone el transporte. No hay que pedirlo con un botón ni recordar a medias quién está verificando
 * qué: un mensaje trae la llave Y el número, y con eso el canal ya puede afirmar `numeroProbado`.
 *
 * Por eso este canal cabe en la mitad de líneas que el de Telegram, y no porque esté menos hecho.
 *
 * ── LO QUE NO HACE, Y ES DELIBERADO ─────────────────────────────────────────────────────────────
 *
 * **No envía nada.** El `WhatsAppBot` que vivía en el backend mandaba códigos y bienvenidas desde el
 * número de la institución, con seis rutas SIN AUTENTICACIÓN --entre ellas un `send-message` que
 * dejaba a cualquiera escribir en su nombre--. Ese modelo se retiró entero: aquí escribe el usuario,
 * y por eso no cuesta nada y no hay ataque de coste.
 *
 * ⚠️ **LA LIBRERÍA NO ES OFICIAL.** Conduce un WhatsApp Web real, y WhatsApp no lo autoriza: el
 * número puede acabar bloqueado. Con un número dedicado que SÓLO RECIBE el riesgo es bajo --lo que
 * dispara los bloqueos es el envío masivo-- pero no es cero. Es la razón por la que Telegram va
 * primero en el selector.
 */
export default class CanalWhatsApp extends Canal {
  /**
   * @param {object} cliente  el cliente de `whatsapp-web.js`, inyectado para poder probar sin red
   * @param {Function} [dibujarQR]  cómo se enseña el QR de vinculación
   */
  constructor({ cliente, dibujarQR = () => {} } = {}) {
    super();
    if (!cliente) throw new Error("CanalWhatsApp necesita un cliente de WhatsApp.");
    this.cliente = cliente;
    this.dibujarQR = dibujarQR;
    this.manejador = null;
    this.conectado = false;
    this.qr = null;
    this.detalle = "sin iniciar";
    this.iniciado = false;
  }

  get nombre() {
    return "whatsapp";
  }

  /** Remitentes que NO son una persona y que descartar es lo correcto: no hay nada que avisar. */
  static SUFIJOS_ESPERADOS = ["@g.us", "@broadcast", "@newsletter"];

  /** Remitentes que SÍ son una persona. `@lid` exige resolverse antes de creerle el número. */
  static SUFIJOS_DE_PERSONA = ["@c.us", "@lid"];

  /** El sufijo, para poder decir QUÉ llegó sin registrar el identificador de nadie. */
  static sufijoDe(de) {
    const arroba = de.lastIndexOf("@");
    return arroba === -1 ? "sin sufijo" : de.slice(arroba);
  }

  alRecibir(manejador) {
    this.manejador = manejador;
  }

  /** Idempotente, como manda el contrato: llamarlo dos veces no abre dos sesiones. */
  async iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;

    // ⚠️ EL QR SE ENSEÑA EN EL REGISTRO, y hace falta: vincular la sesión exige escanearlo UNA vez
    // desde el teléfono dedicado, y sin pantalla de administración (C7) no habría dónde verlo. Con
    // esto el canal se puede vincular hoy; C7 lo hará civilizado, no posible.
    this.cliente.on("qr", (qr) => {
      this.qr = qr;
      this.conectado = false;
      this.detalle = "esperando que alguien escanee el QR";
      console.log(`[channels] ${this.nombre}: hay que vincular la sesión — escanea este QR:`);
      this.dibujarQR(qr);
    });

    // ⚠️ ENTRE `initialize()` Y `ready` PUEDEN PASAR MINUTOS, y sin esto el canal calla durante todos
    // ellos: desde fuera «cargando la sesión» y «colgado para siempre» se ven EXACTAMENTE igual. El
    // 2026-09-01 estuvo ocho minutos sin llegar a `ready` y no había forma de saber si avanzaba.
    this.cliente.on("authenticated", () => {
      this.detalle = "autenticado; sincronizando";
      console.log(`[channels] ${this.nombre}: autenticado, sincronizando la sesión…`);
    });

    this.cliente.on("loading_screen", (porcentaje) => {
      this.detalle = `sincronizando (${porcentaje}%)`;
      console.log(`[channels] ${this.nombre}: sincronizando ${porcentaje}%`);
    });

    this.cliente.on("ready", () => {
      this.qr = null;
      this.conectado = true;
      this.detalle = "vinculado";
      console.log(`[channels] ${this.nombre}: sesión lista`);
    });

    // ⚠️ SE AVISA AL PERDER LA SESIÓN. Un canal que se desvincula y no lo dice es el fallo que ya
    // costó seis horas de silencio con Telegram: desde fuera parece sano y nadie recibe nada.
    this.cliente.on("disconnected", (motivo) => {
      this.conectado = false;
      this.detalle = `desvinculado: ${motivo}`;
      console.error(`[channels] ${this.nombre}: sesión perdida — ${motivo}. Hay que volver a vincular.`);
    });

    this.cliente.on("auth_failure", (motivo) => {
      this.conectado = false;
      this.detalle = `no se pudo autenticar: ${motivo}`;
      console.error(`[channels] ${this.nombre}: fallo de autenticación — ${motivo}`);
    });

    this.cliente.on("message", (mensaje) => {
      this.procesar(mensaje).catch((error) => {
        console.error(`[channels] ${this.nombre}: no se pudo tratar un mensaje — ${error.message}`);
      });
    });

    await this.cliente.initialize();
  }

  async detener() {
    this.iniciado = false;
    this.conectado = false;
    await this.cliente.destroy?.().catch?.(() => {});
  }

  async estado() {
    return {
      conectado: this.conectado,
      // A diferencia de Telegram, aquí SÍ hay algo que vincular: la sesión cuelga de un teléfono.
      necesitaVinculacion: Boolean(this.qr),
      qr: this.qr,
      detalle: this.detalle,
    };
  }

  /** Trata UN mensaje. Es la unidad que se prueba: sin red y sin navegador. */
  async procesar(mensaje) {
    const de = String(mensaje?.from ?? "");

    // Lo nuestro no cuenta, y no hace falta decirlo: la respuesta que enviamos vuelve por aquí.
    if (mensaje?.fromMe) return;

    // ⚠️ SÓLO CONVERSACIONES PRIVADAS. En un grupo, `from` es el GRUPO y no la persona --quien
    // escribió está en `author`--, así que dar el número por probado ahí sería afirmar algo falso.
    // Y una llave pegada en un grupo la ve todo el mundo: aceptarla dejaría que cualquiera del grupo
    // se apropiara de una verificación ajena.
    // Lo que no es una persona --grupos, listas, canales-- se descarta y no hay nada que contar.
    if (CanalWhatsApp.SUFIJOS_ESPERADOS.some((sufijo) => de.endsWith(sufijo))) return;

    if (!CanalWhatsApp.SUFIJOS_DE_PERSONA.some((sufijo) => de.endsWith(sufijo))) {
      // ⚠️ DESCARTAR EN SILENCIO ERA EL FALLO: un remitente de una clase que no esperamos se veía
      // desde fuera igual que un canal muerto --llega el mensaje, no pasa nada, nadie lo dice--.
      console.warn(
        `[channels] ${this.nombre}: llegó un mensaje de un remitente que no sé tratar (${CanalWhatsApp.sufijoDe(de)}). Se descarta.`
      );
      return;
    }

    const llave = llaveDe(mensaje?.body);
    if (!llave) {
      // Se registra SIN EL TEXTO --es de una persona-- pero se registra: saber que el mensaje LLEGÓ
      // es justo lo que no se podía saber, y separa «el canal no recibe» de «el texto no valía».
      console.log(
        `[channels] ${this.nombre}: mensaje recibido sin una llave dentro (${String(mensaje?.body ?? "").length} caracteres).`
      );
      return;
    }

    // ⚠️ EL NÚMERO SE RESUELVE, NO SE DEDUCE DEL IDENTIFICADOR. Ver `resolverNumero`.
    const numero = await this.resolverNumero(de);
    if (!numero) {
      console.warn(
        `[channels] ${this.nombre}: no pude resolver a qué teléfono corresponde un ${CanalWhatsApp.sufijoDe(de)}. NO se verifica nada.`
      );
      await this.cliente.sendMessage(de, CanalWhatsApp.texto({ motivo: "numero_irresoluble" }));
      return;
    }

    const resultado = await this.manejador(
      new MensajeEntrante({
        canal: this.nombre,
        llave,
        // AQUÍ el canal AFIRMA que el número es de quien escribe, y puede hacerlo porque lo pone el
        // transporte: en WhatsApp el identificador de la conversación ES el teléfono.
        numeroProbado: numero,
        contexto: { de },
      })
    );

    await this.cliente.sendMessage(de, this.constructor.texto(resultado));
  }

  /**
   * A qué teléfono corresponde quien escribe.
   *
   * ⚠️ **NO SE PUEDE DEDUCIR DEL IDENTIFICADOR, y ahí estaba el error.** Con `@c.us` la parte de
   * delante ES el teléfono. Con `@lid` --el identificador OPACO al que WhatsApp está migrando y con
   * el que llegan hoy los mensajes-- no es nada: está diseñado precisamente para no serlo. Tomarlo
   * como número sería AFIRMAR UNO QUE NADIE HA PROBADO, que es lo contrario de para lo que existe
   * este canal.
   *
   * Así que se le PREGUNTA a WhatsApp: `getContactLidAndPhone` devuelve el par y consulta al
   * servidor si el mapeo no está en caché. Y si no lo devuelve, **se rechaza**: quedarse sin saber es
   * un resultado legítimo; inventárselo, no.
   *
   * Medido el 2026-09-01: cinco mensajes reales, los cinco con `@lid`.
   *
   * @returns {Promise<string|null>}  los dígitos del teléfono, o `null` si no se puede afirmar
   */
  async resolverNumero(de) {
    if (de.endsWith("@c.us")) return de.replace("@c.us", "");

    const [par] = (await this.cliente.getContactLidAndPhone([de])) ?? [];
    const pn = String(par?.pn ?? "");
    // Se exige que lo devuelto SEA un teléfono: si viniera otro `@lid`, aceptarlo sería volver al
    // fallo por la puerta de atrás.
    if (!pn.endsWith("@c.us")) return null;

    const digitos = pn.replace("@c.us", "");
    return /^\d+$/.test(digitos) ? digitos : null;
  }

  /**
   * Qué se le contesta.
   *
   * ⚠️ Esto SÍ es un envío, y es la única excepción: es una respuesta a quien acaba de escribirnos,
   * en su propia conversación. No es escribirle a nadie por iniciativa nuestra --que es lo que se
   * retiró-- y sin ella la persona no sabe si funcionó.
   */
  static texto(resultado) {
    if (resultado?.verificado) return "✅ Listo. Tu teléfono queda verificado en Deasy.";
    const porMotivo = {
      llave_desconocida: "Ese código no es válido. Pide uno nuevo en Deasy.",
      llave_caducada: "El código caducó (duran 15 minutos). Pide otro en Deasy.",
      llave_consumida: "Ese código ya se usó. Pide uno nuevo en Deasy.",
      numero_distinto:
        "Este número no es el que registraste en Deasy. Comprueba cuál pusiste, incluido el país.",
      numero_irresoluble:
        "No hemos podido saber desde qué número escribes. Prueba con Telegram, o escríbenos desde el mismo número que registraste.",
      backend_caido: "Ahora mismo no podemos comprobarlo. No es culpa tuya: inténtalo en unos minutos.",
    };
    return porMotivo[resultado?.motivo] ?? porMotivo.backend_caido;
  }
}
