import { describe, it } from "node:test";
import assert from "node:assert/strict";
import CanalTelegram, { TEXTOS } from "./CanalTelegram.js";
import { MOTIVOS } from "../dominio/VerificacionDeTelefono.js";

// Un Telegram de mentira. Toda esta batería corre SIN RED: se le meten actualizaciones a mano y se
// mira qué contesta y qué le pide a la política.
const telegramFalso = () => {
  const escritos = [];
  return {
    escritos,
    quienSoy: async () => ({ username: "deasy_test_bot", is_bot: true }),
    olvidarWebhook: async () => true,
    actualizaciones: async () => [],
    escribir: async (chatId, texto, extra = {}) => {
      escritos.push({ chatId, texto, extra });
      return true;
    },
  };
};

/** El canal con una política de mentira que devuelve lo que le digamos. */
const canalCon = (respuestas) => {
  const telegram = telegramFalso();
  const canal = new CanalTelegram({ telegram });
  const vistos = [];
  const cola = Array.isArray(respuestas) ? [...respuestas] : [respuestas];
  canal.alRecibir(async (mensaje) => {
    vistos.push(mensaje);
    return cola.length > 1 ? cola.shift() : cola[0];
  });
  return { canal, telegram, vistos };
};

const START = (llave, chatId = 7, from = 42) => ({
  update_id: 1,
  message: { chat: { id: chatId }, from: { id: from }, text: `/start ${llave}` },
});

const CONTACTO = ({ chatId = 7, from = 42, userId = 42, numero = "+593991112233" } = {}) => ({
  update_id: 2,
  message: {
    chat: { id: chatId },
    from: { id: from },
    contact: { user_id: userId, phone_number: numero },
  },
});

const ultimo = (telegram) => telegram.escritos.at(-1);

describe("CanalTelegram · el ataque que este canal existe para impedir", () => {
  // Telegram permite reenviar la tarjeta de contacto de CUALQUIERA. Sin esta comprobación, alguien
  // abre el enlace, reenvía el contacto de otra persona y verifica un número que no es suyo — y el
  // backend no tendría cómo notarlo, porque para él ese número llegaría «probado por el transporte».
  it("un contacto REENVIADO de otra persona no verifica nada", async () => {
    const { canal, telegram, vistos } = canalCon({ verificado: false, motivo: MOTIVOS.FALTA_NUMERO });
    await canal.procesar(START("LLAVE"));
    const pedidas = vistos.length;

    await canal.procesar(CONTACTO({ from: 42, userId: 999 }));

    assert.equal(vistos.length, pedidas, "no debe llegarle NADA a la política");
    assert.equal(ultimo(telegram).texto, TEXTOS.CONTACTO_AJENO);
  });

  // `user_id` viene vacío cuando el contacto no corresponde a un usuario de Telegram: una tarjeta
  // escrita a mano, por ejemplo. Tampoco prueba nada.
  it("un contacto sin `user_id` tampoco vale", async () => {
    const { canal, telegram, vistos } = canalCon({ verificado: false, motivo: MOTIVOS.FALTA_NUMERO });
    await canal.procesar(START("LLAVE"));
    const pedidas = vistos.length;

    await canal.procesar(CONTACTO({ userId: null }));

    assert.equal(vistos.length, pedidas);
    assert.equal(ultimo(telegram).texto, TEXTOS.CONTACTO_AJENO);
  });
});

