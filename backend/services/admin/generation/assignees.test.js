// Fija el CATÁLOGO de responsables que el camino de ENTREGA sabe resolver, tras el cierre del §0.6.
//
// Por qué existe este fichero: los `case` de `document_owner`, `position` y `manual_pick` se
// retiraron de `resolveFillStepAssignees` porque el `CHECK` de `fill_flow_steps.resolver_type` los
// rechaza desde el sub-paso 8 del §0.8. La caracterización no puede vigilar eso —no hay forma de
// meter una fila con un tipo retirado, que es justo el motivo de la retirada—, así que el único
// guardián posible es unitario: si alguien vuelve a injertar uno de esos `case`, estos tests caen.
//
// Todos usan `connection = null` a propósito: los tipos que aquí se comprueban devuelven sin tocar
// la base. Que no reviente al pasarle `null` ES parte de lo que se afirma.
import test from "node:test";
import assert from "node:assert/strict";

import { resolveFillStepAssignees } from "./assignees.js";

// El contexto trae CEBOS para los tres tipos retirados: si alguno reviviera, resolvería a alguien
// y el test lo cazaría por el valor devuelto, no por una excepción.
const CONTEXTO = {
  owner_person_id: 11,              // cebo de `document_owner`
  task_item_assigned_person_id: 22,
  item_created_by_person_id: 33,   // la reserva: quien ENCARGO el entregable
  scope_unit_id: 44
};

test("resolveFillStepAssignees: `task_assignee` prefiere el responsable del entregable", async () => {
  const personas = await resolveFillStepAssignees(null, { resolver_type: "task_assignee" }, CONTEXTO);
  assert.deepEqual(personas, [22]);
});

test("resolveFillStepAssignees: `task_assignee` cae a quien ENCARGO el entregable si no hay responsable", async () => {
  // La reserva era `tasks.created_by_user_id`, retirado el 2026-08-23: estaba NULL en 12 de 13
  // tareas, asi que como reserva casi nunca respondia. Ahora sale del propio entregable.
  const personas = await resolveFillStepAssignees(
    null,
    { resolver_type: "task_assignee" },
    { ...CONTEXTO, task_item_assigned_person_id: null }
  );
  assert.deepEqual(personas, [33]);
});

test("resolveFillStepAssignees: `specific_person` devuelve la persona fijada en el paso", async () => {
  const personas = await resolveFillStepAssignees(
    null,
    { resolver_type: "specific_person", assigned_person_id: 7 },
    CONTEXTO
  );
  assert.deepEqual(personas, [7]);
});

test("resolveFillStepAssignees: `specific_person` sin persona no resuelve a nadie", async () => {
  const personas = await resolveFillStepAssignees(null, { resolver_type: "specific_person" }, CONTEXTO);
  assert.deepEqual(personas, []);
});

// EL TEST QUE IMPORTA. `document_owner` es el más delicado de los tres: el contexto SÍ trae
// `owner_person_id`, así que reponer el `case` haría que este paso resolviera a la persona 11 en vez
// de a nadie. Los otros dos no tienen ni columna que consultar sin base.
test("resolveFillStepAssignees: los tres resolutores RETIRADOS no resuelven a nadie", async () => {
  for (const retirado of ["document_owner", "position", "manual_pick"]) {
    const personas = await resolveFillStepAssignees(
      null,
      { resolver_type: retirado, position_id: 5, selection_mode: "auto_one" },
      CONTEXTO
    );
    assert.deepEqual(
      personas,
      [],
      `"${retirado}" salió del CHECK de fill_flow_steps: ningún paso de entrega puede llevarlo`
    );
  }
});

test("resolveFillStepAssignees: un tipo desconocido cae al `default` y no revienta", async () => {
  const personas = await resolveFillStepAssignees(null, { resolver_type: "inventado" }, CONTEXTO);
  assert.deepEqual(personas, []);
});

test("resolveFillStepAssignees: sin paso o sin contexto devuelve la lista vacía", async () => {
  assert.deepEqual(await resolveFillStepAssignees(null, null, CONTEXTO), []);
  assert.deepEqual(await resolveFillStepAssignees(null, { resolver_type: "task_assignee" }, null), []);
});

// `cargo_in_scope` sigue vivo, y es el único que llega a consultar la base. Aquí solo se comprueba
// el atajo de antes de la consulta —un paso por cargo SIN cargo no resuelve a nadie—, que también
// devuelve sin tocar `connection`.
test("resolveFillStepAssignees: `cargo_in_scope` sin cargo corta antes de consultar la base", async () => {
  const personas = await resolveFillStepAssignees(null, { resolver_type: "cargo_in_scope" }, CONTEXTO);
  assert.deepEqual(personas, []);
});
