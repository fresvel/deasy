// Red unitaria de la PRIORIDAD con que se resuelve el flujo de ENTREGA de un entregable.
//
// Lo que esto vigila no es «qué columna está rellena», sino el ORDEN de los tres escalones y las
// guardas `IS NULL` que los separan. La trampa es real y está en la base: el flujo que
// `materializeRuntimeFlowForTaskItem` escribe al enviar (documents.js:248) rellena
// `process_definition_template_id` Y `task_item_id` en el MISMO INSERT. Si el escalón del vínculo
// dejara de exigir `task_item_id IS NULL`, esa fila casaría también como flujo del vínculo y un
// entregable nacido del lanzamiento acabaría usando el flujo privado del envío de otro.
//
// Por eso la conexión falsa no devuelve respuestas fijas: interpreta el SQL —qué portador compara
// con el parámetro y qué columnas declara `IS NULL`— y filtra con eso una tabla en memoria. Quitar
// una guarda del SQL cambia lo que el falso devuelve, y el test se cae. Un doble con respuestas
// pregrabadas pasaría en verde con la consulta rota.
import test from "node:test";
import assert from "node:assert/strict";

import { getActiveFillFlowTemplateForDefinitionTemplate } from "./queries.js";

const VINCULO = 7; // process_definition_templates.id
const OTRO_VINCULO = 8;
const PLANTILLA = 55; // template_artifacts.id que enlaza VINCULO
const OTRA_PLANTILLA = 99; // el que enlaza OTRO_VINCULO
const VINCULO_SIN_PLANTILLA = 9;
const ENTREGABLE = 300; // task_items.id

// `process_definition_templates`: qué edición enlaza cada vínculo.
const VINCULOS = new Map([
  [VINCULO, PLANTILLA],
  [OTRO_VINCULO, OTRA_PLANTILLA],
  [VINCULO_SIN_PLANTILLA, null],
]);

const fila = ({ id, vinculo = null, entregable = null, plantilla = null, activo = 1 }) => ({
  id,
  process_definition_template_id: vinculo,
  task_item_id: entregable,
  template_artifact_id: plantilla,
  is_active: activo,
});

/**
 * Conexión falsa que ejecuta las tres consultas contra `filas` interpretando el propio SQL:
 * el portador que se compara con el parámetro y las guardas `IS NULL` salen del texto de la
 * consulta, no de una tabla de respuestas.
 */
const conexionDeFlujos = (filas, tabla = "fill_flow_templates") => {
  const consultas = [];
  return {
    consultas,
    async query(sql, params = []) {
      consultas.push({ sql, params });
      assert.ok(sql.includes(`FROM ${tabla}`), `consulta contra otra tabla: ${sql}`);

      let portador;
      let valor;
      if (/template_artifact_id = \(\s*SELECT template_artifact_id/.test(sql)) {
        portador = "template_artifact_id";
        // La subconsulta: NULL si el vínculo no existe o no enlaza edición. `columna = NULL`
        // no casa con nada, ni siquiera con las filas que tienen NULL.
        valor = VINCULOS.has(Number(params[0])) ? VINCULOS.get(Number(params[0])) : null;
      } else if (/\btask_item_id = \?/.test(sql)) {
        portador = "task_item_id";
        valor = Number(params[0]);
      } else if (/\bprocess_definition_template_id = \?/.test(sql)) {
        portador = "process_definition_template_id";
        valor = Number(params[0]);
      } else {
        throw new Error(`consulta no reconocida: ${sql}`);
      }

      const guardas = [...sql.matchAll(/(\w+) IS NULL/g)].map((m) => m[1]);
      const encontradas = valor === null
        ? []
        : filas
          .filter((f) => f.is_active === 1)
          .filter((f) => f[portador] === valor)
          .filter((f) => guardas.every((g) => f[g] === null))
          .sort((a, b) => b.id - a.id)
          .slice(0, 1)
          .map((f) => ({ id: f.id }));
      return [encontradas];
    },
  };
};

test("entrega: con flujo del ENTREGABLE gana ese, y no se pregunta nada más", async () => {
  const conexion = conexionDeFlujos([
    fila({ id: 1, vinculo: VINCULO, entregable: ENTREGABLE }),
    fila({ id: 2, vinculo: VINCULO }),
    fila({ id: 3, plantilla: PLANTILLA }),
  ]);

  const flujo = await getActiveFillFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 1 });
  assert.equal(conexion.consultas.length, 1);
});

