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
    const { cliente, llamadas } = clienteCon(() => respuesta(200, { estado: "valida" }));
    await cliente.estadoDeLlave("K1");

    assert.equal(llamadas[0].opciones.headers["x-deasy-servicio"], "secreta");
    // Los parámetros acaban en los registros del servidor; la cabecera no.
    assert.ok(!llamadas[0].url.includes("secreta"), "la clave no puede ir en la URL");
  });

  it("quita la barra sobrante de la dirección, para no pedir a `//internal`", async () => {
    const { cliente, llamadas } = clienteCon(() => respuesta(200, { estado: "valida" }));
    await cliente.estadoDeLlave("K1");
    assert.equal(llamadas[0].url, "http://backend:3030/internal/verificacion/estado");
  });

  it("no arranca sin dirección ni sin clave: falla al construirse, no al primer uso", () => {
    assert.throws(() => new ClienteDeDeasy({ clave: "x" }), /dirección/);
    assert.throws(() => new ClienteDeDeasy({ base: "http://x" }), /clave/);
  });
});

describe("ClienteDeDeasy · estadoDeLlave", () => {
  // ⚠️ LA SONDA NO TRAE EL NÚMERO, y ése es el cambio de C2b. Antes sí, y con él este servicio
  // comparaba sin saber de qué país era el número guardado.
  it("una llave viva dice que vale, y NADA de a quién pertenece", async () => {
    const { cliente } = clienteCon(() => respuesta(200, { estado: "valida" }));
    const salida = await cliente.estadoDeLlave("K1");
    assert.deepEqual(salida, { valida: true });
    assert.equal("numero" in salida, false, "el número no debe salir del backend");
  });

  for (const estado of ["desconocida", "caducada", "consumida"]) {
    it(`un 404 con «${estado}» conserva el motivo`, async () => {
      const { cliente } = clienteCon(() => respuesta(404, { estado }));
      assert.deepEqual(await cliente.estadoDeLlave("K1"), { valida: false, estado });
    });
  }

  // ⚠️ EL 404 LO DAN DOS COSAS: el endpoint cuando la llave no vale, y el GUARD cuando nuestra clave
  // compartida no es la buena. Sin distinguirlos, una clave mal puesta en un entorno haría que el
  // canal le dijera «tu enlace no vale» a TODO EL MUNDO, para siempre y sin una pista de por qué.
  it("un 404 SIN estado es la clave compartida, y eso LANZA", async () => {
    const { cliente } = clienteCon(() => respuesta(404, { message: "No encontrado." }));
    await assert.rejects(() => cliente.estadoDeLlave("K1"), /INTERNAL_SERVICE_KEY/);
  });

  it("un 404 con cuerpo ilegible se trata igual: no se disfraza de llave mala", async () => {
    const { cliente } = clienteCon(() => ({ ok: false, status: 404, json: async () => { throw new Error("no es JSON"); } }));
    await assert.rejects(() => cliente.estadoDeLlave("K1"), /INTERNAL_SERVICE_KEY/);
  });

  // Que el backend se caiga NO es «tu llave no vale». Confundirlos hace que el usuario reintente
  // cambiando cosas que están bien.
  it("un 500 LANZA en vez de parecer un rechazo", async () => {
    const { cliente } = clienteCon(() => respuesta(500, { message: "boom" }));
    await assert.rejects(() => cliente.estadoDeLlave("K1"), /respondió 500/);
  });

  it("un 401 lanza igual: tampoco es un problema de la llave del usuario", async () => {
    const { cliente } = clienteCon(() => respuesta(401, {}));
    await assert.rejects(() => cliente.estadoDeLlave("K1"), /respondió 401/);
  });
});

describe("ClienteDeDeasy · confirmarVerificacion", () => {
  it("manda el HECHO OBSERVADO: número, llave y canal", async () => {
    const { cliente, llamadas } = clienteCon(() => respuesta(200, { verificado: true }));
    const ok = await cliente.confirmarVerificacion({ llave: "K1", numero: "+593991112233", canal: "telegram" });
    assert.deepEqual(ok, { confirmado: true });

    assert.equal(llamadas[0].url, "http://backend:3030/internal/verificacion/confirmar");
    assert.deepEqual(JSON.parse(llamadas[0].opciones.body), {
      llave: "K1",
      numero: "+593991112233",
      canal: "telegram",
    });
  });

  it("un fallo del backend LANZA: nadie debe creer que quedó verificado", async () => {
    const { cliente } = clienteCon(() => respuesta(500, { message: "se cayó" }));
    await assert.rejects(() => cliente.confirmarVerificacion({ llave: "K1", canal: "whatsapp" }));
  });

  // El 409 es el ÚNICO código que no lanza: la llave no valía o el número no era. Al usuario le
  // toca «pide otra» o «ese número no es el que registraste», no «error interno».
  for (const estado of ["numero_distinto", "consumida", "caducada"]) {
    it(`un 409 con «${estado}» es un rechazo con motivo, no una excepción`, async () => {
      const { cliente } = clienteCon(() => respuesta(409, { estado }));
      assert.deepEqual(
        await cliente.confirmarVerificacion({ llave: "K1", numero: "1", canal: "telegram" }),
        { confirmado: false, estado }
      );
    });
  }
});
