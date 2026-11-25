// La bitacora de accesos sensibles: que apunta, que NO apunta, y que se niega a servir.
//
// POR QUE EXISTE. La garantia de la bitacora es negativa -- «no hay acceso ajeno sin rastro»--, y
// una garantia negativa solo se rompe en silencio: una lectura sin entrada sigue devolviendo 200.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import AccesosSensiblesService, { entradasDeLectura, entradasDeEscritura } from "./AccesosSensiblesService.js";

const FILAS = [
  { id: 10, person_id: 7 },
  { id: 11, person_id: 1 },
  { id: 12, person_id: 8 }
];

describe("entradasDeLectura", () => {
  it("una entrada por fila AJENA; lo que el titular lee de si mismo no se apunta", () => {
    const entradas = entradasDeLectura({ actorId: 1, recurso: "datos_sensibles", tabla: "documentos_identidad", filas: FILAS });
    assert.deepEqual(entradas.map((e) => [e.titular, e.registro, e.accion]), [[7, 10, "read"], [8, 12, "read"]]);
  });

  it("un recurso que no es sensible no deja rastro", () => {
    assert.deepEqual(entradasDeLectura({ actorId: 1, recurso: "people", tabla: "persons", filas: FILAS }), []);
  });

  it("sin actor conocido se apunta TODO: la duda va del lado del rastro", () => {
    assert.equal(entradasDeLectura({ actorId: undefined, recurso: "datos_sensibles", tabla: "x", filas: FILAS }).length, 3);
  });

  it("una fila sensible sin titular NO se sirve en silencio", () => {
    assert.throws(
      () => entradasDeLectura({ actorId: 1, recurso: "datos_sensibles", tabla: "documentos_identidad", filas: [{ id: 3 }] }),
      /no trae person_id/
    );
  });

  it("en una tabla 1:1 el registro es el propio titular", () => {
    const [entrada] = entradasDeLectura({ actorId: 1, recurso: "datos_sensibles", tabla: "persona_autoidentificacion", filas: [{ person_id: 9 }] });
    assert.equal(entrada.registro, 9);
  });
});

describe("entradasDeEscritura", () => {
  it("apunta los NOMBRES de los campos, nunca sus valores", () => {
    const entradas = entradasDeEscritura({
      recurso: "datos_sensibles",
      tabla: "persona_autoidentificacion",
      accion: "update",
      fila: { person_id: 4, genero_id: 2, autoidentificacion_etnica_id: 5 },
      campos: ["genero_id", "person_id", "genero_id", "autoidentificacion_etnica_id"]
    });
    assert.deepEqual(entradas, [{
      titular: 4,
      registro: 4,
      accion: "update",
      detalle: { campos: ["autoidentificacion_etnica_id", "genero_id"] }
    }]);
  });

  it("la escritura del propio titular SI se apunta", () => {
    const entradas = entradasDeEscritura({ recurso: "datos_sensibles", tabla: "documentos_identidad", accion: "delete", fila: { id: 3, person_id: 1 } });
    assert.equal(entradas.length, 1);
  });

  it("fuera de lo sensible, nada", () => {
    assert.deepEqual(entradasDeEscritura({ recurso: "people", tabla: "persons", accion: "update", fila: { id: 1 } }), []);
  });
});

describe("registrar", () => {
  const servicioCon = () => {
    const consultas = [];
    const servicio = new AccesosSensiblesService({
      query: async (sql, params) => {
        consultas.push({ sql, params });
        return [[]];
      }
    });
    return { servicio, consultas };
  };

  it("UNA sentencia con ocho valores por entrada", async () => {
    const { servicio, consultas } = servicioCon();
    const apuntadas = await servicio.registrarLectura({
      actorId: 1, recurso: "datos_sensibles", tabla: "documentos_identidad", ip: "10.0.0.1", filas: FILAS
    });
    assert.equal(apuntadas, 2);
    assert.equal(consultas.length, 1);
    assert.match(consultas[0].sql, /INSERT INTO accesos_sensibles/);
    assert.equal(consultas[0].params.length, 16);
    assert.deepEqual(consultas[0].params.slice(0, 8), [7, 1, "datos_sensibles", "documentos_identidad", 10, "read", null, "10.0.0.1"]);
  });

  it("sin entradas no toca la base", async () => {
    const { servicio, consultas } = servicioCon();
    await servicio.registrarLectura({ actorId: 7, recurso: "datos_sensibles", tabla: "x", filas: [{ id: 1, person_id: 7 }] });
    assert.equal(consultas.length, 0);
  });
});
