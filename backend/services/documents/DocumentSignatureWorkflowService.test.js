// Red unitaria de la PRIORIDAD con que se resuelve el flujo de FIRMA de un entregable.
//
// Gemelo del de entrega (`services/admin/generation/queries.test.js`) y con el mismo motivo: lo que
// se vigila no es «qué columna está rellena», sino el ORDEN de los tres escalones y las guardas
// `IS NULL` que los separan. El flujo de firma que `materializeRuntimeFlowForTaskItem` escribe al
// enviar (generation/documents.js:278) rellena `process_definition_template_id` Y `task_item_id` en
// el MISMO INSERT: sin `task_item_id IS NULL` en el escalón del vínculo, esa fila se serviría como
// flujo del vínculo a cualquier otro entregable.
//
// La conexión falsa interpreta el SQL —qué portador compara con el parámetro y qué columnas declara
// `IS NULL`— y filtra con eso una tabla en memoria; quitar una guarda del SQL tira el test.
import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveSignatureFlowTemplateForDefinitionTemplate,
  resolvePersonsForCargoInScope,
} from "./DocumentSignatureWorkflowService.js";

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
const conexionDeFlujos = (filas, tabla = "signature_flow_templates") => {
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

test("firma: con flujo del ENTREGABLE gana ese, y no se pregunta nada más", async () => {
  const conexion = conexionDeFlujos([
    fila({ id: 1, vinculo: VINCULO, entregable: ENTREGABLE }),
    fila({ id: 2, vinculo: VINCULO }),
    fila({ id: 3, plantilla: PLANTILLA }),
  ]);

  const flujo = await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 1 });
  assert.equal(conexion.consultas.length, 1);
});

test("firma: sin flujo del entregable gana el del VÍNCULO", async () => {
  const conexion = conexionDeFlujos([
    fila({ id: 2, vinculo: VINCULO }),
    fila({ id: 3, plantilla: PLANTILLA }),
  ]);

  const flujo = await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 2 });
  assert.equal(conexion.consultas.length, 2);
});

test("firma: sin flujo del entregable ni del vínculo gana el de la PLANTILLA (escalón nuevo)", async () => {
  const conexion = conexionDeFlujos([
    fila({ id: 3, plantilla: PLANTILLA }),
  ]);

  const flujo = await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 3 });
  assert.equal(conexion.consultas.length, 3);
});

test("firma: el flujo de RUNTIME no lo devuelve el escalón del vínculo", async () => {
  // Fila con los DOS portadores, tal y como la escribe `materializeRuntimeFlowForTaskItem`.
  const runtime = fila({ id: 1, vinculo: VINCULO, entregable: ENTREGABLE });

  const soloRuntime = conexionDeFlujos([runtime]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(soloRuntime, VINCULO, null), null);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(soloRuntime, VINCULO, 999), null);

  const conPlantilla = conexionDeFlujos([runtime, fila({ id: 3, plantilla: PLANTILLA })]);
  const flujo = await getActiveSignatureFlowTemplateForDefinitionTemplate(conPlantilla, VINCULO, 999);
  assert.deepEqual(flujo, { id: 3 });
});

test("firma: el escalón de plantilla no cruza ediciones ni se cuela por otro vínculo", async () => {
  const otraEdicion = conexionDeFlujos([fila({ id: 3, plantilla: OTRA_PLANTILLA })]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(otraEdicion, VINCULO, null), null);

  const deOtroVinculo = conexionDeFlujos([
    fila({ id: 4, vinculo: OTRO_VINCULO, plantilla: PLANTILLA }),
  ]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(deOtroVinculo, VINCULO, null), null);

  const huerfano = conexionDeFlujos([fila({ id: 3, plantilla: PLANTILLA })]);
  assert.equal(
    await getActiveSignatureFlowTemplateForDefinitionTemplate(huerfano, VINCULO_SIN_PLANTILLA, null),
    null
  );
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(huerfano, 12345, null), null);
});

test("firma: un flujo de plantilla inactivo no se devuelve", async () => {
  const conexion = conexionDeFlujos([fila({ id: 3, plantilla: PLANTILLA, activo: 0 })]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, null), null);
});


