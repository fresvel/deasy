import { describe, it } from "node:test";
import assert from "node:assert/strict";
import CanalWhatsApp from "./CanalWhatsApp.js";

// Un WhatsApp de mentira. Toda esta batería corre SIN RED y SIN NAVEGADOR: se le meten mensajes a
// mano y se mira qué contesta y qué le pasa a la política.
const clienteFalso = () => {
  const manejadores = {};
  const enviados = [];
  return {
    enviados,
    on: (evento, fn) => { manejadores[evento] = fn; },
    emitir: (evento, ...args) => manejadores[evento]?.(...args),
    initialize: async () => true,
    destroy: async () => true,
    sendMessage: async (a, texto) => { enviados.push({ a, texto }); return true; },
  };
};

const canalCon = (respuesta) => {
  const cliente = clienteFalso();
  const canal = new CanalWhatsApp({ cliente });
  const vistos = [];
  canal.alRecibir(async (m) => { vistos.push(m); return respuesta; });
  return { canal, cliente, vistos };
};

const LLAVE = "n0OYuT8lQxK-2mVzR7pWc1eJdAgHbF5sX4iL9tYoZ3U";
const mensaje = (extra = {}) => ({ from: "593987651234@c.us", body: LLAVE, ...extra });

describe("CanalWhatsApp · el número viene con el mensaje", () => {
  // A diferencia de Telegram, aquí no hay baile de dos pasos: el identificador de la conversación ES
  // el teléfono, y lo pone el transporte.
  it("un mensaje con la llave trae también el número, probado", async () => {
    const { canal, vistos } = canalCon({ verificado: true });
    await canal.procesar(mensaje());

    assert.equal(vistos.length, 1);
    assert.equal(vistos[0].llave, LLAVE);
    assert.equal(vistos[0].numeroProbado, "593987651234");
    assert.equal(vistos[0].tieneNumero, true, "no hay que pedirlo aparte");
  });

  it("contesta en la misma conversación", async () => {
    const { canal, cliente } = canalCon({ verificado: true });
    await canal.procesar(mensaje());
    assert.equal(cliente.enviados[0].a, "593987651234@c.us");
    assert.match(cliente.enviados[0].texto, /verificado/i);
  });
});

describe("CanalWhatsApp · lo que NO se acepta", () => {
  // ⚠️ EN UN GRUPO, `from` ES EL GRUPO Y NO LA PERSONA. Dar el número por probado ahí sería afirmar
  // algo falso. Y una llave pegada en un grupo la ve todo el mundo: aceptarla dejaría que cualquiera
  // del grupo se apropiara de una verificación ajena.
  it("un mensaje de GRUPO se ignora entero", async () => {
    const { canal, vistos, cliente } = canalCon({ verificado: true });
    await canal.procesar(mensaje({ from: "120363000000000000@g.us" }));
    assert.equal(vistos.length, 0, "no puede llegarle nada a la política");
    assert.equal(cliente.enviados.length, 0, "ni contestar en el grupo");
  });

  it("los mensajes propios no se tratan", async () => {
    const { canal, vistos } = canalCon({ verificado: true });
    await canal.procesar(mensaje({ fromMe: true }));
    assert.equal(vistos.length, 0);
  });

  // Al número dedicado le va a escribir gente que se equivoca. Un saludo no puede costar una
  // consulta al backend --y aquí es peor que en Telegram: sería CADA mensaje que llegue.
  it("un saludo no es una llave y no cuesta nada", async () => {
    const { canal, vistos, cliente } = canalCon({ verificado: true });
    await canal.procesar(mensaje({ body: "hola" }));
    await canal.procesar(mensaje({ body: "buenas tardes" }));
    assert.equal(vistos.length, 0);
    assert.equal(cliente.enviados.length, 0, "tampoco se le contesta a quien no pidió nada");
  });
});

describe("CanalWhatsApp · lo que se le dice a la persona", () => {
  for (const [motivo, patron] of [
    ["llave_caducada", /caduc/i],
    ["llave_consumida", /ya se usó/i],
    ["numero_distinto", /no es el que registraste/i],
    ["backend_caido", /no es culpa tuya/i],
  ]) {
    it(`«${motivo}» tiene su propio mensaje`, async () => {
      const { canal, cliente } = canalCon({ verificado: false, motivo });
      await canal.procesar(mensaje());
      assert.match(cliente.enviados[0].texto, patron);
    });
  }
});

