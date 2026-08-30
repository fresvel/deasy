import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ClienteDeDeasy from "./ClienteDeDeasy.js";

const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

const clienteCon = (responder) => {
  const llamadas = [];
  const cliente = new ClienteDeDeasy({
    base: "http://backend:3030/",
    clave: "secreta",
    fetch: async (url, opciones) => {
      llamadas.push({ url, opciones });
      return responder(url, opciones);
    },
  });
  return { cliente, llamadas };
};

describe("ClienteDeDeasy · cómo llama", () => {
  it("manda la clave POR CABECERA, no en la dirección", async () => {
    const { cliente, llamadas } = clienteCon(() => respuesta(200, { numero: "0991112233" }));
    await cliente.resolverLlave("K1");

    assert.equal(llamadas[0].opciones.headers["x-deasy-servicio"], "secreta");
    // Los parámetros acaban en los registros del servidor; la cabecera no.
    assert.ok(!llamadas[0].url.includes("secreta"), "la clave no puede ir en la URL");
  });

  it("quita la barra sobrante de la dirección, para no pedir a `//internal`", async () => {
    const { cliente, llamadas } = clienteCon(() => respuesta(200, { numero: "1" }));
    await cliente.resolverLlave("K1");
    assert.equal(llamadas[0].url, "http://backend:3030/internal/verificacion/resolver");
  });

  it("no arranca sin dirección ni sin clave: falla al construirse, no al primer uso", () => {
    assert.throws(() => new ClienteDeDeasy({ clave: "x" }), /dirección/);
    assert.throws(() => new ClienteDeDeasy({ base: "http://x" }), /clave/);
  });
});

describe("ClienteDeDeasy · resolverLlave", () => {
  it("una llave buena devuelve el número", async () => {
    const { cliente } = clienteCon(() => respuesta(200, { numero: "0991112233" }));
    assert.deepEqual(await cliente.resolverLlave("K1"), { valida: true, numero: "0991112233" });
  });

  // Los tres estados llegan del backend y viajan enteros: la política los traduce a tres mensajes.
  for (const estado of ["desconocida", "caducada", "consumida"]) {
    it(`«${estado}» llega como rechazo, con su motivo`, async () => {
      const { cliente } = clienteCon(() => respuesta(404, { estado }));
      assert.deepEqual(await cliente.resolverLlave("K1"), { valida: false, estado });
    });
  }

  it("un 404 sin cuerpo legible no revienta: cae al genérico", async () => {
    const { cliente } = clienteCon(() => ({ ok: false, status: 404, json: async () => { throw new Error("vacío"); } }));
    assert.deepEqual(await cliente.resolverLlave("K1"), { valida: false, estado: "desconocida" });
  });

  // ⚠️ La distinción que sostiene el mensaje al usuario: un fallo NUESTRO no puede parecer un
  // rechazo suyo, o reintentará cambiando cosas que están bien.
  it("si el backend falla, LANZA — no devuelve un rechazo", async () => {
    const { cliente } = clienteCon(() => respuesta(500, {}));
    await assert.rejects(() => cliente.resolverLlave("K1"), /respondió 500/);
  });

  it("un 401 tampoco es un rechazo del usuario: es la clave nuestra", async () => {
    const { cliente } = clienteCon(() => respuesta(401, {}));
    await assert.rejects(() => cliente.resolverLlave("K1"), /respondió 401/);
  });
});

describe("ClienteDeDeasy · confirmarVerificacion", () => {
  it("manda la llave y el canal", async () => {
    const { cliente, llamadas } = clienteCon(() => respuesta(200, { verificado: true }));
    const ok = await cliente.confirmarVerificacion({ llave: "K1", canal: "telegram" });
    assert.deepEqual(ok, { confirmado: true });

    assert.equal(llamadas[0].url, "http://backend:3030/internal/verificacion/consumir");
    assert.deepEqual(JSON.parse(llamadas[0].opciones.body), { llave: "K1", canal: "telegram" });
  });

  it("un fallo al consumir LANZA: nadie debe creer que quedó verificado", async () => {
    const { cliente } = clienteCon(() => respuesta(500, { message: "se cayó" }));
    await assert.rejects(() => cliente.confirmarVerificacion({ llave: "K1", canal: "sms" }));
  });

  // El 409 es el ÚNICO código que no lanza: la llave dejó de valer entre resolver y confirmar, y eso
  // se le cuenta al usuario como «pide otra», no como avería.
  it("un 409 al confirmar es un rechazo con motivo, no una excepción", async () => {
    const { cliente } = clienteCon(() => respuesta(409, { estado: "consumida" }));
    assert.deepEqual(await cliente.confirmarVerificacion({ llave: "K1", canal: "telegram" }), {
      confirmado: false,
      estado: "consumida",
    });
  });
});
