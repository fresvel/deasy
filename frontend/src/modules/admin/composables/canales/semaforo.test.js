import { describe, expect, it } from "vitest";

import { TONOS } from "@/shared/utils/estadoTono";

import { desdeHace, explicacionDe, tonoDe } from "./semaforo.js";

describe("tonoDe · la regla que sostiene la pantalla", () => {
  it("NUNCA pinta verde con `evidencia: afirmacion`, aunque la salud diga «sano»", () => {
    // Es EXACTAMENTE lo que decía el canal muerto del 2026-08-31: la bandera interna sólo
    // significaba «arranqué y nadie me paró». Un verde aquí daría por sano un canal muerto, y con la
    // autoridad de un semáforo.
    expect(tonoDe({ salud: "sano", evidencia: "afirmacion" })).toBe(TONOS.WARNING);
  });

  it("verde sólo con una prueba detrás", () => {
    expect(tonoDe({ salud: "sano", evidencia: "sondeo" })).toBe(TONOS.SUCCESS);
    expect(tonoDe({ salud: "sano", evidencia: "plataforma" })).toBe(TONOS.SUCCESS);
  });

  it("bloqueado y caído son rojos: los dos piden que alguien actúe", () => {
    expect(tonoDe({ salud: "bloqueado", evidencia: "plataforma" })).toBe(TONOS.DANGER);
    expect(tonoDe({ salud: "caido", evidencia: "afirmacion" })).toBe(TONOS.DANGER);
  });

  it("«sin vincular» es ámbar, no rojo: es una tarea pendiente, no una avería", () => {
    expect(tonoDe({ salud: "sin_vincular" })).toBe(TONOS.WARNING);
  });

  it("sin canal, gris — no se inventa un color", () => {
    expect(tonoDe(null)).toBe(TONOS.NEUTRAL);
    expect(tonoDe({ salud: "desconocido" })).toBe(TONOS.NEUTRAL);
  });
});

describe("explicacionDe · lo que se dice, que a veces importa más que el color", () => {
  it("un bloqueo AVISA de que no se arregla reiniciando", () => {
    const texto = explicacionDe({ salud: "bloqueado", estadoPlataforma: "TOS_BLOCK" });
    expect(texto).toMatch(/TOS_BLOCK/);
    expect(texto).toMatch(/NO se arregla reiniciando/);
  });

  it("con sólo la afirmación, se dice LITERALMENTE que no está confirmado", () => {
    // Callarlo es lo que convierte una suposición en un hecho a ojos de quien mira.
    expect(explicacionDe({ salud: "sano", evidencia: "afirmacion" }))
      .toMatch(/no se ha podido confirmar/i);
  });

  it("de WhatsApp NO se promete que reciba, ni con la plataforma confirmada", () => {
    // La sesión puede estar CONNECTED y aun así no entregar un mensaje: pasó el 2026-09-01 con @lid.
    const texto = explicacionDe({ nombre: "whatsapp", salud: "sano", evidencia: "plataforma" });
    expect(texto).toMatch(/no se puede comprobar/i);
    expect(texto).not.toMatch(/funciona correctamente/i);
  });

  it("de Telegram SÍ se puede afirmar la recepción: el sondeo ES la recepción", () => {
    expect(explicacionDe({ nombre: "telegram", salud: "sano", evidencia: "sondeo" }))
      .toMatch(/si llega un mensaje, se recibe/i);
  });
});

describe("desdeHace", () => {
  const ahora = new Date("2026-09-02T12:00:00.000Z").getTime();

  it("sin dato devuelve null, y eso también es información", () => {
    expect(desdeHace(null, ahora)).toBeNull();
  });

  it("distingue un minuto de trece horas, que es para lo que existe", () => {
    expect(desdeHace("2026-09-02T11:59:00.000Z", ahora)).toBe("hace 1 min");
    expect(desdeHace("2026-09-01T23:00:00.000Z", ahora)).toBe("hace 13 h");
  });

  it("y días cuando pasa de dos", () => {
    expect(desdeHace("2026-08-30T12:00:00.000Z", ahora)).toBe("hace 3 días");
  });
});