describe("CanalTelegram · el baile de dos pasos", () => {
  it("con la llave viva pide el contacto, y NO lo da por verificado", async () => {
    const { canal, telegram, vistos } = canalCon({ verificado: false, motivo: MOTIVOS.FALTA_NUMERO });
    await canal.procesar(START("LLAVE"));

    assert.equal(vistos.length, 1);
    assert.equal(vistos[0].llave, "LLAVE");
    assert.equal(vistos[0].tieneNumero, false, "en el primer paso NO hay número: el bot no lo recibe");

    const dicho = ultimo(telegram);
    assert.equal(dicho.texto, TEXTOS.PIDE_CONTACTO);
    assert.equal(dicho.extra.reply_markup.keyboard[0][0].request_contact, true);
  });

  it("el segundo paso trae el número Y la llave del primero", async () => {
    const { canal, telegram, vistos } = canalCon([
      { verificado: false, motivo: MOTIVOS.FALTA_NUMERO },
      { verificado: true },
    ]);
    await canal.procesar(START("LLAVE"));
    await canal.procesar(CONTACTO({ numero: "+593991112233" }));

    assert.equal(vistos.length, 2);
    assert.equal(vistos[1].llave, "LLAVE", "la llave la recuerda el canal, no la repite el usuario");
    assert.equal(vistos[1].numeroProbado, "+593991112233");
    assert.equal(ultimo(telegram).texto, TEXTOS.VERIFICADO);
    // Y el teclado se retira: dejarlo puesto invita a compartir el contacto otra vez para nada.
    assert.equal(ultimo(telegram).extra.reply_markup.remove_keyboard, true);
  });

  it("compartir el contacto SIN haber traído la llave no verifica", async () => {
    const { canal, telegram, vistos } = canalCon({ verificado: true });
    await canal.procesar(CONTACTO({}));

    assert.equal(vistos.length, 0, "sin llave no hay nada que preguntar");
    assert.equal(ultimo(telegram).texto, TEXTOS.SIN_PASO_PREVIO);
  });

  // Dos conversaciones a la vez son lo normal: el bot es uno para todo el mundo.
  it("dos personas a la vez no se mezclan las llaves", async () => {
    const { canal, vistos } = canalCon([
      { verificado: false, motivo: MOTIVOS.FALTA_NUMERO },
      { verificado: false, motivo: MOTIVOS.FALTA_NUMERO },
      { verificado: true },
    ]);
    await canal.procesar(START("LLAVE_A", 7, 42));
    await canal.procesar(START("LLAVE_B", 8, 43));
    await canal.procesar(CONTACTO({ chatId: 8, from: 43, userId: 43 }));

    assert.equal(vistos.at(-1).llave, "LLAVE_B", "cada chat recuerda LA SUYA");
  });
});

describe("CanalTelegram · lo que se le dice al usuario", () => {
  // Los cuatro rechazos son mensajes DISTINTOS a propósito: sólo dos de ellos significan «repite
  // sin cambiar nada de lo que hiciste».
  for (const motivo of [
    MOTIVOS.LLAVE_DESCONOCIDA,
    MOTIVOS.LLAVE_CADUCADA,
    MOTIVOS.LLAVE_CONSUMIDA,
    MOTIVOS.BACKEND_CAIDO,
  ]) {
    it(`«${motivo}» tiene su propio texto y no pide el contacto`, async () => {
      const { canal, telegram } = canalCon({ verificado: false, motivo });
      await canal.procesar(START("LLAVE"));

      assert.equal(ultimo(telegram).texto, TEXTOS[motivo]);
      assert.notEqual(ultimo(telegram).texto, TEXTOS.PIDE_CONTACTO);
      assert.equal(canal.esperando.size, 0, "una llave que no vale no se recuerda");
    });
  }

  it("un «número distinto» explica que mire el país", async () => {
    const { canal, telegram } = canalCon([
      { verificado: false, motivo: MOTIVOS.FALTA_NUMERO },
      { verificado: false, motivo: MOTIVOS.NUMERO_DISTINTO },
    ]);
    await canal.procesar(START("LLAVE"));
    await canal.procesar(CONTACTO({ numero: "+51991112233" }));

    assert.match(ultimo(telegram).texto, /país/);
  });

  it("un mensaje cualquiera explica cómo se empieza, y no cuesta una consulta", async () => {
    const { canal, telegram, vistos } = canalCon({ verificado: true });
    await canal.procesar({ update_id: 1, message: { chat: { id: 7 }, from: { id: 42 }, text: "hola" } });

    assert.equal(vistos.length, 0);
    assert.equal(ultimo(telegram).texto, TEXTOS.SIN_LLAVE);
  });
});

