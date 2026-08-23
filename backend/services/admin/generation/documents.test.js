// Red unitaria de la materialización del documento de un entregable.
//
// Lo que esto vigila es un ECLIPSE DE ALIAS, no una rama de código: `task_items` y `tasks` tienen
// las dos una columna `responsible_position_id`, así que la fila que
// `getTaskItemsForDocumentMaterialization` entrega lleva la de quien se haya proyectado — y quien
// la consume no puede distinguirlas. Proyectar la de la TAREA hacía que un entregable dirigido a un
// puesto vacante heredase la unidad del primer puesto de la unidad.
//
// Por eso la conexión falsa emula la proyección: devuelve el valor del ítem o el de la tarea SEGÚN
// el alias que aparezca en el SELECT. Un test que se limitase a pasar un objeto ya construido
// pasaría en verde con la consulta rota.
//
// ⚠️ HASTA EL 2026-08-23 ESTE FICHERO PROBABA `resolveOwnerPersonIdForTaskItem`, que ya no existe.
// Su cascada empezó con cuatro escalones y se le fueron cayendo tres al medirlos, hasta quedar en
// `return taskItem.assigned_person_id` — una función que devuelve un campo es un campo. Y la
// columna que alimentaba, `documents.owner_person_id`, era a su vez una copia de ese mismo campo
// que sólo refrescaba uno de los cuatro caminos de relevo.
import test from "node:test";
import assert from "node:assert/strict";

import { getTaskItemsForDocumentMaterialization } from "./queries.js";
import {
  resolveOriginUnitIdForTaskItem,
  ensureDocumentForTaskItem,
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

// La RED de que la copia no vuelva. Si alguien reintroduce un propietario en `documents`, este caso
// se pone rojo — y con él vuelve el defecto entero: una copia del responsable que sólo refresca uno
// de los cuatro caminos de relevo, o sea un documento a nombre de quien ya se fue.
test("el documento se materializa SIN columna de propietario", async () => {
  const connection = conexionDeMaterializacion({
    itemPositionId: PUESTO_DEL_ITEM,
    taskPositionId: PUESTO_DE_LA_TAREA,
  });
  const [fila] = await getTaskItemsForDocumentMaterialization(connection, 10);
  await ensureDocumentForTaskItem(connection, fila).catch(() => {});
  const escrituras = connection.queries.filter((q) => /INSERT INTO documents|UPDATE documents/i.test(q.sql));
  assert.ok(escrituras.length, "la materialización debe escribir el documento");
  for (const q of escrituras) {
    assert.ok(
      !/owner_person_id/i.test(q.sql),
      `ha vuelto el propietario del documento: ${q.sql.slice(0, 120)}`,
    );
  }
});

// Aquí vivían TRES casos más, y los tres probaban `resolveOwnerPersonIdForTaskItem`: que quien lo
// tiene asignado mandaba sobre cualquier puesto, que un «Para:» en la fila no decidía, y que sin
// responsable no se inventaba un dueño. Los tres decían lo mismo con distinta ropa —«el dueño es
// `assigned_person_id`»— y cuando eso deja de ser una cascada y pasa a ser la columna misma, no hay
// nada que probar: lo garantiza el esquema. Lo que sí hay que vigilar es que la COPIA no vuelva, y
// de eso se ocupa el caso de arriba.
