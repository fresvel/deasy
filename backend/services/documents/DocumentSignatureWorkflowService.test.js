// Red unitaria de la PRIORIDAD con que se resuelve el flujo de FIRMA de un entregable.
//
// Lo que esto vigila no es «qué columna está rellena», sino el ORDEN de los DOS escalones y la
// guarda `IS NULL` que los separa:
//
//   1. el flujo del ENTREGABLE   (`task_item_id`) — el que se define al enviar, en runtime;
//   2. el flujo de la EDICIÓN    (`edicion_id`)   — el autorado, que el vínculo alcanza por su edición.
//
// **Hubo un tercer escalón, el del VÍNCULO, y murió en la fase 2 del frente 24.** No se retiró por
// gusto: la puerta de publicación nunca lo aceptó —exigía el de la edición y lo excluía
// explícitamente—, así que un flujo colgado del vínculo no podía publicar nada. Por eso aquí hay un
// test que falla si alguna consulta vuelve a preguntar por `vinculo_id`, y por eso `fila()` ya no
// sabe escribir ese portador: el caso ni se puede expresar.
//
// La guarda que queda sí es real y está en la base: el flujo que `materializeRuntimeFlowForTaskItem`
// escribe al enviar cuelga del entregable. Si el escalón de la edición dejara de exigir
// `task_item_id IS NULL`, una fila de runtime que llevara edición casaría también como flujo de la
// edición, y un entregable nacido del lanzamiento acabaría usando el flujo privado del envío de otro.
//
// Por eso la conexión falsa no devuelve respuestas fijas: interpreta el SQL —qué portador compara
// con el parámetro y qué columnas declara `IS NULL`— y filtra con eso una tabla en memoria. Quitar
// una guarda del SQL cambia lo que el falso devuelve, y el test se cae. Un doble con respuestas
// pregrabadas pasaría en verde con la consulta rota.
import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveSignatureFlowTemplateForDefinitionTemplate,
  resolvePersonsForCargoInScope,
} from "./DocumentSignatureWorkflowService.js";

const VINCULO = 7; // vinculos.id
const OTRO_VINCULO = 8;
const EDICION = 55; // ediciones.id que enlaza VINCULO
const OTRA_EDICION = 99; // la que enlaza OTRO_VINCULO
const VINCULO_SIN_EDICION = 9;
const ENTREGABLE = 300; // task_items.id

// `vinculos`: qué edición enlaza cada vínculo.
const VINCULOS = new Map([
  [VINCULO, EDICION],
  [OTRO_VINCULO, OTRA_EDICION],
  [VINCULO_SIN_EDICION, null],
]);

// Los DOS portadores que la tabla admite. No hay un tercero: desde la fase 2 el `CHECK`
// `ck_signature_flow_templates_un_portador` exige exactamente uno de estos dos.
const fila = ({ id, entregable = null, edicion = null, activo = 1 }) => ({
  id,
  task_item_id: entregable,
  edicion_id: edicion,
  is_active: activo,
});

/**
 * Conexión falsa que ejecuta las consultas contra `filas` interpretando el propio SQL: el portador
 * que se compara con el parámetro y las guardas `IS NULL` salen del texto de la consulta, no de una
 * tabla de respuestas.
 */
const conexionDeFlujos = (filas, tabla = "signature_flow_templates") => {
  const consultas = [];
  return {
    consultas,
    async query(sql, params = []) {
      consultas.push({ sql, params });
      assert.ok(sql.includes(`FROM ${tabla}`), `consulta contra otra tabla: ${sql}`);
      assert.doesNotMatch(
        sql,
        /\bvinculo_id\b/,
        "el escalón del vínculo murió en la fase 2: ninguna consulta debe volver a nombrarlo"
      );

      let portador;
      let valor;
      if (/edicion_id = \(\s*SELECT edicion_id/.test(sql)) {
        portador = "edicion_id";
        // La subconsulta: NULL si el vínculo no existe o no enlaza edición. `columna = NULL`
        // no casa con nada, ni siquiera con las filas que tienen NULL.
        valor = VINCULOS.has(Number(params[0])) ? VINCULOS.get(Number(params[0])) : null;
      } else if (/\btask_item_id = \?/.test(sql)) {
        portador = "task_item_id";
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
    fila({ id: 1, entregable: ENTREGABLE }),
    fila({ id: 3, edicion: EDICION }),
  ]);

  const flujo = await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 1 });
  assert.equal(conexion.consultas.length, 1);
});

test("firma: sin flujo del entregable gana el de la EDICIÓN que el vínculo enlaza", async () => {
  const conexion = conexionDeFlujos([fila({ id: 3, edicion: EDICION })]);

  const flujo = await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE);

  assert.deepEqual(flujo, { id: 3 });
  assert.equal(conexion.consultas.length, 2, "dos escalones, dos consultas: ni una más");
});

test("firma: el flujo de RUNTIME no se cuela por el escalón de la EDICIÓN", async () => {
  // Una cabecera de runtime con edición es lo que el `CHECK` prohíbe hoy, pero puede quedar de
  // antes: la guarda `task_item_id IS NULL` es lo que impide servirla a otro entregable.
  const runtime = { id: 1, task_item_id: ENTREGABLE, edicion_id: EDICION, is_active: 1 };

  const soloRuntime = conexionDeFlujos([runtime]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(soloRuntime, VINCULO, null), null);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(soloRuntime, VINCULO, 999), null);

  // Y con un flujo de edición presente, cae a ése, no al privado del otro envío.
  const conEdicion = conexionDeFlujos([runtime, fila({ id: 3, edicion: EDICION })]);
  assert.deepEqual(await getActiveSignatureFlowTemplateForDefinitionTemplate(conEdicion, VINCULO, 999), { id: 3 });
});

test("firma: el escalón de la edición no cruza ediciones ni vínculos huérfanos", async () => {
  // El flujo de OTRA edición no vale para este vínculo.
  const otraEdicion = conexionDeFlujos([fila({ id: 3, edicion: OTRA_EDICION })]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(otraEdicion, VINCULO, null), null);

  // Vínculo sin edición enlazada y vínculo inexistente: NULL, sin reventar.
  const huerfano = conexionDeFlujos([fila({ id: 3, edicion: EDICION })]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(huerfano, VINCULO_SIN_EDICION, null), null);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(huerfano, 12345, null), null);
});

test("firma: un flujo de edición inactivo no se devuelve", async () => {
  const conexion = conexionDeFlujos([fila({ id: 3, edicion: EDICION, activo: 0 })]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, null), null);
});

test("firma: el escalón del VÍNCULO está muerto y no vuelve", async () => {
  // No basta con que nadie lo use: si alguien reintroduce la consulta del vínculo, la conexión
  // falsa la rechaza arriba. Esto afirma además que el recorrido completo son DOS consultas.
  const conexion = conexionDeFlujos([]);
  assert.equal(await getActiveSignatureFlowTemplateForDefinitionTemplate(conexion, VINCULO, ENTREGABLE), null);
  assert.equal(conexion.consultas.length, 2);
  for (const { sql } of conexion.consultas) {
    assert.doesNotMatch(sql, /\bvinculo_id\b/);
  }
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
