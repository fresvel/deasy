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

// Ocupantes por puesto. El primer registro de la tarea
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

test("el PUESTO ya no resuelve el dueño: sólo lo dice quien tiene el entregable", async () => {
  // Hasta el 2026-08-23 el dueño se resolvía bajando por los puestos —el del entregable primero, el
  // de la tarea como respaldo— contra una tabla de asignaciones. Eso preguntaba «¿quién ocupaba este
  // puesto CUANDO SE LANZÓ?», y la respuesta envejecía con el primer relevo. Ahora la pregunta es
  // «¿quién responde de este entregable?», que es su tenencia vigente, y el puesto sólo sigue
  // sirviendo para la UNIDAD de origen (el test de abajo).
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  assert.equal(fila.assigned_person_id, null, "la fixture trae el entregable sin responsable");
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, fila);
  assert.equal(dueño, null, "con puesto pero sin responsable, no hay dueño que inventar");
  assert.notEqual(dueño, PERSONA_DEL_PUESTO_DEL_ITEM, "el puesto ya no resuelve el dueño");
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

// --- lo que pasa cuando el entregable NO tiene responsable ------------------------------------

test("sin responsable, el documento nace SIN DUEÑO — y eso es lo correcto", async () => {
  // Aquí había DOS respaldos que leían `task_assignments`, y los dos se retiraron con ella
  // (2026-08-23). El primero buscaba «el asignado del puesto responsable en esta tarea», que es
  // literalmente lo que ya dice `assigned_person_id`. El segundo cogía «el primer asignado de la
  // tarea, por id»: no era un respaldo, era una lotería — el documento acababa a nombre de quien
  // tuviera el id más bajo, que puede no tener nada que ver con él.
  //
  // Sin dueño, la situación queda VISIBLE: el entregable está abandonado, su tenencia abierta lo
  // dice, y quien ocupe el puesto entra por la fuente de acceso `puesto_responsable_ocupante`.
  // Antes se tapaba con un nombre cualquiera.
  const connection = conexionDeMaterializacion({
    itemPositionId: null,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  assert.equal(fila.responsible_position_id, null);
  const antes = connection.queries.length;   // la consulta de materializacion ya gastó una
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, fila);
  assert.equal(dueño, null, "no debe inventarse un dueño");
  assert.equal(connection.queries.length - antes, 0, "y no debe consultar nada para averiguarlo");
});

test("quien lo tiene ASIGNADO manda sobre cualquier puesto", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, {
    id: 1, task_id: 10, assigned_person_id: 31, responsible_position_id: PUESTO_DEL_ITEM,
  });
  assert.equal(dueño, 31);
  assert.equal(connection.queries.length, 0, "no debe consultar nada si el entregable ya tiene asignado");
});

// Red contra la reapertura del «Para:». Antes esta cascada EMPEZABA en `target_person_id`, y eso
// decía que responde del documento quien lo RECIBE. La columna se retiró el 2026-08-23 (el
// destinatario se lee del flujo de firma), así que un campo con ese nombre en la fila es ruido y
// tiene que ignorarse. Si alguien lo vuelve a consultar, este caso se pone rojo.
test("un «Para:» en la fila NO decide el dueño: la columna está retirada", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const dueño = await resolveOwnerPersonIdForTaskItem(connection, {
    id: 1, task_id: 10, target_person_id: 31, assigned_person_id: 77,
    responsible_position_id: PUESTO_DEL_ITEM,
  });
  assert.equal(dueño, 77, "gana quien lo elabora, no quien lo recibiría");
});