describe("CanalWhatsApp · la sesión", () => {
  it("el QR se enseña y queda en el estado hasta que alguien lo escanea", async () => {
    const cliente = clienteFalso();
    const dibujados = [];
    const canal = new CanalWhatsApp({ cliente, dibujarQR: (q) => dibujados.push(q) });
    canal.alRecibir(async () => ({ verificado: true }));
    await canal.iniciar();

    cliente.emitir("qr", "CODIGO-QR");
    assert.deepEqual(dibujados, ["CODIGO-QR"]);

    const esperando = await canal.estado();
    assert.equal(esperando.salud, "sin_vincular", "esperar a que escaneen NO es un fallo: es una tarea");
    assert.equal(esperando.necesitaVinculacion, true);
    // ⚠️ EL QR NO VIAJA EN EL ESTADO. Va por su propia vía para que no acabe en un registro, en una
    // caché del navegador ni en la respuesta de quien sólo tiene permiso de lectura: quien lo escanea
    // decide QUÉ CUENTA DE WHATSAPP ES el canal de la institución.
    assert.equal(esperando.qr, undefined);
    assert.equal(canal.codigoDeVinculacion().qr, "CODIGO-QR");
    assert.ok(canal.codigoDeVinculacion().generadoEn);

    cliente.emitir("ready");
    const listo = await canal.estado();
    assert.equal(listo.necesitaVinculacion, false);
    assert.equal(canal.codigoDeVinculacion(), null, "vinculado NO hay QR que dar, y no lo hay para nadie");
    // Sin que la PLATAFORMA lo confirme, lo único que hay es la bandera del canal — y con eso la
    // pantalla no puede pintar verde. Ésa es la lección de las trece horas.
    assert.equal(listo.salud, "degradado");
    assert.equal(listo.evidencia, "afirmacion");

    cliente.emitir("change_state", "CONNECTED");
    const confirmado = await canal.estado();
    assert.equal(confirmado.salud, "sano");
    assert.equal(confirmado.evidencia, "plataforma");
  });

  it("un estado de BLOQUEO no es «caído»: no se arregla reiniciando", async () => {
    const cliente = clienteFalso();
    const canal = new CanalWhatsApp({ cliente });
    canal.alRecibir(async () => ({ verificado: true }));
    await canal.iniciar();
    cliente.emitir("ready");

    const antes = console.error;
    const dichos = [];
    console.error = (m) => dichos.push(String(m));
    // El baneo, con nombre propio. Ninguno de los otros eventos lo caza.
    cliente.emitir("change_state", "TOS_BLOCK");
    console.error = antes;

    const estado = await canal.estado();
    assert.equal(estado.salud, "bloqueado");
    assert.equal(estado.estadoPlataforma, "TOS_BLOCK", "crudo, para poder decirlo por su nombre");
    assert.ok(dichos.some((d) => /NO se arregla reiniciando/.test(d)));
  });

  // Un canal que se desvincula y no lo dice es el fallo que ya costó seis horas de silencio con
  // Telegram: desde fuera parece sano y nadie recibe nada.
  it("perder la sesión se dice, y se ve en el estado", async () => {
    const cliente = clienteFalso();
    const canal = new CanalWhatsApp({ cliente });
    canal.alRecibir(async () => ({ verificado: true }));
    await canal.iniciar();
    cliente.emitir("ready");

    const antes = console.error;
    const dichos = [];
    console.error = (m) => dichos.push(String(m));
    cliente.emitir("disconnected", "LOGOUT");
    console.error = antes;

    const estado = await canal.estado();
    assert.equal(estado.salud, "caido");
    assert.match(estado.detalle, /desvinculado/);
    assert.equal(estado.ultimoError, "LOGOUT", "el motivo se guarda: sin él no hay nada que enseñar");
    assert.ok(dichos.some((d) => /sesión perdida/.test(d)), "tiene que decirlo en el registro");
  });

  it("`iniciar` es idempotente: dos llamadas no abren dos sesiones", async () => {
    const cliente = clienteFalso();
    let arranques = 0;
    cliente.initialize = async () => { arranques += 1; };
    const canal = new CanalWhatsApp({ cliente });
    canal.alRecibir(async () => ({ verificado: true }));
    await canal.iniciar();
    await canal.iniciar();
    assert.equal(arranques, 1);
  });
});

