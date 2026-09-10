import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { tablasLegibles } from "./tablasLegibles.js";

const TABLAS = [{ table: "persons" }, { table: "documentos_identidad" }, { table: "tabla_sin_recurso" }];
const conPermisos = (permisos) => (_access, recurso, accion) => permisos.includes(`${recurso}.${accion}`);

describe("tablasLegibles", () => {
  it("cada tabla viaja con el recurso que la protege", () => {
    const [persons] = tablasLegibles(TABLAS, null, conPermisos(["people.read"]));
    assert.deepEqual(persons, { table: "persons", resource: "people" });
  });

  it("solo salen las que se pueden leer", () => {
    assert.deepEqual(tablasLegibles(TABLAS, null, conPermisos(["people.read"])).map((t) => t.table), ["persons"]);
  });

  it("una tabla sin recurso no sale ni a quien lo puede todo", () => {
    assert.deepEqual(tablasLegibles(TABLAS, null, () => true).map((t) => t.table), ["persons", "documentos_identidad"]);
  });
});
