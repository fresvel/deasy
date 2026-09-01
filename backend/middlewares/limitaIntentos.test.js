import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { limitaIntentos, limitaYCuenta, sujetoDe } from "./limitaIntentos.js";
import { SUJETOS } from "../services/limites/reglas.js";

const respuestaFalsa = () => ({
  cabeceras: {},
  codigo: null,
  cuerpo: null,
  set(k, v) { this.cabeceras[k] = v; return this; },
  status(c) { this.codigo = c; return this; },
  json(b) { this.cuerpo = b; return this; },
});

const limitadorFalso = ({ permitido = true, reintentarEn = 30, reglas }) => ({
  reglas,
  registrados: [],
  async comprobar() { return { permitido, reintentarEn }; },
  async registrar(accion, sujeto) { this.registrados.push({ accion, sujeto }); },
});

const REGLAS = { login: { ventanaSegundos: 900, tope: 3, sujeto: SUJETOS.CORREO_E_IP } };

describe("sujetoDe", () => {
  it("por IP, la IP", () => {
    assert.equal(sujetoDe({ ip: "1.2.3.4" }, SUJETOS.IP), "1.2.3.4");
  });

  it("por correo+ip, los DOS: es lo que impide bloquear una cuenta ajena", () => {
    const req = { ip: "1.2.3.4", body: { email: "ana@x.ec" } };
    assert.equal(sujetoDe(req, SUJETOS.CORREO_E_IP), "ana@x.ec|1.2.3.4");
  });

  it("el correo se normaliza a minúsculas, o alternar mayúsculas daría intentos gratis", () => {
    const a = sujetoDe({ ip: "1.2.3.4", body: { email: "Ana@X.ec" } }, SUJETOS.CORREO_E_IP);
    const b = sujetoDe({ ip: "1.2.3.4", body: { email: "ana@x.ec" } }, SUJETOS.CORREO_E_IP);
    assert.equal(a, b);
  });

  it("sin correo cae a la IP sola, en vez de contar todo en un cubo vacío", () => {
    assert.equal(sujetoDe({ ip: "1.2.3.4", body: {} }, SUJETOS.CORREO_E_IP), "1.2.3.4");
  });

  it("por persona, el id de quien va autenticado — no dónde está", () => {
    assert.equal(sujetoDe({ ip: "1.2.3.4", user: { uid: 55 } }, SUJETOS.PERSONA), "55");
  });
});

describe("limitaIntentos", () => {
  it("deja pasar y NO cuenta nada por su cuenta: contar es del controlador", async () => {
    const limitador = limitadorFalso({ permitido: true, reglas: REGLAS });
    const req = { ip: "1.1.1.1", body: { email: "ana@x.ec" } };
    let siguio = false;

    await limitaIntentos("login", { limitador })(req, respuestaFalsa(), () => { siguio = true; });

    assert.equal(siguio, true);
    assert.deepEqual(limitador.registrados, [], "un acierto no puede castigar a quien trabaja");
    assert.equal(typeof req.anotarIntentoFallido, "function", "y el controlador tiene con qué contar el fallo");
  });

  it("al frenar responde 429 CON Retry-After, y no llama a lo de detrás", async () => {
    const limitador = limitadorFalso({ permitido: false, reintentarEn: 30, reglas: REGLAS });
    const res = respuestaFalsa();
    let siguio = false;

    await limitaIntentos("login", { limitador })({ ip: "1.1.1.1", body: {} }, res, () => { siguio = true; });

    assert.equal(siguio, false, "lo caro va DETRÁS: si sigue, no ha protegido de nada");
    assert.equal(res.codigo, 429);
    assert.equal(res.cabeceras["Retry-After"], "30", "sin esto, un reintento automático machaca en bucle");
    assert.equal(res.cuerpo.reintentarEn, 30);
  });

  it("una acción sin regla ni se mira", async () => {
    const limitador = limitadorFalso({ permitido: false, reglas: REGLAS });
    let siguio = false;
    await limitaIntentos("no_existe", { limitador })({ ip: "1.1.1.1" }, respuestaFalsa(), () => { siguio = true; });
    assert.equal(siguio, true);
  });
});

describe("limitaYCuenta", () => {
  it("cuenta SIEMPRE, porque en esas rutas la petición ya costó aunque salga bien", async () => {
    const limitador = limitadorFalso({ permitido: true, reglas: REGLAS });
    await limitaYCuenta("login", { limitador })({ ip: "1.1.1.1", body: { email: "ana@x.ec" } }, respuestaFalsa(), () => {});
    assert.equal(limitador.registrados.length, 1);
  });
});