describe("CanalWhatsApp · un descarte se cuenta, no se traga", () => {
  const canalCon = (avisos) => {
    const cliente = {
      on() {},
      async initialize() {},
      async sendMessage() {},
    };
    const canal = new CanalWhatsApp({ cliente });
    canal.alRecibir(async () => ({ verificado: true }));
    const original = { warn: console.warn, log: console.log };
    console.warn = (m) => avisos.push(["warn", m]);
    console.log = (m) => avisos.push(["log", m]);
    return { canal, restaurar: () => Object.assign(console, original) };
  };

  it("un remitente de clase desconocida se AVISA — es la única pista de que llegó algo", async () => {
    // Descartar en silencio hacía que un remitente inesperado se viera igual que un canal muerto.
    // `@lid` fue el caso REAL que lo destapó; hoy ya se resuelve, así que el ejemplo es otro --y que
    // haga falta cambiarlo es la prueba de que aquel se arregló.
    const avisos = [];
    const { canal, restaurar } = canalCon(avisos);
    await canal.procesar({ from: "123456789@loquesea", body: "x".repeat(30) });
    restaurar();

    assert.equal(avisos.length, 1);
    assert.equal(avisos[0][0], "warn");
    assert.match(avisos[0][1], /@loquesea/);
  });

  it("pero un @lid YA NO es desconocido: se resuelve, no se avisa", async () => {
    const avisos = [];
    const { canal, restaurar } = canalCon(avisos);
    canal.cliente.getContactLidAndPhone = async () => [{ pn: "593987654321@c.us" }];
    await canal.procesar({ from: "123456789@lid", body: "x".repeat(30) });
    restaurar();

    assert.deepEqual(avisos, []);
  });

  it("pero NO se avisa de un grupo: descartarlo es lo correcto y no hay nada que contar", async () => {
    const avisos = [];
    const { canal, restaurar } = canalCon(avisos);
    await canal.procesar({ from: "123-456@g.us", body: "x".repeat(30) });
    restaurar();

    assert.deepEqual(avisos, []);
  });

  it("un mensaje propio no dice nada: es nuestra propia respuesta volviendo", async () => {
    const avisos = [];
    const { canal, restaurar } = canalCon(avisos);
    await canal.procesar({ from: "593999@c.us", fromMe: true, body: "x".repeat(30) });
    restaurar();

    assert.deepEqual(avisos, []);
  });

  it("un mensaje sin llave se registra CON su longitud y SIN su texto", async () => {
    const avisos = [];
    const { canal, restaurar } = canalCon(avisos);
    await canal.procesar({ from: "593999@c.us", body: "hola, buenas" });
    restaurar();

    assert.equal(avisos.length, 1);
    assert.match(avisos[0][1], /12 caracteres/);
    assert.doesNotMatch(avisos[0][1], /hola/, "el texto es de una persona: no se registra");
  });

  it("el aviso no filtra el identificador, sólo su clase", async () => {
    const avisos = [];
    const { canal, restaurar } = canalCon(avisos);
    await canal.procesar({ from: "987654321098@loquesea", body: "x".repeat(30) });
    restaurar();

    assert.doesNotMatch(avisos[0][1], /987654321098/);
  });
});

