import { describe, it } from "node:test";
import assert from "node:assert/strict";

import VigilanteDeCanales from "./VigilanteDeCanales.js";

const MINUTO = 60_000;

const bitacoraFalsa = (abiertos = []) => ({
  cambios: [],
  avisados: [],
  async abiertos() { return new Map(abiertos.map((t) => [t.canal, t])); },
  async cambio(canal, estado) { this.cambios.push({ canal, ...estado }); },
  async marcarAvisado(id) { this.avisados.push(id); },
});

const avisadorFalso = () => ({
  avisos: [],
  async canalCaido(a) { this.avisos.push(a); },
});

const vigilante = ({ estado, bitacora, avisador, ahora = () => 0 }) =>
  new VigilanteDeCanales({
    cliente: { async estado() { return estado; } },
    bitacora,
    avisador,
    ahora,
  });

describe("VigilanteDeCanales · qué anota", () => {
  it("anota un cambio de estado, y NO anota si sigue igual", async () => {
    const bitacora = bitacoraFalsa([
      { id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() },
      { id: 2, canal: "telegram", salud: "sano", desde: new Date(0).toISOString() },
    ]);
    const v = vigilante({
      bitacora,
      estado: { alcanzable: true, canales: [
        { nombre: "telegram", salud: "caido", detalle: "el sondeo falla" },
      ] },
    });

    await v.unaVuelta();

    assert.deepEqual(bitacora.cambios.map((c) => [c.canal, c.salud]), [["telegram", "caido"]],
      "sólo telegram cambió; anotar «servicio: sano» otra vez serían 1 440 filas al día por nada");
  });

  it("un SERVICIO que no contesta se anota como estado, no se ignora", async () => {
    // Es el caso de las trece horas: sin esta fila, un servicio muerto se ve como «no ha cambiado
    // nada» — que es exactamente el silencio que esta tarea existe para romper.
    const bitacora = bitacoraFalsa([{ id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() }]);
    const v = vigilante({ bitacora, estado: { alcanzable: false, error: "ECONNREFUSED" } });

    await v.unaVuelta();

    assert.equal(bitacora.cambios[0].canal, "servicio");
    assert.equal(bitacora.cambios[0].salud, "caido");
    assert.match(bitacora.cambios[0].detalle, /ECONNREFUSED/);
  });
});

describe("VigilanteDeCanales · cuándo avisa — las tres trampas", () => {
  const caido = (desdeMs, avisado = null) => ({
    id: 7, canal: "telegram", salud: "caido", desde: new Date(desdeMs).toISOString(), avisado_at: avisado,
  });
  const estadoCaido = { alcanzable: true, canales: [{ nombre: "telegram", salud: "caido", detalle: "x" }] };

  it("NO avisa antes del umbral: un arranque no es una caída", async () => {
    // Sin esto, CADA DESPLIEGUE mandaría una alerta — al arrancar todo parece caído unos segundos.
    const avisador = avisadorFalso();
    const v = vigilante({
      bitacora: bitacoraFalsa([caido(0), { id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() }]),
      estado: estadoCaido, avisador, ahora: () => 4 * MINUTO,
    });

    await v.unaVuelta();

    assert.deepEqual(avisador.avisos, [], "cuatro minutos aún no son cinco");
  });

  it("avisa al pasar el umbral, diciendo CUÁNTO lleva", async () => {
    const avisador = avisadorFalso();
    const bitacora = bitacoraFalsa([caido(0), { id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() }]);
    const v = vigilante({ bitacora, estado: estadoCaido, avisador, ahora: () => 6 * MINUTO });

    await v.unaVuelta();

    assert.equal(avisador.avisos.length, 1);
    assert.equal(avisador.avisos[0].canal, "telegram");
    assert.equal(avisador.avisos[0].minutos, 6);
    assert.deepEqual(bitacora.avisados, [7], "queda marcado para no repetirlo");
  });

  it("NO avisa dos veces del mismo tramo — la tormenta de avisos", async () => {
    // Sin `avisado_at`, un canal caído mandaría un correo POR VUELTA: sesenta en una hora. Y un
    // vigilante que avisa de más deja de leerse.
    const avisador = avisadorFalso();
    const v = vigilante({
      bitacora: bitacoraFalsa([caido(0, new Date(6 * MINUTO).toISOString()),
                               { id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() }]),
      estado: estadoCaido, avisador, ahora: () => 30 * MINUTO,
    });

    await v.unaVuelta();

    assert.deepEqual(avisador.avisos, []);
  });

  it("un canal SANO no dispara nada, lleve lo que lleve", async () => {
    const avisador = avisadorFalso();
    const v = vigilante({
      bitacora: bitacoraFalsa([
        { id: 3, canal: "telegram", salud: "sano", desde: new Date(0).toISOString() },
        { id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() },
      ]),
      estado: { alcanzable: true, canales: [{ nombre: "telegram", salud: "sano" }] },
      avisador, ahora: () => 99 * MINUTO,
    });

    await v.unaVuelta();

    assert.deepEqual(avisador.avisos, []);
  });

  it("«sin vincular» SÍ avisa: es una tarea pendiente de una persona", async () => {
    const avisador = avisadorFalso();
    const v = vigilante({
      bitacora: bitacoraFalsa([
        { id: 9, canal: "whatsapp", salud: "sin_vincular", desde: new Date(0).toISOString(), avisado_at: null },
        { id: 1, canal: "servicio", salud: "sano", desde: new Date(0).toISOString() },
      ]),
      estado: { alcanzable: true, canales: [{ nombre: "whatsapp", salud: "sin_vincular", detalle: "esperando QR" }] },
      avisador, ahora: () => 10 * MINUTO,
    });

    await v.unaVuelta();

    assert.equal(avisador.avisos.length, 1, "nadie va a escanear un QR que no sabe que existe");
  });
});
