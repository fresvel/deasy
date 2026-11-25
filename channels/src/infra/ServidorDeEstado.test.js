import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import ServidorDeEstado from "./ServidorDeEstado.js";

const canalFalso = (nombre, estado, extras = {}) => ({
  nombre,
  async estado() { return estado; },
  ...extras,
});

describe("ServidorDeEstado", () => {
  let servidor;
  let base;
  let vecesQuePregunto = 0;

  before(async () => {
    const whatsapp = canalFalso("whatsapp", { salud: "sano", necesitaVinculacion: true }, {
      codigoDeVinculacion: () => ({ qr: "CODIGO", generadoEn: "2026-09-01T22:00:00.000Z" }),
      async comprobarPlataforma() {
        vecesQuePregunto += 1;
        return { estadoPlataforma: "CONNECTED" };
      },
    });
    const telegram = canalFalso("telegram", { salud: "sano", evidencia: "sondeo" });
    servidor = new ServidorDeEstado({ canales: [telegram, whatsapp], clave: "LA-CLAVE", puerto: 0 });
    await servidor.iniciar();
    base = `http://127.0.0.1:${servidor.servidor.address().port}`;
  });

  after(async () => { await servidor.detener(); });

  const pedir = (ruta, clave = "LA-CLAVE") =>
    fetch(`${base}${ruta}`, { headers: clave ? { "x-clave-servicio": clave } : {} });

  it("sin la clave responde 404, no 401: un 401 confirmaría que aquí hay algo", async () => {
    assert.equal((await pedir("/estado", "")).status, 404);
    assert.equal((await pedir("/estado", "otra")).status, 404);
  });

  it("devuelve el estado de todos los canales, con su nombre", async () => {
    const cuerpo = await (await pedir("/estado")).json();
    assert.deepEqual(cuerpo.canales.map((c) => c.nombre), ["telegram", "whatsapp"]);
    assert.ok(cuerpo.servicio.arrancado);
  });

  it("EL QR NO VIAJA EN EL ESTADO — va por su propia ruta", async () => {
    const cuerpo = await (await pedir("/estado")).json();
    const wa = cuerpo.canales.find((c) => c.nombre === "whatsapp");
    assert.equal(wa.qr, undefined, "quien escanea decide qué cuenta es el canal: no va de paseo");
    assert.equal(wa.necesitaVinculacion, true);
  });

  it("el QR se sirve por /qr, con cuándo se generó", async () => {
    const cuerpo = await (await pedir("/qr")).json();
    assert.equal(cuerpo.qr, "CODIGO");
    // `generadoEn` y no `expiraEn`: la librería NO dice cuánto vive un QR, así que un `expiraEn`
    // sería inventarse una precisión que no tenemos.
    assert.ok(cuerpo.generadoEn);
  });

  it("y sin la clave, tampoco", async () => {
    assert.equal((await pedir("/qr", "")).status, 404);
  });

  it("la comprobación activa se CACHEA: no se maltrata a la plataforma", async () => {
    // Se parte de la caché vacía a propósito: las pruebas anteriores ya la habían calentado, y sin
    // esto la prueba pasaba por el motivo equivocado (cero preguntas en vez de una).
    servidor.cacheActiva.clear();
    vecesQuePregunto = 0;
    for (let i = 0; i < 5; i += 1) await pedir("/estado");
    assert.equal(vecesQuePregunto, 1, "cinco sondeos de la pantalla, UNA pregunta a la plataforma");
  });

  it("si la comprobación activa revienta, no tumba la respuesta", async () => {
    const roto = canalFalso("roto", { salud: "sano" }, {
      async comprobarPlataforma() { throw new Error("la página se cerró"); },
    });
    const otro = new ServidorDeEstado({ canales: [roto], clave: "K", puerto: 0 });
    await otro.iniciar();
    const url = `http://127.0.0.1:${otro.servidor.address().port}/estado`;
    const cuerpo = await (await fetch(url, { headers: { "x-clave-servicio": "K" } })).json();
    await otro.detener();

    assert.equal(cuerpo.canales[0].ultimoError, "la página se cerró",
      "el fallo de la comprobación ES información, no un motivo para no contestar");
  });
});

describe("ServidorDeEstado · sin QR que dar", () => {
  it("responde 409 y no 404: «no hay QR» no es «no existe la ruta»", async () => {
    const vinculado = canalFalso("whatsapp", { salud: "sano" }, { codigoDeVinculacion: () => null });
    const s = new ServidorDeEstado({ canales: [vinculado], clave: "K", puerto: 0 });
    await s.iniciar();
    const r = await fetch(`http://127.0.0.1:${s.servidor.address().port}/qr`, {
      headers: { "x-clave-servicio": "K" },
    });
    await s.detener();
    assert.equal(r.status, 409);
  });
});

// ── DOS FALLOS QUE SALIERON AL PROBARLO CONTRA EL SISTEMA REAL ─────────────────────────────────
//
// El JSON de verdad devolvió `{salud: "caido", evidencia: "afirmacion", estadoPlataforma: "CONNECTED"}`
// — tres campos contradiciéndose, y con la AFIRMACIÓN ganándole a la PRUEBA, que es justo lo
// contrario de lo que este diseño existe para hacer. Ninguna prueba unitaria lo cazó porque todas
// miraban las piezas por separado.
describe("ServidorDeEstado · se pregunta ANTES de leer el estado", () => {
  it("el canal calcula su veredicto CON lo que la plataforma acaba de decir", async () => {
    const orden = [];
    const canal = {
      nombre: "whatsapp",
      plataforma: null,
      async comprobarPlataforma() {
        orden.push("preguntar");
        this.plataforma = "CONNECTED";
        return { estadoPlataforma: this.plataforma };
      },
      async estado() {
        orden.push("leer");
        // Si se lee ANTES de preguntar, esto sale `null` y el veredicto se calcula a ciegas.
        return { salud: this.plataforma ? "sano" : "caido", estadoPlataforma: this.plataforma };
      },
    };

    const s = new ServidorDeEstado({ canales: [canal], clave: "K", puerto: 0 });
    await s.iniciar();
    const cuerpo = await (await fetch(`http://127.0.0.1:${s.servidor.address().port}/estado`, {
      headers: { "x-clave-servicio": "K" },
    })).json();
    await s.detener();

    assert.deepEqual(orden, ["preguntar", "leer"], "preguntar va PRIMERO");
    assert.equal(cuerpo.canales[0].salud, "sano");
    assert.equal(cuerpo.canales[0].estadoPlataforma, "CONNECTED");
  });
});
