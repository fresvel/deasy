import test from "node:test";
import assert from "node:assert/strict";
import { agruparPor, conSusSucesores } from "./sucesores.js";

test("cada vida recibe sus sucesores, y la que no tiene, una lista vacía", () => {
  const vidas = [{ id: 1, vigente_hasta: "2026-12-01" }, { id: 2, vigente_hasta: null }];
  const equivalencias = [
    { id: 10, antecesor_vigencia_id: 1, nodo_id: 7, nombre: "B" },
    { id: 11, antecesor_vigencia_id: 1, nodo_id: 8, nombre: "C" }
  ];
  assert.deepEqual(conSusSucesores(vidas, equivalencias), [
    { id: 1, vigente_hasta: "2026-12-01", sucesores: [{ id: 10, nodo_id: 7, nombre: "B" }, { id: 11, nodo_id: 8, nombre: "C" }] },
    { id: 2, vigente_hasta: null, sucesores: [] }
  ]);
});

test("sin vidas o sin equivalencias no revienta", () => {
  assert.deepEqual(conSusSucesores(undefined, undefined), []);
  assert.deepEqual(conSusSucesores([{ id: 1 }], undefined), [{ id: 1, sucesores: [] }]);
});

test("agruparPor conserva el orden de llegada dentro de cada grupo", () => {
  const grupos = agruparPor([{ k: "a", n: 1 }, { k: "b", n: 2 }, { k: "a", n: 3 }], "k");
  assert.deepEqual(grupos.get("a").map((f) => f.n), [1, 3]);
  assert.equal(grupos.get("c"), undefined);
});
