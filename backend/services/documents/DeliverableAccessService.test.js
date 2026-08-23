// Red unitaria del conjunto de participantes de un entregable.
//
// Por qué es unitaria y no de caracterización: en el paso P1 este módulo NO lo llama ningún
// endpoint, así que char no puede verlo por construcción — es el punto ciego que la regla 15 del
// método manda buscar a propósito. Cuando P2 enchufe los guards, el golden se moverá y ESE diff
// será la prueba del cambio de comportamiento.
import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCESS_LEVELS,
  ACCESS_SOURCES,
  listProcessParticipants,
  accessSubqueryCorrelated,
  sourcesForLevel,
  __buildAccessQuery,
  __SCOPES,
} from "./DeliverableAccessService.js";

const fakeConnection = (rows) => {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [typeof rows === "function" ? rows(sql, params) : rows];
    },
  };
};

// --- Las fuentes son una tabla, y eso es contrato -----------------------------------------

test("las diez fuentes de hoy tienen clave única y razón escrita", () => {
  const keys = ACCESS_SOURCES.map((source) => source.key);
  assert.equal(new Set(keys).size, keys.length, "hay claves repetidas");
  for (const source of ACCESS_SOURCES) {
    assert.match(source.key, /^[a-z_]+$/, `clave inválida: ${source.key}`);
    assert.ok(source.reason?.length > 10, `la fuente ${source.key} no explica por qué da acceso`);
    assert.match(source.sql, /INNER JOIN alcance a/, `la fuente ${source.key} no cuelga del alcance`);
  }
});

// --- El nivel: la barandilla que impide reabrir el IDOR ------------------------------------

test("cada fuente declara QUÉ concede, y sólo hay dos niveles", () => {
  for (const source of ACCESS_SOURCES) {
    assert.ok(
      Object.values(ACCESS_LEVELS).includes(source.grants),
      `la fuente ${source.key} no declara su nivel`
    );
  }
});

test("el acceso al ENTREGABLE no incluye a los asignados de la TAREA: ése era el IDOR", () => {
  // Medido el 2026-08-22: el entregable 4 tiene ONCE personas en `task_assignments` de su tarea.
  // Si la fuente ancha concediera nivel de entregable, esas once podrían descargarlo.
  const claves = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((source) => source.key);
  assert.ok(!claves.includes("tarea_asignado"), "el IDOR ha vuelto");
});

test("la fuente del puesto responsable SÍ está, pero ACOTADA a este entregable", () => {
  const claves = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((source) => source.key);
  assert.ok(claves.includes("puesto_responsable_asignado"));
  assert.ok(claves.includes("puesto_responsable_ocupante"));

  // La acotación ES el arreglo del IDOR: sin ella, la fuente sería la ancha.
  const acotada = ACCESS_SOURCES.find((s) => s.key === "puesto_responsable_asignado");
  assert.match(acotada.sql, /ta\.position_id = ti_src\.responsible_position_id/);
  const ancha = ACCESS_SOURCES.find((s) => s.key === "tarea_asignado");
  assert.ok(!/responsible_position_id/.test(ancha.sql), "la ancha no debe llevar la acotación");
});

test("el dueño materializado NO es fuente: su valor puede estar rancio", () => {
  // Medido: en el entregable 4 vale 24 mientras la cascada resuelve 3. Dar acceso por ahí es
  // repartir permisos con un dato desincronizado, que es por lo que la columna se muere en P6.
  const claves = ACCESS_SOURCES.map((source) => source.key);
  assert.ok(!claves.includes("documento_dueno"));
});

test("el creador de la tarea llega al ENTREGABLE: el guard real ya lo incluía", () => {
  // Quitarlo del nivel estrecho sería un 404 donde hoy hay un 200.
  const claves = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((source) => source.key);
  assert.ok(claves.includes("tarea_creador"));
});

test("el ocupante actual del puesto entra sólo cuando la asignación está vacía", () => {
  const ocupante = ACCESS_SOURCES.find((s) => s.key === "puesto_responsable_ocupante");
  assert.match(ocupante.sql, /pa\.is_current = 1/);
  assert.match(ocupante.sql, /ta\.assigned_person_id IS NULL/);
});

test("el acceso a la CONVERSACIÓN es más ancho, e incluye entero al del documento", () => {
  const documento = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((s) => s.key);
  const conversacion = sourcesForLevel(ACCESS_LEVELS.CONVERSACION).map((s) => s.key);
  for (const clave of documento) {
    assert.ok(conversacion.includes(clave), `la conversación pierde ${clave}`);
  }
  assert.ok(conversacion.length > documento.length, "los dos niveles serían el mismo");
});



