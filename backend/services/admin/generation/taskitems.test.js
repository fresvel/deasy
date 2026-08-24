// Red unitaria del caso «el proceso no encuentra a NADIE a quien dirigirse».
//
// POR QUÉ EXISTE. Hasta el 2026-08-23 ese caso caía a `ensureTaskItemsForTask`, que creaba el
// entregable IGUAL pero sin puesto responsable. Nacía sin nadie que respondiera de él: no salía en
// la lista de nadie, nadie lo reclamaba, y ahí se quedaba. Y contradecía al propio lanzamiento, que
// en la misma respuesta ya declaraba `has_assignees: false`.
//
// Ese respaldo se retiró, y con él `task_items.responsible_position_id` pasó a ser NOT NULL. Pero
// la caracterización NO cubre este camino —la fixture siempre encuentra puestos—, así que la suite
// entera seguía verde con el respaldo puesto. Es el caso de manual: verde no es seguro.
import test from "node:test";
import assert from "node:assert/strict";

import { ensureTaskItemsForTaskTargets } from "./taskitems.js";

const PLANTILLA_SINGLE = { id: 3, template_artifact_id: 5, item_mode: "single", sort_order: 1 };

const conexionFalsa = () => {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/FROM tasks/i.test(sql)) return [[{ start_date: "2026-01-01", end_date: "2026-12-31" }]];
      return [[]];
    },
  };
};

const mapaDePlantillas = new Map([[7, [PLANTILLA_SINGLE]]]);

test("sin puestos a los que dirigirse NO se crea ningún entregable", async () => {
  const connection = conexionFalsa();
  const resultado = await ensureTaskItemsForTaskTargets(connection, 10, 7, mapaDePlantillas, []);

  assert.deepEqual(resultado, { inserted: 0, total: 0 }, "no debe sembrar trabajo huérfano");
  const inserciones = connection.queries.filter((q) => /INSERT INTO task_items/i.test(q.sql));
  assert.equal(inserciones.length, 0, "ha vuelto el respaldo que creaba entregables sin responsable");
});

test("con puestos, cada uno recibe su entregable Y su puesto responsable", async () => {
  const connection = conexionFalsa();
  const targets = [
    { position_id: 21, unit_id: 4, person_id: 24 },
    { position_id: 25, unit_id: 4, person_id: null },
  ];
  const resultado = await ensureTaskItemsForTaskTargets(connection, 10, 7, mapaDePlantillas, targets);

  assert.equal(resultado.inserted, 2, "un entregable por puesto");
  const inserciones = connection.queries.filter((q) => /INSERT INTO task_items/i.test(q.sql));
  assert.equal(inserciones.length, 2);
  for (const q of inserciones) {
    assert.ok(
      /responsible_position_id/.test(q.sql),
      "el INSERT debe llevar el ancla: la columna es NOT NULL y sin ella la base rechaza la fila",
    );
    // El puesto viaja en los parámetros, no interpolado: si alguien lo mete en el texto, el
    // `bindParams` del adaptador deja de cuadrar y el fallo sale en ejecución.
    assert.ok(q.params.includes(21) || q.params.includes(25), "el puesto debe viajar como parámetro");
  }
});

test("el entregable del segundo puesto NO hereda la persona del primero", async () => {
  // La fila lleva DOS datos distintos —el puesto que responde y quien lo ocupa hoy— y es fácil
  // cruzarlos al construir el bucle. Aquí el puesto 25 está vacante a propósito.
  const connection = conexionFalsa();
  await ensureTaskItemsForTaskTargets(connection, 10, 7, mapaDePlantillas, [
    { position_id: 21, unit_id: 4, person_id: 24 },
    { position_id: 25, unit_id: 4, person_id: null },
  ]);
  const inserciones = connection.queries.filter((q) => /INSERT INTO task_items/i.test(q.sql));
  const vacante = inserciones.find((q) => q.params.includes(25));
  assert.ok(vacante, "falta el entregable del puesto vacante");
  assert.ok(!vacante.params.includes(24), "el puesto vacante ha heredado al ocupante del otro");
});
