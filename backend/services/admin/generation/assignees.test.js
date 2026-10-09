// Fija el CATÁLOGO de responsables que el camino de ENTREGA sabe resolver, tras el cierre del §0.6.
//
// Por qué existe este fichero: los `case` de `document_owner`, `position` y `manual_pick` se
// retiraron de `resolverParticipante` porque el `CHECK` de `fill_flow_steps.resolverType` los
// rechaza desde el sub-paso 8 del §0.8. La caracterización no puede vigilar eso —no hay forma de
// meter una fila con un tipo retirado, que es justo el motivo de la retirada—, así que el único
// guardián posible es unitario: si alguien vuelve a injertar uno de esos `case`, estos tests caen.
//
// Todos usan `connection = null` a propósito: los tipos que aquí se comprueban devuelven sin tocar
// la base. Que no reviente al pasarle `null` ES parte de lo que se afirma.
import test from "node:test";
import assert from "node:assert/strict";

import { resolverParticipante, resolverPersonasPorCargo } from "./assignees.js";

// El contexto trae CEBOS para los tres tipos retirados: si alguno reviviera, resolvería a alguien
// y el test lo cazaría por el valor devuelto, no por una excepción.
const CONTEXTO = {
  owner_person_id: 11,              // cebo de `document_owner`
  task_item_assigned_person_id: 22,
  item_created_by_person_id: 33,   // la reserva: quien ENCARGO el entregable
  scope_unit_id: 44
};

test("resolverParticipante: `task_assignee` prefiere el responsable del entregable", async () => {
  const personas = await resolverParticipante(null, { resolverType: "task_assignee" }, CONTEXTO);
  assert.deepEqual(personas, [22]);
});

test("resolverParticipante: `task_assignee` cae a quien ENCARGO el entregable si no hay responsable", async () => {
  // La reserva era `tasks.created_by_user_id`, retirado el 2026-08-23: estaba NULL en 12 de 13
  // tareas, asi que como reserva casi nunca respondia. Ahora sale del propio entregable.
  const personas = await resolverParticipante(
    null,
    { resolverType: "task_assignee" },
    { ...CONTEXTO, task_item_assigned_person_id: null }
  );
  assert.deepEqual(personas, [33]);
});

test("resolverParticipante: `specific_person` devuelve la persona fijada en el paso", async () => {
  const personas = await resolverParticipante(
    null,
    { resolverType: "specific_person", personaId: 7 },
    CONTEXTO
  );
  assert.deepEqual(personas, [7]);
});

test("resolverParticipante: `specific_person` sin persona no resuelve a nadie", async () => {
  const personas = await resolverParticipante(null, { resolverType: "specific_person" }, CONTEXTO);
  assert.deepEqual(personas, []);
});

// EL TEST QUE IMPORTA. `document_owner` es el más delicado de los tres: el contexto SÍ trae
// `owner_person_id`, así que reponer el `case` haría que este paso resolviera a la persona 11 en vez
// de a nadie. Los otros dos no tienen ni columna que consultar sin base.
test("resolverParticipante: los tres resolutores RETIRADOS no resuelven a nadie", async () => {
  for (const retirado of ["document_owner", "position", "manual_pick"]) {
    const personas = await resolverParticipante(
      null,
      { resolverType: retirado, position_id: 5, selection_mode: "auto_one" },
      CONTEXTO
    );
    assert.deepEqual(
      personas,
      [],
      `"${retirado}" salió del CHECK de fill_flow_steps: ningún paso de entrega puede llevarlo`
    );
  }
});

test("resolverParticipante: un tipo desconocido cae al `default` y no revienta", async () => {
  const personas = await resolverParticipante(null, { resolverType: "inventado" }, CONTEXTO);
  assert.deepEqual(personas, []);
});

test("resolverParticipante: sin paso o sin contexto devuelve la lista vacía", async () => {
  assert.deepEqual(await resolverParticipante(null, null, CONTEXTO), []);
  assert.deepEqual(await resolverParticipante(null, { resolverType: "task_assignee" }, null), []);
});

