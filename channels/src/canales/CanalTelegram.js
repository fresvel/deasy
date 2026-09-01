import Canal from "../dominio/Canal.js";
import MensajeEntrante from "../dominio/MensajeEntrante.js";
import ClienteDeTelegram from "../infra/ClienteDeTelegram.js";
import { MOTIVOS } from "../dominio/VerificacionDeTelefono.js";
import { llaveDe } from "../dominio/llave.js";

/**
 * Lo que se le dice al usuario en cada desenlace.
 *
 * Están juntos y en un solo sitio porque son la mitad del canal que la gente ve. Y son distintos
 * entre sí a propósito: «caducó» y «ya la usaste» le dicen que repita SIN cambiar nada, mientras
 * que «este enlace no vale» le dice que revise de dónde salió. Colapsarlos en un «error» ahorra
 * seis líneas y le cuesta al usuario no saber qué hacer.
 */
export const TEXTOS = Object.freeze({
  [MOTIVOS.LLAVE_DESCONOCIDA]:
    "Este enlace no es válido. Vuelve a Deasy y pide uno nuevo desde tu teléfono.",
  [MOTIVOS.LLAVE_CADUCADA]:
    "El enlace caducó (duran 15 minutos). Pide otro en Deasy y vuelve a entrar aquí.",
  [MOTIVOS.LLAVE_CONSUMIDA]:
    "Ese enlace ya se usó. Si necesitas verificar otro número, pide uno nuevo en Deasy.",
  [MOTIVOS.NUMERO_DISTINTO]:
    "El número que compartiste no es el que registraste en Deasy. Comprueba cuál pusiste, " +
    "incluido el país, y vuelve a intentarlo.",
  [MOTIVOS.BACKEND_CAIDO]:
    "Ahora mismo no podemos comprobarlo. No es culpa tuya: inténtalo de nuevo en unos minutos.",
  // ⚠️ ESTE CASO PASA DE VERDAD, y no es que el usuario se equivoque. Al abrir el enlace desde un
  // ORDENADOR, el navegador se lo pasa a Telegram Desktop y la aplicación puede quedarse con la
  // conversación pero PERDER el `?start=<llave>` por el camino. La persona acaba aquí habiendo hecho
  // todo bien, mirando un chat vacío.
  //
  // Por eso el mensaje no la culpa ni repite «usa el enlace»: le da la salida que funciona --el QR,
  // que es justo para eso-- y le dice que puede pegar el código.
  SIN_LLAVE:
    "Casi. Me falta saber qué teléfono estás verificando.\n\n" +
    "· Si abriste el enlace desde el ordenador, es posible que Telegram no me haya pasado el " +
    "código. Vuelve a Deasy y escanea el QR con la cámara del móvil.\n" +
    "· O pega aquí el código que aparece en la pantalla de Deasy.",
  // ⚠️ EL BOTÓN NO SIEMPRE SE VE, y hay que decir DÓNDE está. Comprobado con un iPhone real el
  // 2026-08-30: el teclado del bot llegó bien —Telegram aceptó tres variantes distintas— pero no se
  // pintó solo; estaba plegado tras el icono de cuadrícula del campo de escribir. La persona hizo
  // todo bien y se quedó atascada sin saber por qué, hasta que se le dijo dónde mirar.
  //
  // Un texto que dice «pulsa el botón de abajo» cuando abajo no hay ningún botón es un defecto del
  // canal aunque el código sea correcto. Por eso la instrucción lleva el icono y su sitio.
  //
  // ⚠️ Y NO se ofrece «adjunta tu contacto con el clip» como alternativa: se probó y NO SIRVE —
  // esa opción abre la agenda, y uno no está en su propia agenda. Mandar ahí a la gente es peor
  // que no decir nada.
  PIDE_CONTACTO:
    "Falta un paso: Telegram no nos da tu teléfono, tienes que compartirlo tú.\n\n" +
    "Pulsa el botón «Compartir mi número».\n\n" +
    "¿No lo ves? Está plegado: toca el icono de cuadrícula (▦) que hay a la derecha del campo " +
    "donde se escribe, entre el clip y los emojis, y aparecerá.",
  CONTACTO_AJENO:
    "Ese contacto es de otra persona. Tiene que ser el TUYO, con el botón «Compartir mi número»: " +
    "una tarjeta reenviada no demuestra que el número sea tuyo.",
  SIN_PASO_PREVIO:
    "No sé qué número estás verificando. Empieza por el enlace que te da Deasy y vuelve a " +
    "compartir tu contacto.",
  VERIFICADO: "✅ Listo. Tu teléfono queda verificado en Deasy. Ya puedes cerrar este chat.",
});

