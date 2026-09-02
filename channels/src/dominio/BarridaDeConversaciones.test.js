import assert from "node:assert/strict";
import { describe, it } from "node:test";

import BarridaDeConversaciones from "./BarridaDeConversaciones.js";

const HORA = 3600_000;
const AHORA = 1_000_000_000_000;

const chat = (numero, { grupo = false, hace = 2 * HORA } = {}) => ({
  borrado: false,
  isGroup: grupo,
  id: { _serialized: grupo ? `${numero}@g.us` : `${numero}@c.us` },
  timestamp: (AHORA - hace) / 1000,
  async delete() { this.borrado = true; },
});

const barrida = (chats, verificados) =>
  new BarridaDeConversaciones({
    cliente: { async getChats() { return chats; } },
    deasy: { async numerosVerificados() { return verificados; } },
    ahora: () => AHORA,
  });

describe("BarridaDeConversaciones", () => {
  it("conserva a quien verificó y borra a quien no", async () => {
    const bueno = chat("593999111222");
    const desconocido = chat("593988000111");

    const r = await barrida([bueno, desconocido], new Set(["593999111222"])).unaPasada();

    assert.equal(bueno.borrado, false, "tiene base legal: se queda");
    assert.equal(desconocido.borrado, true, "nunca consintió nada: no hay base para guardarlo");
    assert.equal(r.borradas, 1);
  });

  it("NO toca los grupos", async () => {
    // En un grupo el identificador es el GRUPO, no una persona: esta regla no le aplica, y el canal
    // ya los ignora al recibir.
    const grupo = chat("120363000", { grupo: true });
    await barrida([grupo], new Set()).unaPasada();
    assert.equal(grupo.borrado, false);
  });

  it("NO toca una conversación recién abierta — alguien puede estar verificándose AHORA", async () => {
    // Quien está mandando su llave en este momento todavía no figura como verificado. Sin la gracia,
    // la barrida le borraría el mensaje mientras lo escribe.
    const enCurso = chat("593977000000", { hace: 30_000 });
    await barrida([enCurso], new Set()).unaPasada();
    assert.equal(enCurso.borrado, false);
  });

  it("🔴 si el backend NO contesta, no se borra NADA", async () => {
    // `null` es «no lo sé». Tratarlo como «ninguno verificó» borraría TODAS las conversaciones de
    // golpe por un fallo de red — y el borrado se sincroniza al teléfono: es irreversible.
    const uno = chat("593999111222");
    const otro = chat("593988000111");

    const r = await new BarridaDeConversaciones({
      cliente: { async getChats() { return [uno, otro]; } },
      deasy: { async numerosVerificados() { return null; } },
      ahora: () => AHORA,
    }).unaPasada();

    assert.equal(uno.borrado, false);
    assert.equal(otro.borrado, false);
    assert.equal(r.motivo, "sin_respuesta_del_backend");
  });

  it("si una falla al borrarse, las demás siguen", async () => {
    const rota = chat("593911111111");
    rota.delete = async () => { throw new Error("la sesión se cayó"); };
    const normal = chat("593922222222");

    const antes = console.error;
    console.error = () => {};
    const r = await barrida([rota, normal], new Set()).unaPasada();
    console.error = antes;

    assert.equal(normal.borrado, true, "una conversación no puede bloquear a las demás");
    assert.equal(r.borradas, 1);
  });

  it("sin conversaciones que revisar, no pregunta al backend", async () => {
    let pregunto = false;
    const r = await new BarridaDeConversaciones({
      cliente: { async getChats() { return []; } },
      deasy: { async numerosVerificados() { pregunto = true; return new Set(); } },
      ahora: () => AHORA,
    }).unaPasada();

    assert.equal(pregunto, false, "preguntar por una lista vacía es una ida y vuelta para nada");
    assert.equal(r.borradas, 0);
  });
});
