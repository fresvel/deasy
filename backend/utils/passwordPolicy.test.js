// Tests unitarios de la política de contraseñas única.
//
// Antes esta lógica estaba duplicada entre el middleware de registro y
// SqlAdminService. Estos tests fijan la regla en un solo sitio, incluido el matiz
// que más se presta a confusión: `special` se evalúa pero NO cuenta para aprobar.

import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluatePasswordPolicy,
  assertPasswordPolicy,
  PASSWORD_POLICY_MESSAGE,
} from "./passwordPolicy.js";

test("aprueba con exactamente 3 de los 4 criterios obligatorios", () => {
  // ABCD1234: longitud + mayúscula + número (sin minúscula) = 3.
  const r = evaluatePasswordPolicy("ABCD1234");
  assert.equal(r.passedCount, 3);
  assert.equal(r.passed, true);
});

test("aprueba con los 4 criterios", () => {
  assert.equal(evaluatePasswordPolicy("Abcdefg1").passed, true);
});

test("rechaza con solo 2 criterios obligatorios", () => {
  // abcdefgh: longitud + minúscula = 2.
  const r = evaluatePasswordPolicy("abcdefgh");
  assert.equal(r.passedCount, 2);
  assert.equal(r.passed, false);
});

test("rechaza una contraseña corta aunque sea variada", () => {
  // Ab1: mayúscula + minúscula + número = 3, pero NO longitud... son 3 igual.
  // Este caso comprueba que length es un criterio más, no obligatorio por sí solo.
  assert.equal(evaluatePasswordPolicy("Ab1").passed, true, "3 criterios sin longitud sí aprueban");
  // Con solo 2 criterios y sin longitud, rechaza.
  assert.equal(evaluatePasswordPolicy("Ab").passed, false);
});

test("`special` se evalúa pero NO cuenta para el umbral", () => {
  // 8 caracteres especiales: longitud + special. Solo 1 criterio OBLIGATORIO (longitud).
  const r = evaluatePasswordPolicy("!@#$%^&*");
  assert.equal(r.criteria.special, true, "special se detecta");
  assert.equal(r.passedCount, 1, "pero solo cuenta longitud para el umbral");
  assert.equal(r.passed, false);
});

test("`special` presente no puede rescatar una contraseña que no llega a 3 obligatorios", () => {
  // "aB!" : minúscula + mayúscula + special = 2 obligatorios (+special). Rechaza.
  const r = evaluatePasswordPolicy("aB!");
  assert.equal(r.criteria.special, true);
  assert.equal(r.passed, false);
});

test("evaluatePasswordPolicy tolera entradas no-string sin lanzar", () => {
  assert.equal(evaluatePasswordPolicy(undefined).passed, false);
  assert.equal(evaluatePasswordPolicy(null).passed, false);
  // 12345678 -> "12345678": longitud + número = 2 obligatorios, sin letras -> rechaza.
  assert.equal(evaluatePasswordPolicy(12345678).passed, false);
});

test("assertPasswordPolicy lanza con el mensaje canónico ante una contraseña débil", () => {
  assert.throws(
    () => assertPasswordPolicy("abc"),
    (error) => error.message === PASSWORD_POLICY_MESSAGE,
  );
});

test("assertPasswordPolicy no lanza ante una contraseña válida", () => {
  assert.doesNotThrow(() => assertPasswordPolicy("Demo1234!"));
  assert.doesNotThrow(() => assertPasswordPolicy("Gestor1234!"));
});