/**
 * Telegram, con el baile de dos pasos resuelto POR DENTRO.
 *
 * ── POR QUÉ SON DOS PASOS ───────────────────────────────────────────────────────────────────────
 *
 * El bot NO recibe el número. Cuando alguien abre `t.me/<bot>?start=<llave>`, lo que llega es
 * `/start <llave>` y un identificador de Telegram — nunca un teléfono. Hay que PEDIRLO con un
 * botón, y el usuario tiene que entregarlo a propósito.
 *
 * De ahí que el canal recuerde qué conversación está verificando qué llave, y que avise a la
 * política UNA sola vez con el mensaje completo. El contrato de `Canal` lo dice: «la política nunca
 * ve medio mensaje».
 *
 * ⚠️ **LA COMPROBACIÓN QUE SOSTIENE TODO ESTO**: el contacto que llega trae su propio `user_id`, y
 * hay que exigir que sea el de QUIEN ESCRIBE. Sin eso, cualquiera reenvía la tarjeta de contacto de
 * otra persona y verifica un número que no es suyo — y el resto del sistema no tendría cómo notarlo,
 * porque para el backend ese número llegaría «probado por el transporte».
 *
 * ⚠️ **La memoria es del proceso y se pierde al reiniciar.** Está decidido así en el documento de
 * diseño: quien estuviera a medias vuelve a abrir el enlace, y su llave sigue viva quince minutos.
 * Persistirla obligaría a una tabla y a limpiarla, para ahorrar un caso que dura segundos.
 */
export default class CanalTelegram extends Canal {
  constructor({ telegram, textos = TEXTOS } = {}) {
    super();
    if (!telegram) throw new Error("CanalTelegram necesita un cliente de Telegram.");
    this.telegram = telegram;
    this.textos = textos;
    /** chat -> llave que está verificando. Ver el aviso de arriba sobre reiniciar. */
    this.esperando = new Map();
    this.manejador = null;
    this.corriendo = false;
    this.offset = undefined;
    this.ultimoError = null;
    this.yo = null;
  }

  get nombre() {
    return "telegram";
  }

  alRecibir(manejador) {
    this.manejador = manejador;
  }

  /** Idempotente, como manda el contrato: llamarlo dos veces no abre dos sondeos. */
  async iniciar() {
    if (this.corriendo) return;
    this.yo = await this.telegram.quienSoy();
    // Sin esto, un webhook olvidado hace que `getUpdates` dé 409 para siempre.
    await this.telegram.olvidarWebhook();
    this.corriendo = true;
    this.bucle = this.sondear();
  }

  async detener() {
    this.corriendo = false;
    await this.bucle?.catch(() => {});
    this.bucle = null;
  }

  async estado() {
    return {
      conectado: this.corriendo,
      // Telegram no se vincula a un teléfono: el bot ES la cuenta. Esto sólo lo necesita WhatsApp.
      necesitaVinculacion: false,
      qr: null,
      detalle: this.yo ? `@${this.yo.username}` : (this.ultimoError ?? "sin iniciar"),
    };
  }

  /**
   * El sondeo. Los fallos NO lo paran: si Telegram o la red se caen un rato, el canal tiene que
   * seguir vivo para cuando vuelvan. Se anota el último error para que la pantalla de
   * administración lo enseñe, y se espera un poco antes de reintentar para no martillear.
   */
  async sondear(esperar = (ms) => new Promise((r) => setTimeout(r, ms))) {
    while (this.corriendo) {
      try {
        const lote = await this.telegram.actualizaciones(this.offset);
        let falloAlguno = false;
        for (const actualizacion of lote ?? []) {
          // Se avanza el offset ANTES de tratar el mensaje: un mensaje que hace fallar el
          // tratamiento no debe volver una y otra vez y bloquear a todos los demás detrás.
          this.offset = actualizacion.update_id + 1;
          await this.procesar(actualizacion).catch((error) => {
            this.ultimoError = error.message;
            falloAlguno = true;
          });
        }
        // ⚠️ SOLO SE LIMPIA SI NO FALLÓ NADA. Antes se limpiaba siempre, justo después de anotarlo,
        // así que el error de un mensaje se borraba en la misma vuelta y la pantalla de
        // administración no llegaba a verlo NUNCA.
        if (!falloAlguno) {
          // Y si veníamos de un fallo, se dice que se acabó: sin esto, quien vio el aviso no sabe
          // nunca si el canal volvió.
          if (this.ultimoError) {
            console.log(`[channels] ${this.nombre}: el sondeo vuelve a funcionar`);
          }
          this.ultimoError = null;
        }
      } catch (error) {
        // ⚠️ SE AVISA LA PRIMERA VEZ, Y AL VOLVER. No en cada reintento --serian veinte lineas por
        // minuto y nadie las leeria--, pero SI una vez: este canal estuvo SEIS HORAS sin poder
        // resolver `api.telegram.org` y su registro sólo tenia la linea de arranque, así que desde
        // fuera era indistinguible de uno sano. El dueño lo notó porque el bot no le contestaba.
        //
        // Un servicio que falla en silencio es peor que uno que se cae: al menos el que se cae se ve.
        if (!this.ultimoError) {
          console.error(`[channels] ${this.nombre}: el sondeo falla — ${error.message}`);
        }
        this.ultimoError = error.message;
        await esperar(3000);
      }
    }
  }