// --- Ámbitos: el ORDEN de los parámetros (defecto 1.16) --------------------------------------
//
// POR QUÉ ESTO NO PUEDE SER UN GOLDEN. El `CHECK` de `signature_flow_steps.unit_scope_type`
// (`database/postgres_schema.sql`) admite solo `unit_exact`, `unit_subtree`, `unit_type`,
// `all_units` y `context_exact`. Los ámbitos `context_*` retirados llegan aquí **por el JSONB
// `signers`**, que ningún `CHECK` cubre (ver la nota de `:130-147` del módulo), así que la
// caracterización **no puede sembrarlos por CRUD**: cero apariciones en los 21 goldens. Un unitario
// es el único guardián posible de estas ramas.
//
// Y lo que se afirma es la POSICIÓN, no la cantidad: `bindParams` ya vigila que el número de `?` y
// de parámetros coincida, y el defecto 1.16 cuadraba en número (3 y 3) estando cruzado. Lo que no
// vigila nadie es cuál va en cada sitio.
//
// La conexión falsa captura el SQL y sus parámetros, mismo idioma que
// `services/admin/org/taskAssignment.test.js`.

const UNIDAD = 10;
const TIPO_UNIDAD = 4;
const CARGO = 7;

const resolverAmbito = async (signer) => {
  const capturado = [];
  const conexion = {
    async query(sql, params = []) {
      capturado.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return [[]];
    },
  };
  await resolvePersonsForCargoInScope(conexion, { requiredCargoId: CARGO, ...signer });
  return capturado[0];
};

// Los `?` del SQL, en orden de aparición, emparejados con la cláusula que los aloja.
const clausulasEnOrden = (sql) =>
  [...sql.matchAll(/([A-Za-z_.]+)\s*=\s*\?/g)].map((m) => m[1]);

test("ámbito context_ancestor_type: cada parámetro cae en SU cláusula", async () => {
  // El defecto 1.16: dos `unshift` dejaban [unidad, tipo, cargo], así que `up.cargo_id` recibía el
  // TIPO DE UNIDAD y `unit_type_id` recibía el CARGO. Silencioso: resolvía firmantes equivocados.
  const { sql, params } = await resolverAmbito({
    unitScopeType: "context_ancestor_type",
    unitId: UNIDAD,
    unitTypeId: TIPO_UNIDAD,
  });

  assert.deepEqual(clausulasEnOrden(sql), ["id", "up.cargo_id", "unit_type_id"]);
  assert.deepEqual(params, [UNIDAD, CARGO, TIPO_UNIDAD]);
});

test("ámbito context_ancestor_type: es la única rama que antepone Y añade a la cola", async () => {
  // Por eso rompió aquí y no en las otras cinco: el `?` de cabeza se paga con `unshift` y el de
  // cola con `push`. Mezclarlos con dos `unshift` es lo que cruzó los valores.
  const { sql } = await resolverAmbito({
    unitScopeType: "context_ancestor_type",
    unitId: UNIDAD,
    unitTypeId: TIPO_UNIDAD,
  });
  assert.ok(sql.indexOf("WITH RECURSIVE") < sql.indexOf("up.cargo_id = ?"), "el CTE va DELANTE");
  assert.ok(sql.indexOf("up.cargo_id = ?") < sql.lastIndexOf("unit_type_id = ?"), "y el filtro DETRÁS");
});

test("ámbito context_subtree: sigue cuadrando (grupo de control, un solo unshift)", async () => {
  const { params } = await resolverAmbito({ unitScopeType: "context_subtree", unitId: UNIDAD });
  assert.deepEqual(params, [UNIDAD, CARGO]);
});

test("ámbito unit_subtree: sigue cuadrando (grupo de control)", async () => {
  const { params } = await resolverAmbito({ unitScopeType: "unit_subtree", unitId: UNIDAD });
  assert.deepEqual(params, [UNIDAD, CARGO]);
});

test("ámbito unit_type: el parámetro va a la COLA, con push", async () => {
  const { params } = await resolverAmbito({ unitScopeType: "unit_type", unitTypeId: TIPO_UNIDAD });
  assert.deepEqual(params, [CARGO, TIPO_UNIDAD]);
});

test("context_ancestor_type sin tipo de unidad no consulta: devuelve vacío", async () => {
  // La guarda de `:414`. Sin ella, el `?` del `IN` se quedaría sin su parámetro y hoy `bindParams`
  // lanzaría (defecto 1.5) en vez de resolver de más.
  const capturado = [];
  const conexion = { async query(sql, params) { capturado.push({ sql, params }); return [[]]; } };
  const gente = await resolvePersonsForCargoInScope(conexion, {
    requiredCargoId: CARGO,
    unitScopeType: "context_ancestor_type",
    unitId: UNIDAD,
  });
  assert.deepEqual(gente, []);
  assert.equal(capturado.length, 0, "ni siquiera llega a consultar");
});

test("sin cargo no hay nada que resolver", async () => {
  const conexion = { async query() { throw new Error("no debe consultar"); } };
  assert.deepEqual(await resolvePersonsForCargoInScope(conexion, { unitScopeType: "all_units" }), []);
});