describe("CanalTelegram · el sondeo", () => {
  it("avanza el offset ANTES de tratar, para que un mensaje malo no bloquee la cola", async () => {
    const telegram = telegramFalso();
    const canal = new CanalTelegram({ telegram });
    canal.alRecibir(async () => { throw new Error("algo salió mal tratándolo"); });

    telegram.actualizaciones = async () => {
      canal.corriendo = false;             // una sola vuelta
      return [START("LLAVE"), { ...START("OTRA"), update_id: 5 }];
    };
    canal.corriendo = true;
    await canal.sondear(async () => {});

    assert.equal(canal.offset, 6, "confirmadas las dos, aunque tratarlas fallara");
    assert.match(canal.ultimoError, /algo salió mal/);
  });

  it("un fallo de red no mata el sondeo: espera y sigue", async () => {
    const telegram = telegramFalso();
    const canal = new CanalTelegram({ telegram });
    canal.alRecibir(async () => ({ verificado: true }));

    let vueltas = 0;
    telegram.actualizaciones = async () => {
      vueltas += 1;
      if (vueltas === 1) throw new Error("ECONNRESET");
      canal.corriendo = false;
      return [];
    };
    canal.corriendo = true;

    let espero = false;
    await canal.sondear(async () => { espero = true; });

    assert.equal(vueltas, 2, "reintentó después del fallo");
    assert.equal(espero, true, "y esperó antes, para no martillear");
  });

  it("`iniciar` es idempotente y quita el webhook, que si no `getUpdates` da 409", async () => {
    const telegram = telegramFalso();
    let olvidos = 0;
    telegram.olvidarWebhook = async () => { olvidos += 1; return true; };
    telegram.actualizaciones = async () => { await new Promise((r) => setTimeout(r, 5)); return []; };

    const canal = new CanalTelegram({ telegram });
    canal.alRecibir(async () => ({ verificado: true }));
    await canal.iniciar();
    await canal.iniciar();

    assert.equal(olvidos, 1, "dos llamadas no abren dos sondeos");
    assert.deepEqual(await canal.estado(), {
      conectado: true, necesitaVinculacion: false, qr: null, detalle: "@deasy_test_bot",
    });
    await canal.detener();
    assert.equal((await canal.estado()).conectado, false);
  });
});

// ── QUE UN CANAL ROTO NO PASE DESAPERCIBIDO ─────────────────────────────────────────────────────
//
// El 2026-08-31 este canal estuvo SEIS HORAS sin poder resolver `api.telegram.org` --el reenviador
// DNS de la red de Docker se había quedado con el resolvedor de otra red-- y su registro sólo tenía
// la línea de arranque: desde fuera era indistinguible de uno sano. Lo notó el dueño porque el bot
// no le contestaba.
//
// Un servicio que falla en silencio es peor que uno que se cae: al menos el que se cae se ve.
describe("CanalTelegram · avisar cuando se rompe", () => {
  const capturar = () => {
    const lineas = { error: [], log: [] };
    const antes = { error: console.error, log: console.log };
    console.error = (m) => lineas.error.push(String(m));
    console.log = (m) => lineas.log.push(String(m));
    return { lineas, restaurar: () => Object.assign(console, antes) };
  };

  it("avisa UNA vez al empezar a fallar, no en cada reintento", async () => {
    const telegram = telegramFalso();
    const canal = new CanalTelegram({ telegram });
    canal.alRecibir(async () => ({ verificado: true }));

    let vueltas = 0;
    telegram.actualizaciones = async () => {
      vueltas += 1;
      if (vueltas >= 4) canal.corriendo = false;
      throw new Error("getaddrinfo EAI_AGAIN api.telegram.org");
    };

    const { lineas, restaurar } = capturar();
    canal.corriendo = true;
    await canal.sondear(async () => {});
    restaurar();

    assert.equal(vueltas, 4, "reintenta");
    assert.equal(lineas.error.length, 1, `avisó ${lineas.error.length} veces; con 20 por minuto no las lee nadie`);
    assert.match(lineas.error[0], /EAI_AGAIN/);
  });

  it("y avisa cuando vuelve, o quien vio el fallo no sabe si se arregló", async () => {
    const telegram = telegramFalso();
    const canal = new CanalTelegram({ telegram });
    canal.alRecibir(async () => ({ verificado: true }));

    let vueltas = 0;
    telegram.actualizaciones = async () => {
      vueltas += 1;
      if (vueltas === 1) throw new Error("ECONNRESET");
      canal.corriendo = false;
      return [];
    };

    const { lineas, restaurar } = capturar();
    canal.corriendo = true;
    await canal.sondear(async () => {});
    restaurar();

    assert.equal(lineas.error.length, 1);
    assert.ok(lineas.log.some((l) => /vuelve a funcionar/.test(l)), "tiene que decir que volvió");
  });
});