test("un nivel inventado falla en vez de conceder de más", () => {
  assert.throws(() => sourcesForLevel("admin"), /Nivel de acceso desconocido/);
});

test("el chat pide el nivel ancho: es una conversación de proceso, no un documento", async () => {
  const conn = fakeConnection([]);
  await listProcessParticipants(conn, { processId: 3, scopeUnitId: 8 });
  assert.ok(conn.queries[0].sql.includes("'tarea_asignado'"));
  assert.ok(conn.queries[0].sql.includes("'tarea_creador'"));
});

test("las dos mitades que hoy están divididas entre los dos guards están las dos", () => {
  const keys = ACCESS_SOURCES.map((source) => source.key);
  // Las que sólo tenía el guard del documento
  assert.ok(keys.includes("flujo_entrega"));
  assert.ok(keys.includes("flujo_firma"));
  // Las que sólo tenía el chat
  assert.ok(keys.includes("tarea_creador"));
  assert.ok(keys.includes("tarea_asignado"));
  assert.ok(keys.includes("entregable_asignado"));
});

// --- El ancla: una fuente, dos alcances ---------------------------------------------------

test("las fuentes NO llevan parámetros propios: el conteo es siempre el del ancla", () => {
  // Es lo que impide que el defecto 1.11 (parámetros de más ignorados en silencio) entre aquí.
  for (const source of ACCESS_SOURCES) {
    assert.equal(
      (source.sql.match(/\?/g) || []).length, 0,
      `la fuente ${source.key} lleva un placeholder propio`
    );
  }
  assert.equal((__SCOPES.SCOPE_BY_TASK_ITEM.cte.match(/\?/g) || []).length, 1);
  assert.equal((__SCOPES.SCOPE_BY_PROCESS_UNIT.cte.match(/\?/g) || []).length, 2);
});

test("el mismo juego de fuentes se usa en los dos alcances", () => {
  // El ALCANCE (qué entregables) y el NIVEL (cuánto concede cada fuente) son ejes distintos.
  const porItem = __buildAccessQuery(__SCOPES.SCOPE_BY_TASK_ITEM, ACCESS_SOURCES);
  const porProceso = __buildAccessQuery(__SCOPES.SCOPE_BY_PROCESS_UNIT, ACCESS_SOURCES);
  for (const source of ACCESS_SOURCES) {
    assert.ok(porItem.includes(`'${source.key}'`), `falta ${source.key} en el alcance de entregable`);
    assert.ok(porProceso.includes(`'${source.key}'`), `falta ${source.key} en el alcance de proceso`);
  }
});


// --- El agrupado: una persona, todas sus razones -------------------------------------------






// --- La pregunta de sí/no -----------------------------------------------------------------




// --- La barandilla de la clave ------------------------------------------------------------

test("una clave de fuente mal escrita falla al construir, no produce SQL roto", () => {
  assert.throws(
    () => __buildAccessQuery(__SCOPES.SCOPE_BY_TASK_ITEM, [{ key: "mala'; DROP", sql: "SELECT 1" }]),
    /Clave de fuente de acceso inválida/
  );
});

// --- El alcance correlacionado: para las consultas de LISTA -------------------------------

test("el alcance correlacionado NO lleva placeholders: el ancla es el alias de fuera", () => {
  const sql = accessSubqueryCorrelated("ti");
  assert.equal((sql.match(/\?/g) || []).length, 0, "un placeholder aquí rompería el conteo de fuera");
  assert.match(sql, /ti_acc\.id = ti\.id/);
});

test("el alias interno no puede ensombrecer al de fuera", () => {
  // Las fuentes usan `ti_src`; el correlacionado usa `ti_acc`. Si alguna volviera a llamarse
  // `ti`, una consulta de lista con alias `ti` empezaría a comparar contra sí misma.
  for (const source of ACCESS_SOURCES) {
    assert.ok(!/\bti\b(?!_)/.test(source.sql), `la fuente ${source.key} usa el alias suelto ti`);
  }
});

test("un alias externo inventado falla en vez de construir SQL raro", () => {
  assert.throws(() => accessSubqueryCorrelated("ti; DROP TABLE"), /Alias externo inválido/);
});

test("el correlacionado respeta el nivel: por defecto, el estrecho", () => {
  assert.ok(!accessSubqueryCorrelated("ti").includes("'tarea_asignado'"));
  assert.ok(accessSubqueryCorrelated("ti", ACCESS_LEVELS.CONVERSACION).includes("'tarea_asignado'"));
});
