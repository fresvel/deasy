// Tests unitarios del versionado de plantillas.
//
// Un fallo aquí hace que dos versiones colisionen o que una versión retroceda,
// y el sistema de plantillas se apoya en que la versión sea monótona.

import test from "node:test";
import assert from "node:assert/strict";

import { bumpSemanticVersion, normalizeItemMode } from "./versioning.js";

test("bumpSemanticVersion incrementa el segmento pedido y pone a cero los menores", () => {
  assert.equal(bumpSemanticVersion("1.2.3", "major"), "2.0.0");
  assert.equal(bumpSemanticVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(bumpSemanticVersion("1.2.3", "patch"), "1.2.4");
});

test("bumpSemanticVersion usa minor por defecto", () => {
  assert.equal(bumpSemanticVersion("1.2.3"), "1.3.0");
});

test("bumpSemanticVersion trata un nivel desconocido como minor", () => {
  assert.equal(bumpSemanticVersion("1.2.3", "gigante"), "1.3.0");
  assert.equal(bumpSemanticVersion("1.2.3", null), "1.3.0");
});

test("bumpSemanticVersion arranca en 1.0.0 si la versión actual no es semver", () => {
  assert.equal(bumpSemanticVersion("", "minor"), "1.0.0");
  assert.equal(bumpSemanticVersion(null, "major"), "1.0.0");
  assert.equal(bumpSemanticVersion("v1", "patch"), "1.0.0");
  // Dos segmentos no bastan: el contrato exige tres.
  assert.equal(bumpSemanticVersion("1.2", "patch"), "1.0.0");
});

test("bumpSemanticVersion recorta espacios alrededor de la versión", () => {
  assert.equal(bumpSemanticVersion("  1.2.3  ", "patch"), "1.2.4");
});

test("bumpSemanticVersion no desborda al pasar de 9", () => {
  assert.equal(bumpSemanticVersion("1.9.9", "minor"), "1.10.0");
});

test("normalizeItemMode acepta los tres modos de emisión", () => {
  assert.equal(normalizeItemMode("single"), "single");
  assert.equal(normalizeItemMode("replicated"), "replicated");
  assert.equal(normalizeItemMode("routed"), "routed");
});

test("normalizeItemMode cae a 'single' ante un modo desconocido o vacío", () => {
  assert.equal(normalizeItemMode(""), "single");
  assert.equal(normalizeItemMode(null), "single");
  assert.equal(normalizeItemMode(undefined), "single");
  assert.equal(normalizeItemMode("ROUTED"), "single", "es sensible a mayúsculas");
});
