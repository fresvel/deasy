// Red unitaria del backfill de responsables (`reconcileOpenTaskItemAssignments`).
//
// Lo que vigila: CUÁL es la señal de "ya empezado". Durante meses fue "el entregable tiene
// documento", y esa condición no se cumple nunca — el documento se crea al lanzar, en la misma
// transacción que el entregable —, así que el backfill devolvía 0 siempre y nadie lo notaba.
// La señal buena es `task_items.user_started_at`, que sella el `start` de un paso de entrega.
//
// Esto es un test del PREDICADO, no del efecto: el efecto (que reasigna lo no iniciado y respeta
// lo iniciado) se fija por HTTP en tests/characterization/flows/zzzzz_task_item_relay.test.mjs,
// que es donde el SQL se ejecuta de verdad contra PostgreSQL. Aquí se ancla que la condición no
// vuelva a cambiarse por descuido durante un refactor.
import test from "node:test";
import assert from "node:assert/strict";

import TaskAssignmentService from "./taskAssignment.js";

const conexionFalsa = () => {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      // El backfill cuenta por RETURNING, no por `affectedRows`: su sentencia empieza por `WITH` y
      // el adaptador solo calcula `affectedRows` cuando el texto empieza por INSERT/UPDATE/DELETE.
      return [[{ id: 11 }, { id: 22 }, { id: 33 }]];
    },
  };
};

const reconciliar = async (opciones = {}) => {
  const connection = conexionFalsa();
  const service = new TaskAssignmentService(null);
  const resultado = await service.reconcileOpenTaskItemAssignments(opciones, connection);
  return { resultado, sql: connection.queries[0].sql, params: connection.queries[0].params };
};

test("el guard de 'ya iniciado' es user_started_at, no la existencia del documento", async () => {
  const { sql } = await reconciliar();
  assert.ok(sql.includes("ti.user_started_at IS NULL"), "debe filtrar por user_started_at");
  assert.ok(
    !sql.includes("documents"),
    "no debe volver a preguntar por el documento: nace con el entregable y la rama era código muerto",
  );
});

test("solo reconcilia entregables abiertos y con puesto responsable", async () => {
  const { sql } = await reconciliar();
  assert.ok(sql.includes("ti.responsible_position_id IS NOT NULL"));
  assert.ok(sql.includes("ti.status NOT IN"));
  assert.ok(sql.includes("pa.is_current = 1"), "el destino es el ocupante VIGENTE del puesto");
  assert.ok(
    sql.includes("ti.assigned_person_id <> pa.person_id"),
    "no debe reescribir filas que ya apuntan al ocupante",
  );
});

test("es PostgreSQL: UPDATE ... FROM, nunca UPDATE ... INNER JOIN ... SET", async () => {
  const { sql } = await reconciliar();
  assert.ok(/UPDATE task_items ti\s+SET/.test(sql));
  assert.ok(/UPDATE task_items ti[\s\S]*FROM objetivo o/.test(sql), "el UPDATE se alimenta del CTE");
  // El `INNER JOIN` que hay ahora vive DENTRO del SELECT del CTE, que es legítimo. Lo que no vale
  // es la sintaxis multi-tabla de MySQL: un JOIN entre el UPDATE y su SET.
  assert.ok(!/UPDATE task_items ti\s+SET[\s\S]*INNER JOIN/.test(sql), "nada de UPDATE ... JOIN ... SET");
});

test("el asiento de auditoría va en la MISMA sentencia que la reasignación", async () => {
  // Defecto 1.10: si el asiento fuera una sentencia aparte podría quedarse sin escribir, y el
  // predicado tendría que repetirse por cuarta vez. El CTE lo evalúa una sola vez.
  const { sql } = await reconciliar();
  assert.ok(/WITH objetivo AS/.test(sql), "el predicado se evalúa una vez, en un CTE");
  assert.ok(/INSERT INTO task_item_handovers/.test(sql), "y alimenta al asiento");
  assert.ok(sql.includes("'reconcile'"), "con su causa propia, distinta de `manual`");
});

test("sin positionId no hay filtro de puesto; el único parámetro es el actor", async () => {
  const { sql, params } = await reconciliar();
  assert.deepEqual(params, [null], "sin actor conocido, el asiento lo deja en NULL");
  assert.ok(!sql.includes("AND ti.responsible_position_id = ?"));
});

test("positionId acota el backfill a un puesto y viaja ANTES que el actor", async () => {
  // El orden importa: el `?` del filtro está en el CTE, y el del actor en el INSERT que va después.
  const { sql, params } = await reconciliar({ positionId: 25, performedByUserId: 7 });
  assert.ok(sql.includes("AND ti.responsible_position_id = ?"));
  assert.deepEqual(params, [25, 7]);
});

test("el backfill SÍ registra quién lo lanzó, a diferencia de los relevos por trigger", async () => {
  // Este camino lo dispara alguien a propósito, así que `performed_by_user_id` tiene dueño. Los
  // relevos automáticos lo dejan en NULL porque no lo hizo nadie.
  const { params } = await reconciliar({ performedByUserId: 42 });
  assert.deepEqual(params, [42]);
});

test("devuelve cuántas filas movió, contadas por RETURNING", async () => {
  const { sql, resultado } = await reconciliar();
  assert.ok(/RETURNING ti\.id/.test(sql), "sin RETURNING el conteo sería 0 siempre");
  assert.deepEqual(resultado, { reconciled: 3 });
});