describe("CanalWhatsApp · un @lid se RESUELVE o se rechaza", () => {
  const canalCon = ({ pares, enviados = [], recibidos = [] }) => {
    const cliente = {
      on() {},
      async initialize() {},
      async sendMessage(a, texto) { enviados.push({ a, texto }); },
      async getContactLidAndPhone(ids) { return pares(ids); },
    };
    const canal = new CanalWhatsApp({ cliente });
    canal.alRecibir(async (m) => { recibidos.push(m); return { verificado: true }; });
    return { canal, enviados, recibidos };
  };
  const LLAVE = "a".repeat(30);

  it("resuelve el @lid al teléfono y lo afirma como probado", async () => {
    const recibidos = [];
    const { canal } = canalCon({
      pares: () => [{ lid: "111@lid", pn: "593987654321@c.us" }],
      recibidos,
    });

    await canal.procesar({ from: "111@lid", body: LLAVE });

    assert.equal(recibidos.length, 1);
    assert.equal(recibidos[0].numeroProbado, "593987654321");
  });

  it("si WhatsApp no sabe el teléfono, NO verifica nada y lo dice", async () => {
    const recibidos = [];
    const enviados = [];
    const { canal } = canalCon({ pares: () => [{ lid: "111@lid", pn: undefined }], recibidos, enviados });
    const avisos = [];
    const warn = console.warn;
    console.warn = (m) => avisos.push(m);

    await canal.procesar({ from: "111@lid", body: LLAVE });
    console.warn = warn;

    assert.deepEqual(recibidos, [], "no puede afirmar un número que no conoce");
    assert.match(avisos[0], /NO se verifica/);
    assert.match(enviados[0].texto, /desde qué número/);
  });

  it("si le devuelven OTRO @lid tampoco cuela: se exige un teléfono", async () => {
    const recibidos = [];
    const { canal } = canalCon({ pares: () => [{ pn: "222@lid" }], recibidos });
    const warn = console.warn;
    console.warn = () => {};
    await canal.procesar({ from: "111@lid", body: LLAVE });
    console.warn = warn;

    assert.deepEqual(recibidos, []);
  });

  it("si lo devuelto no son dígitos, se rechaza", async () => {
    const recibidos = [];
    const { canal } = canalCon({ pares: () => [{ pn: "no-es-un-numero@c.us" }], recibidos });
    const warn = console.warn;
    console.warn = () => {};
    await canal.procesar({ from: "111@lid", body: LLAVE });
    console.warn = warn;

    assert.deepEqual(recibidos, []);
  });

  it("un @c.us NO gasta una consulta: el número ya viene puesto", async () => {
    let consultas = 0;
    const recibidos = [];
    const { canal } = canalCon({
      pares: () => { consultas += 1; return []; },
      recibidos,
    });

    await canal.procesar({ from: "593999888777@c.us", body: LLAVE });

    assert.equal(consultas, 0);
    assert.equal(recibidos[0].numeroProbado, "593999888777");
  });

  it("un mensaje SIN llave no gasta consulta: primero lo barato", async () => {
    let consultas = 0;
    const { canal } = canalCon({ pares: () => { consultas += 1; return []; } });
    const log = console.log;
    console.log = () => {};
    await canal.procesar({ from: "111@lid", body: "hola" });
    console.log = log;

    assert.equal(consultas, 0, "consultar por cada mensaje basura es un ataque de coste");
  });
});

describe("CanalWhatsApp · la prueba gana a la afirmación, en los dos sentidos", () => {
  const conCliente = () => {
    const oyentes = {};
    const cliente = {
      on(evento, fn) { (oyentes[evento] ??= []).push(fn); },
      emitir(evento, ...args) { (oyentes[evento] ?? []).forEach((fn) => fn(...args)); },
      async initialize() {},
      async sendMessage() {},
      async getState() { return this.estado; },
      estado: "",
    };
    const canal = new CanalWhatsApp({ cliente });
    canal.alRecibir(async () => ({ verificado: true }));
    return { cliente, canal };
  };

  it("con la plataforma CONNECTED no se dice «caído», aunque la bandera esté a false", async () => {
    // Salió así de verdad el 2026-09-02: `caido` con `CONNECTED` al lado. La bandera sólo se pone en
    // `ready`, y un arranque puede quedarse en «sincronizando» sin llegar a él.
    const { cliente, canal } = conCliente();
    await canal.iniciar();
    cliente.estado = "CONNECTED";
    await canal.comprobarPlataforma();

    const estado = await canal.estado();
    assert.notEqual(estado.salud, "caido");
    assert.equal(estado.salud, "degradado", "la plataforma responde, pero la sesión no abrió: ni verde ni rojo");
    assert.equal(estado.evidencia, "plataforma");
  });

  it("y con la bandera puesta pero SIN confirmar, tampoco se dice «sano»", async () => {
    const { cliente, canal } = conCliente();
    await canal.iniciar();
    cliente.emitir("ready");

    const estado = await canal.estado();
    assert.equal(estado.salud, "degradado");
    assert.equal(estado.evidencia, "afirmacion", "con esto la pantalla NO puede pintar verde");
  });

  it("verde sólo cuando coinciden las dos cosas", async () => {
    const { cliente, canal } = conCliente();
    await canal.iniciar();
    cliente.emitir("ready");
    cliente.estado = "CONNECTED";
    await canal.comprobarPlataforma();

    const estado = await canal.estado();
    assert.equal(estado.salud, "sano");
    assert.equal(estado.evidencia, "plataforma");
  });
});