test("entrega: sin flujo del entregable gana el del VÍNCULO", async () => {
  const conexion = conexionDeFlujos([
    fila({ id: 2, vinculo: VINCULO }),
    fila({ id: 3, plantilla: PLANTILLA }),
  ]);

  const flujo = await getActiveFillFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 2 });
  assert.equal(conexion.consultas.length, 2);
});

test("entrega: sin flujo del entregable ni del vínculo gana el de la PLANTILLA (escalón nuevo)", async () => {
  const conexion = conexionDeFlujos([
    fila({ id: 3, plantilla: PLANTILLA }),
  ]);

  const flujo = await getActiveFillFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 3 });
  assert.equal(conexion.consultas.length, 3);
});

test("entrega: el flujo de RUNTIME no lo devuelve el escalón del vínculo", async () => {
  // Fila con los DOS portadores, tal y como la escribe `materializeRuntimeFlowForTaskItem`.
  const runtime = fila({ id: 1, vinculo: VINCULO, entregable: ENTREGABLE });

  // Otro entregable del mismo vínculo (o el motor sin task_item a mano): no debe verla.
  const soloRuntime = conexionDeFlujos([runtime]);
  assert.equal(await getActiveFillFlowTemplateForDefinitionTemplate(soloRuntime, VINCULO, null), null);
  assert.equal(await getActiveFillFlowTemplateForDefinitionTemplate(soloRuntime, VINCULO, 999), null);

  // Y con un flujo de plantilla presente, cae al de plantilla, no al privado del otro envío.
  const conPlantilla = conexionDeFlujos([runtime, fila({ id: 3, plantilla: PLANTILLA })]);
  const flujo = await getActiveFillFlowTemplateForDefinitionTemplate(conPlantilla, VINCULO, 999);
  assert.deepEqual(flujo, { id: 3 });
});

test("entrega: el escalón de plantilla no cruza ediciones ni se cuela por otro vínculo", async () => {
  // El flujo de OTRA edición no vale para este vínculo.
  const otraEdicion = conexionDeFlujos([fila({ id: 3, plantilla: OTRA_PLANTILLA })]);
  assert.equal(await getActiveFillFlowTemplateForDefinitionTemplate(otraEdicion, VINCULO, null), null);

  // Un flujo con edición Y vínculo ajeno es del OTRO vínculo: la guarda
  // `process_definition_template_id IS NULL` lo deja fuera.
  const deOtroVinculo = conexionDeFlujos([
    fila({ id: 4, vinculo: OTRO_VINCULO, plantilla: PLANTILLA }),
  ]);
  assert.equal(await getActiveFillFlowTemplateForDefinitionTemplate(deOtroVinculo, VINCULO, null), null);

  // Vínculo sin edición enlazada y vínculo inexistente: NULL, sin reventar.
  const huerfano = conexionDeFlujos([fila({ id: 3, plantilla: PLANTILLA })]);
  assert.equal(
    await getActiveFillFlowTemplateForDefinitionTemplate(huerfano, VINCULO_SIN_PLANTILLA, null),
    null
  );
  assert.equal(await getActiveFillFlowTemplateForDefinitionTemplate(huerfano, 12345, null), null);
});

test("entrega: un flujo de plantilla inactivo no se devuelve", async () => {
  const conexion = conexionDeFlujos([fila({ id: 3, plantilla: PLANTILLA, activo: 0 })]);
  assert.equal(await getActiveFillFlowTemplateForDefinitionTemplate(conexion, VINCULO, null), null);
});