  /** Trata UNA actualización. Es la unidad que se prueba: sin red, sin bucle y sin esperas. */
  async procesar(actualizacion) {
    const mensaje = actualizacion?.message;
    if (!mensaje?.chat?.id) return;

    if (mensaje.contact) return this.recibirContacto(mensaje);

    const llave = llaveDe(mensaje.text);
    if (!llave) {
      return this.telegram.escribir(mensaje.chat.id, this.textos.SIN_LLAVE);
    }
    return this.recibirLlave(mensaje, llave);
  }

  /**
   * Primer paso: llega la llave. Se consulta ANTES de pedir el contacto, y ése es el motivo de que
   * la sonda exista: hacerle compartir su teléfono a alguien cuya llave no vale es pedirle sus
   * datos para nada.
   */
  async recibirLlave(mensaje, llave) {
    const resultado = await this.manejador(
      new MensajeEntrante({ canal: this.nombre, llave, contexto: { chatId: mensaje.chat.id } })
    );

    // `FALTA_NUMERO` NO es un rechazo: es «la llave vale, ahora hace falta el teléfono». Es
    // exactamente el caso para el que existe ese motivo.
    if (resultado?.motivo === MOTIVOS.FALTA_NUMERO) {
      this.esperando.set(mensaje.chat.id, llave);
      return this.telegram.escribir(
        mensaje.chat.id,
        this.textos.PIDE_CONTACTO,
        ClienteDeTelegram.BOTON_CONTACTO
      );
    }

    this.esperando.delete(mensaje.chat.id);
    return this.telegram.escribir(mensaje.chat.id, this.textoDe(resultado), ClienteDeTelegram.SIN_TECLADO);
  }

  /** Segundo paso: llega el contacto. Aquí está la comprobación que sostiene el canal entero. */
  async recibirContacto(mensaje) {
    const chatId = mensaje.chat.id;

    // ⚠️ QUE EL CONTACTO SEA DE QUIEN ESCRIBE. Telegram permite reenviar la tarjeta de cualquiera,
    // y sin esto se verificaría el número de otra persona. `user_id` viene vacío cuando el contacto
    // no es de un usuario de Telegram, y eso tampoco vale.
    if (!mensaje.contact.user_id || mensaje.contact.user_id !== mensaje.from?.id) {
      return this.telegram.escribir(chatId, this.textos.CONTACTO_AJENO, ClienteDeTelegram.BOTON_CONTACTO);
    }

    const llave = this.esperando.get(chatId);
    if (!llave) {
      return this.telegram.escribir(chatId, this.textos.SIN_PASO_PREVIO, ClienteDeTelegram.SIN_TECLADO);
    }

    const resultado = await this.manejador(
      new MensajeEntrante({
        canal: this.nombre,
        llave,
        // AQUÍ el canal AFIRMA que el número es de quien escribe, y lo afirma porque acaba de
        // comprobarlo arriba. Es la obligación que describe el contrato de `Canal`.
        numeroProbado: mensaje.contact.phone_number,
        contexto: { chatId },
      })
    );

    this.esperando.delete(chatId);
    return this.telegram.escribir(chatId, this.textoDe(resultado), ClienteDeTelegram.SIN_TECLADO);
  }

  textoDe(resultado) {
    if (resultado?.verificado) return this.textos.VERIFICADO;
    return this.textos[resultado?.motivo] ?? this.textos[MOTIVOS.BACKEND_CAIDO];
  }

}
