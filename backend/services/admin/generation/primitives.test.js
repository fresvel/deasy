// Tests de los helpers puros de TaskGenerationService.
//
// El fichero de 2006 L no tenía NINGÚN test. Estas dos funciones son decisiones de
// política del motor de generación (qué unidad aplica a un paso, a cuántas personas se
// reparte una regla), y una rama mal puesta aquí asigna tareas a quien no toca.
//
// Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md

import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveScopeForStep,
  applyRecipientPolicy
} from "./primitives.js";

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

test("resolveScopeForStep: context_exact hereda la unidad del contexto", () => {
  const scope = resolveScopeForStep({ unit_scope_type: "context_exact" }, { scope_unit_id: 5 });
  assert.equal(scope.unitId, 5, "context_exact debe heredar la unidad del contexto");
});

// Los otros dos `context_*` salieron del `CHECK` de la columna en el sub-paso 8 del §0.8: la base
// rechaza la fila, así que un paso de ENTREGA no puede llevarlos. Este test fija que ya NO heredan —
// si alguien vuelve a nombrarlos aquí, el ámbito volvería a resolverse para un valor imposible.
test("resolveScopeForStep: los context_* retirados ya no heredan la unidad del contexto", () => {
  for (const t of ["context_subtree", "context_ancestor_type"]) {
    const scope = resolveScopeForStep({ unit_scope_type: t }, { scope_unit_id: 5 });
    assert.equal(scope.unitId, null, `${t} está fuera del CHECK y no debe heredar`);
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

test("applyRecipientPolicy: unit_head deja SOLO las jefaturas, no la primera fila", () => {
  // La prueba vieja fijaba `one_per_unit` con `[rows[0], rows[2]]` — o sea, la PRIMERA de cada
  // unidad. Eso era el defecto: el orden lo daba `slot_no` y ninguna etiqueta prometia eso.
  assert.deepEqual(
    applyRecipientPolicy(rows.map((r, i) => ({ ...r, is_unit_head: i === 1 ? 1 : 0 })), "unit_head"),
    [{ ...rows[1], is_unit_head: 1 }]
  );
});

test("applyRecipientPolicy: cualquier otra política devuelve TODAS las filas", () => {
  assert.deepEqual(applyRecipientPolicy(rows, "all"), rows);
  assert.deepEqual(applyRecipientPolicy(rows, undefined), rows);
});


test("applyRecipientPolicy: una unidad SIN jefatura se queda fuera, no se inventa un sustituto", () => {
  // Hoy pasa en 2 de 13 unidades. Elegir «el primero» era exactamente el fallo que se cerro.
  assert.deepEqual(applyRecipientPolicy(rows.map((r) => ({ ...r, is_unit_head: 0 })), "unit_head"), []);
});

test("applyRecipientPolicy: `one_per_unit` ya no significa nada y cae al comportamiento de `todas`", () => {
  // No se le da un trato especial a proposito: el valor desaparecio del CHECK, asi que una regla
  // que lo llevara ya no puede existir. Si apareciera, es mejor que devuelva de mas y se vea, a
  // que devuelva «la primera» y nadie lo note.
  assert.deepEqual(applyRecipientPolicy(rows, "one_per_unit"), rows);
});