// `cargo_in_scope` sigue vivo, y es el único que llega a consultar la base. Aquí solo se comprueba
// el atajo de antes de la consulta —un paso por cargo SIN cargo no resuelve a nadie—, que también
// devuelve sin tocar `connection`.
test("resolverParticipante: `cargo_in_scope` sin cargo corta antes de consultar la base", async () => {
  const personas = await resolverParticipante(null, { resolverType: "cargo_in_scope" }, CONTEXTO);
  assert.deepEqual(personas, []);
});

// ── EL ÁMBITO: QUÉ FILTRO SALE DE CADA VALOR, Y EN QUÉ ORDEN VAN LOS PARÁMETROS ─────────────────
//
// Esto vino de `DocumentSignatureWorkflowService.test.js`, donde vigilaba SEIS ámbitos y el defecto
// 1.16 (dos `unshift` que cruzaban el cargo con el tipo de unidad). Cuatro de esos seis murieron con
// el JSONB `signers` en el paso 3b de la fase 4 del frente 24: llegaban por ahí porque ningún
// `CHECK` cubría esa columna, y hoy los firmantes son filas. Quedan TRES, y el que resuelve es uno.
//
// Lo que se afirma sigue siendo la POSICIÓN, no la cantidad: `bindParams` ya vigila que el número de
// `?` cuadre, y el defecto 1.16 cuadraba en número estando cruzado.
const CARGO = 7;
const UNIDAD = 10;

const ambitoDe = async (participante, context = null) => {
  const capturado = [];
  const conexion = {
    async query(sql, params = []) {
      capturado.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return [[]];
    },
  };
  await resolverPersonasPorCargo(conexion, { cargoId: CARGO, ...participante }, context);
  return capturado[0];
};

test("ámbito unit_exact: acota a la unidad ESCRITA en el participante", async () => {
  const { sql, params } = await ambitoDe({ unitScopeType: "unit_exact", unitId: UNIDAD });
  assert.match(sql, /AND up\.unit_id = \?/);
  assert.deepEqual(params, [CARGO, UNIDAD], "el cargo va primero: es el de la consulta base");
});

test("ámbito context_exact: MISMO filtro, pero la unidad sale del documento", async () => {
  // Es la única diferencia entre los dos, y por eso comparten rama: lo que cambia es de dónde viene
  // la unidad, no qué se filtra.
  const { sql, params } = await ambitoDe({ unitScopeType: "context_exact" }, { scope_unit_id: UNIDAD });
  assert.match(sql, /AND up\.unit_id = \?/);
  assert.deepEqual(params, [CARGO, UNIDAD]);
});

test("ámbito all_units: no acota nada, y por eso NO lleva segundo parámetro", async () => {
  const { sql, params } = await ambitoDe({ unitScopeType: "all_units" });
  assert.doesNotMatch(sql, /AND up\.unit_id = \?/);
  assert.deepEqual(params, [CARGO]);
});

test("un ámbito que exige unidad y no la tiene NO consulta: devuelve vacío", async () => {
  // Sin esta guarda el `?` del filtro se quedaría sin parámetro y hoy `bindParams` lanzaría
  // (defecto 1.5) en vez de resolver de más.
  const conexion = { async query() { throw new Error("no debe consultar"); } };
  for (const ambito of ["unit_exact", "context_exact"]) {
    assert.deepEqual(
      await resolverPersonasPorCargo(conexion, { cargoId: CARGO, unitScopeType: ambito }, null),
      []
    );
  }
});

test("los cuatro ámbitos RETIRADOS no producen filtro de unidad", async () => {
  // `unit_subtree`, `unit_type`, `context_subtree` y `context_ancestor_type` salieron del vocabulario
  // (§10 del plan): la base rechaza la fila. Si alguno reviviera con su rama, el filtro reaparecería
  // aquí. Hoy caen al camino sin acotar, que es lo que hace un valor que nadie interpreta.
  for (const retirado of ["unit_subtree", "unit_type", "context_subtree", "context_ancestor_type"]) {
    const { sql, params } = await ambitoDe({ unitScopeType: retirado, unitId: UNIDAD, unitTypeId: 4 });
    assert.doesNotMatch(sql, /WITH RECURSIVE/, `${retirado} no debe traer su CTE de vuelta`);
    assert.doesNotMatch(sql, /unit_type_id/, `${retirado} no debe filtrar por tipo de unidad`);
    assert.deepEqual(params, [CARGO], `${retirado}: solo el cargo`);
  }
});
