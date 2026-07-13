// Tests de los helpers puros de TaskGenerationService.
//
// El fichero de 2006 L no tenía NINGÚN test. Estas dos funciones son decisiones de
// política del motor de generación (qué unidad aplica a un paso, a cuántas personas se
// reparte una regla), y una rama mal puesta aquí asigna tareas a quien no toca.
//
// Ver docs/auditoria-refactor-2026-07.md

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveScopeForStep,
  applyRecipientPolicy
} from "./TaskGenerationService.primitives.js";

// --- resolveScopeForStep ---

test("resolveScopeForStep: por defecto el ámbito es context_exact y hereda la unidad del contexto", () => {
  const scope = resolveScopeForStep({}, { scope_unit_id: 8 });
  assert.equal(scope.unitScopeType, "context_exact");
  assert.equal(scope.unitId, 8, "sin unit_id propio, hereda la del contexto");
  assert.equal(scope.unitTypeId, null);
});

test("resolveScopeForStep: el unit_id del paso MANDA sobre el del contexto", () => {
  const scope = resolveScopeForStep({ unit_id: 3 }, { scope_unit_id: 8 });
  assert.equal(scope.unitId, 3, "lo declarado en el paso gana");
});

test("resolveScopeForStep: los ámbitos context_* heredan del contexto", () => {
  for (const t of ["context_exact", "context_subtree", "context_ancestor_type"]) {
    const scope = resolveScopeForStep({ unit_scope_type: t }, { scope_unit_id: 5 });
    assert.equal(scope.unitId, 5, `${t} debe heredar la unidad del contexto`);
  }
});

test("resolveScopeForStep: un ámbito NO context_* no hereda la unidad del contexto", () => {
  const scope = resolveScopeForStep({ unit_scope_type: "all_units" }, { scope_unit_id: 5 });
  assert.equal(scope.unitId, null, "all_units no debe heredar la unidad");
});

test("resolveScopeForStep: unit_type hereda el tipo de unidad del contexto", () => {
  const scope = resolveScopeForStep({ unit_scope_type: "unit_type" }, { scope_unit_type_id: 2 });
  assert.equal(scope.unitTypeId, 2);

  const propio = resolveScopeForStep({ unit_scope_type: "unit_type", unit_type_id: 9 }, { scope_unit_type_id: 2 });
  assert.equal(propio.unitTypeId, 9, "lo declarado en el paso gana");
});

test("resolveScopeForStep tolera paso y contexto vacíos", () => {
  const scope = resolveScopeForStep(null, null);
  assert.deepEqual(scope, { unitScopeType: "context_exact", unitId: null, unitTypeId: null });
});

// --- applyRecipientPolicy ---

const rows = [
  { position_id: 1, unit_id: 10 },
  { position_id: 2, unit_id: 10 },
  { position_id: 3, unit_id: 20 },
];

test("applyRecipientPolicy: sin filas, no hay destinatarios", () => {
  assert.deepEqual(applyRecipientPolicy([], "all"), []);
});

test("applyRecipientPolicy: exact_position se queda con UNA sola fila", () => {
  assert.deepEqual(applyRecipientPolicy(rows, "exact_position"), [rows[0]]);
});

test("applyRecipientPolicy: un exactPositionId fuerza una sola fila aunque la política sea otra", () => {
  assert.deepEqual(applyRecipientPolicy(rows, "all", 7), [rows[0]]);
});

test("applyRecipientPolicy: one_per_unit deja una fila por unidad (la primera)", () => {
  assert.deepEqual(applyRecipientPolicy(rows, "one_per_unit"), [rows[0], rows[2]]);
});

test("applyRecipientPolicy: cualquier otra política devuelve TODAS las filas", () => {
  assert.deepEqual(applyRecipientPolicy(rows, "all"), rows);
  assert.deepEqual(applyRecipientPolicy(rows, undefined), rows);
});
