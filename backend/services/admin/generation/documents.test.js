// Red unitaria del propietario del documento que se materializa para un entregable.
//
// Lo que esto vigila es un ECLIPSE DE ALIAS, no una rama de código: `task_items` y `tasks` tienen
// las dos una columna `responsible_position_id`, así que la fila que
// `getTaskItemsForDocumentMaterialization` entrega a `resolveOwnerPersonIdForTaskItem` lleva la de
// quien se haya proyectado — y el resolver no puede distinguirlas. Proyectar la de la TAREA hacía
// que un entregable dirigido a un puesto vacante heredase el dueño del primer puesto de la unidad.
//
// Por eso la conexión falsa emula la proyección: devuelve el valor del ítem o el de la tarea SEGÚN
// el alias que aparezca en el SELECT. Un test que se limitase a pasar un objeto ya construido al
// resolver pasaría en verde con la consulta rota.
import test from "node:test";
import assert from "node:assert/strict";

import { getTaskItemsForDocumentMaterialization } from "./queries.js";
import {
  resolveOwnerPersonIdForTaskItem,
  resolveOriginUnitIdForTaskItem,
} from "./documents.js";

const PUESTO_DEL_ITEM = 77;
const PUESTO_DE_LA_TAREA = 42;
const PERSONA_DEL_PUESTO_DEL_ITEM = 900;
const PERSONA_DEL_PUESTO_DE_LA_TAREA = 500;

// Ocupantes por puesto, tal y como los vería `task_assignments`. El primer registro de la tarea
// (el que usa el respaldo sin puesto) es el de la tarea, que es como los inserta el motor.
const OCUPANTES = new Map([
  [PUESTO_DE_LA_TAREA, PERSONA_DEL_PUESTO_DE_LA_TAREA],
  [PUESTO_DEL_ITEM, PERSONA_DEL_PUESTO_DEL_ITEM],
]);

const UNIDADES = new Map([
  [PUESTO_DE_LA_TAREA, 4],
  [PUESTO_DEL_ITEM, 9],
]);

/**
 * Conexión falsa que responde por forma de SQL. `itemPositionId` es lo que hay en
 * `task_items.responsible_position_id`; `taskPositionId`, lo que hay en `tasks`.
 */
const conexionDeMaterializacion = ({ itemPositionId, taskPositionId }) => {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });

      if (sql.includes("FROM task_items ti")) {
        // El alias proyectado decide qué valor viaja en `responsible_position_id`.
        let proyectado = null;
        if (sql.includes("ti.responsible_position_id")) proyectado = itemPositionId;
        else if (sql.includes("t.responsible_position_id")) proyectado = taskPositionId;
        return [[{
          id: 1,
          task_id: 10,
          process_definition_template_id: 3,
          template_artifact_id: 5,
          assigned_person_id: null,
          target_unit_id: null,
          target_position_id: itemPositionId,
          target_person_id: null,
          responsible_position_id: proyectado,
          template_artifact_name: "Informe",
        }]];
      }

      if (sql.includes("FROM task_assignments")) {
        // Rama con puesto (`AND position_id = ?`) frente al respaldo por tarea.
        if (sql.includes("position_id = ?")) {
          const persona = OCUPANTES.get(Number(params[1])) ?? null;
          return [persona ? [{ assigned_person_id: persona }] : []];
        }
        return [[{ assigned_person_id: PERSONA_DEL_PUESTO_DE_LA_TAREA }]];
      }

      if (sql.includes("FROM unit_positions")) {
        const unidad = UNIDADES.get(Number(params[0])) ?? null;
        return [unidad ? [{ unit_id: unidad }] : []];
      }

      if (sql.includes("FROM tasks t")) {
        return [[{ unit_id: 4 }]];
      }

      return [[]];
    },
  };
};

test("la fila de materialización lleva el puesto responsable DEL ENTREGABLE, no el de la tarea", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  assert.equal(fila.responsible_position_id, PUESTO_DEL_ITEM);
});

test("la consulta de materialización NO proyecta el puesto de la tarea", async () => {
  const connection = conexionDeMaterializacion({ itemPositionId: null, taskPositionId: null });
  await getTaskItemsForDocumentMaterialization(connection, 10);
  const sql = connection.queries[0].sql;
  assert.ok(sql.includes("ti.responsible_position_id"), "debe proyectar la columna del entregable");
  assert.ok(!sql.includes("t.responsible_position_id"), "no debe proyectar la columna de la tarea");
});

test("el dueño del documento sale del puesto del ENTREGABLE aunque el de la tarea sea otro", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, fila);
  assert.equal(dueño, PERSONA_DEL_PUESTO_DEL_ITEM);
  assert.notEqual(dueño, PERSONA_DEL_PUESTO_DE_LA_TAREA);
});

test("la unidad de origen sale del puesto del ENTREGABLE, no del de la tarea", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  const unidad = await resolveOriginUnitIdForTaskItem(connection, fila, null);
  assert.equal(unidad, UNIDADES.get(PUESTO_DEL_ITEM));
});

// --- el respaldo a nivel de tarea, que es lo que hace innecesario un COALESCE ------------------

test("sin puesto en el entregable, el dueño lo pone el respaldo por tarea del propio resolver", async () => {
  // `ensureTaskItemsForTask` inserta el entregable SIN puesto responsable: ese es el camino real
  // en el que la columna del ítem queda NULL, y el resolver ya tiene su propio respaldo (rama 4).
  const connection = conexionDeMaterializacion({
    itemPositionId: null,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  assert.equal(fila.responsible_position_id, null);
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, fila);
  assert.equal(dueño, PERSONA_DEL_PUESTO_DE_LA_TAREA);
  const conPuesto = connection.queries.filter((q) => q.sql.includes("position_id = ?"));
  assert.equal(conPuesto.length, 0, "sin puesto en el entregable no se consulta por puesto");
});

test("un destinatario explícito manda sobre cualquier puesto", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, {
    id: 1, task_id: 10, target_person_id: 31, responsible_position_id: PUESTO_DEL_ITEM,
  });
  assert.equal(dueño, 31);
  assert.equal(connection.queries.length, 0, "no debe consultar nada si el destinatario es explícito");
});
