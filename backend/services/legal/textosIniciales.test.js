import test from "node:test";
import assert from "node:assert/strict";
import { textosIniciales, VERSION_INICIAL } from "./textosIniciales.js";
import { CLASES } from "./DocumentosLegales.js";

test("hay un texto de partida por cada clase conocida, y ninguno vacio", () => {
  const textos = textosIniciales();
  assert.deepEqual(textos.map((t) => t.clase).sort(), Object.values(CLASES).sort());
  for (const { clase, version, texto } of textos) {
    assert.equal(version, VERSION_INICIAL);
    assert.ok(texto.trim().length > 500, `${clase} trae texto de verdad`);
  }
});

test("terminos_de_uso son los 2025 caracteres que afirma el golden de caracterizacion", () => {
  const terminos = textosIniciales().find((t) => t.clase === CLASES.TERMINOS);
  assert.equal(terminos.texto.length, 2025);
});
