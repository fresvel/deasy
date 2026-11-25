import { describe, it } from "node:test";
import assert from "node:assert/strict";

import ClienteDeChannels from "./ClienteDeChannels.js";

/** Un `fetch` de mentira. Aquí no se levanta nada: se prueba la decisión, no la red. */
const conFetch = (impl, opciones = {}) => {
  const cliente = new ClienteDeChannels({ base: "http://channels:3050", clave: "K", ...opciones });
  globalThis.fetch = impl;
  return cliente;
};

describe("ClienteDeChannels", () => {
  it("manda la clave de servicio, y en la cabecera acordada", async () => {
    let vistas = null;
    const c = conFetch(async (url, opts) => {
      vistas = { url, cabecera: opts.headers["x-clave-servicio"] };
      return { status: 200, json: async () => ({ canales: [] }) };
    });

    await c.estado();

    assert.equal(vistas.url, "http://channels:3050/estado");
    assert.equal(vistas.cabecera, "K");
  });

  it("si el servicio NO contesta, eso ES la respuesta — no una excepción", async () => {
    // Es el caso que motivó toda la tarea: el 2026-08-31 el contenedor estuvo trece horas muerto.
    // Que esto lanzara una excepción convertiría «el canal está caído» en «la pantalla falla».
    const c = conFetch(async () => { throw new Error("connect ECONNREFUSED channels:3050"); });

    const r = await c.estado();

    assert.equal(r.alcanzable, false);
    assert.match(r.error, /ECONNREFUSED/);
  });

  it("sin configurar tampoco revienta: lo dice", async () => {
    const c = new ClienteDeChannels({ base: "", clave: "" });
    const r = await c.estado();
    assert.equal(r.alcanzable, false);
    assert.match(r.error, /no tiene configurado/);
  });

  it("un 409 del QR NO es un fallo: es «no hace falta vincular»", async () => {
    const c = conFetch(async () => ({ status: 409, json: async () => ({ error: "no hace falta" }) }));

    const r = await c.codigoDeVinculacion();

    assert.equal(r.alcanzable, true, "el servicio contestó perfectamente");
    assert.equal(r.hayQr, false, "y lo que contestó es que no hay QR que dar");
  });

  it("el QR llega con cuándo se generó", async () => {
    const c = conFetch(async () => ({
      status: 200,
      json: async () => ({ qr: "CODIGO", generadoEn: "2026-09-02T00:00:00.000Z" }),
    }));

    const r = await c.codigoDeVinculacion();

    assert.equal(r.qr, "CODIGO");
    assert.equal(r.generadoEn, "2026-09-02T00:00:00.000Z");
  });

  it("hay LÍMITE DE TIEMPO: un servicio medio vivo no deja la pantalla girando", async () => {
    let señal = null;
    const c = conFetch(async (_url, opts) => {
      señal = opts.signal;
      return { status: 200, json: async () => ({}) };
    });

    await c.estado();

    assert.ok(señal, "sin `signal`, una petición colgada cuelga la pantalla para siempre");
  });
});
