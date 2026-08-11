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
      return [{ affectedRows: 3 }];
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
  assert.ok(sql.includes("FROM position_assignments pa"));
  assert.ok(!/UPDATE[\s\S]*JOIN[\s\S]*SET/.test(sql), "la sintaxis multi-tabla de MySQL no vale aquí");
});

test("sin positionId no hay filtro de puesto ni parámetros", async () => {
  const { sql, params } = await reconciliar();
  assert.deepEqual(params, []);
  assert.ok(!sql.includes("AND ti.responsible_position_id = ?"));
});

test("positionId acota el backfill a un puesto y viaja como parámetro", async () => {
  const { sql, params } = await reconciliar({ positionId: 25 });
  assert.ok(sql.includes("AND ti.responsible_position_id = ?"));
  assert.deepEqual(params, [25]);
});

test("devuelve cuántas filas movió", async () => {
  const { resultado } = await reconciliar();
  assert.deepEqual(resultado, { reconciled: 3 });
});
