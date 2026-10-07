// Tests unitarios de las consultas del espacio de trabajo que NO tienen golden.
//
// ⚠️ Se escribieron con la extracción (2026-10-07, F7.2) y sólo para lo que quedaba sin red: las
// bandejas (`my-sends`, `my-received`, `task-recipients`) sí tienen goldens de caracterización y no
// hacen falta aquí. La descarga de la plantilla de un entregable **no tiene ninguno** —produce un ZIP
// y nadie la ejercita—, así que su consulta se pinta aquí.
//
// No hay base de datos: una conexión de mentira apunta qué SQL recibió y con qué.

import test from "node:test";
import assert from "node:assert/strict";

import { findDeliverableTemplateForUser } from "./UserWorkspaceRepository.js";

const conexionFalsa = (respuesta = [[]]) => {
  const llamadas = [];
  return {
    llamadas,
    query: async (sql, params) => {
      llamadas.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
      return respuesta;
    },
  };
};

test("findDeliverableTemplateForUser devuelve el artefacto y sus formatos", async () => {
  const c = conexionFalsa([[{ task_item_id: 9, generador_id: 2, template_artifact_name: "Acta", available_formats: "{}" }]]);
  const fila = await findDeliverableTemplateForUser(c, { taskItemId: 9, definitionId: 4, personId: 7 });
  assert.equal(fila.template_artifact_name, "Acta");
  assert.equal(fila.generador_id, 2);
});

test("findDeliverableTemplateForUser no encuentra nada y devuelve null, no undefined", async () => {
  const c = conexionFalsa([[]]);
  assert.equal(await findDeliverableTemplateForUser(c, { taskItemId: 1, definitionId: 2, personId: 3 }), null);
});

// ⚠️ ESTA ES LA QUE IMPORTA. El predicado de participación tiene que ser la MISMA subconsulta que usa
// el guard, no una copia: una cuarta copia laxa vivió en el controller hasta el 2026-08-22, con un
// comentario que ya admitía serlo. Si alguien la sustituye por un `WHERE` propio, esto cae.
test("findDeliverableTemplateForUser filtra por participación con la subconsulta compartida", async () => {
  const c = conexionFalsa([[]]);
  await findDeliverableTemplateForUser(c, { taskItemId: 9, definitionId: 4, personId: 7 });
  const sql = c.llamadas[0].sql;
  assert.match(sql, /AND EXISTS \( SELECT 1 FROM \(/, "el EXISTS de participación desapareció");
  assert.match(sql, /\) participantes WHERE participantes\.person_id = \?/);
  // Y pinta las CINCO fuentes de participación que une esa subconsulta. Si mañana desaparece una,
  // alguien deja de poder descargar su plantilla y nadie se enteraría: esta ruta no tiene golden.
  for (const fuente of [
    "entregable_asignado",
    "puesto_responsable_ocupante",
    "entregable_creador",
    "flujo_entrega",
    "flujo_firma",
  ]) {
    assert.ok(sql.includes(fuente), `falta la fuente de participación '${fuente}'`);
  }
});

// Tres parámetros donde había ocho: el entregable viaja DOS veces —el WHERE y el ancla de la
// subconsulta— y la persona UNA. El orden importa y es el que rompe si alguien reordena el SQL.
test("findDeliverableTemplateForUser pasa los parámetros en el orden exacto", async () => {
  const c = conexionFalsa([[]]);
  await findDeliverableTemplateForUser(c, { taskItemId: 9, definitionId: 4, personId: 7 });
  assert.deepEqual(c.llamadas[0].params, [9, 4, 9, 7]);
});
