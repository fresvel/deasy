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

test("el acceso al ENTREGABLE no incluye a los participantes de la TAREA: ése era el IDOR", () => {
  // Medido el 2026-08-22: el entregable 4 tiene ONCE personas repartidas por su tarea. Si la fuente
  // ancha concediera nivel de entregable, esas once podrían descargarlo.
  const claves = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((source) => source.key);
  assert.ok(!claves.includes("tarea_participante"), "el IDOR ha vuelto");
});

test("la fuente ancha es de CONVERSACIÓN y no lleva la acotación al entregable", () => {
  const ancha = ACCESS_SOURCES.find((s) => s.key === "tarea_participante");
  assert.equal(ancha.grants, ACCESS_LEVELS.CONVERSACION);
  assert.ok(!/responsible_position_id/.test(ancha.sql), "la ancha no debe llevar la acotación");
});

test("el entregable ABANDONADO lo abre quien ocupa hoy su puesto, y sólo entonces", () => {
  // `puesto_responsable_asignado` desapareció el 2026-08-23 con `task_assignments`: decía «el
  // asignado del puesto responsable de este entregable», que es exactamente lo que dice
  // `entregable_asignado` leyendo la caché de la tenencia. Dos fuentes con la misma respuesta, y
  // una la leía de una foto que ningún relevo refrescaba.
  const claves = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((source) => source.key);
  assert.ok(!claves.includes("puesto_responsable_asignado"), "ha vuelto la fuente de la foto vieja");
  assert.ok(claves.includes("entregable_asignado"));
  assert.ok(claves.includes("puesto_responsable_ocupante"));

  // El `IS NULL` ES el arreglo: sin él, quien ocupa el puesto entraría en TODOS los entregables de
  // ese puesto, tengan responsable o no — que es la forma ancha del mismo IDOR.
  const ocupante = ACCESS_SOURCES.find((s) => s.key === "puesto_responsable_ocupante");
  assert.match(ocupante.sql, /ti_src\.assigned_person_id IS NULL/);
  assert.match(ocupante.sql, /pa\.position_id = ti_src\.responsible_position_id/);
});

test("el dueño materializado NO es fuente: su valor puede estar rancio", () => {
  // Medido: en el entregable 4 vale 24 mientras la cascada resuelve 3. Dar acceso por ahí es
  // repartir permisos con un dato desincronizado, que es por lo que la columna se muere en P6.
  const claves = ACCESS_SOURCES.map((source) => source.key);
  assert.ok(!claves.includes("documento_dueno"));
});

test("quien ENCARGO el entregable llega a el, y el dato sale del entregable, no de la tarea", () => {
  // `tasks.created_by_user_id` se retiro el 2026-08-23: estaba NULL en 12 de 13 tareas. El unico
  // caso con significado era la ad-hoc, y ahi el creador vive en el propio entregable.
  const claves = sourcesForLevel(ACCESS_LEVELS.ENTREGABLE).map((source) => source.key);
  assert.ok(claves.includes("entregable_creador"));
  assert.ok(!claves.includes("tarea_creador"), "la fuente vieja ha vuelto");

  const fuente = ACCESS_SOURCES.find((s) => s.key === "entregable_creador");
  assert.match(fuente.sql, /ti_src\.created_by_person_id/);
  assert.ok(!/created_by_user_id/.test(fuente.sql), "sigue leyendo la columna retirada");
});

test("el ocupante actual del puesto entra sólo cuando el entregable está SIN responsable", () => {
  // La condición se leía de `task_assignments` («la asignación está vacía») y ahora se lee del
  // propio entregable, que es la caché de su tenencia vigente: sin persona = abandonado.
  const ocupante = ACCESS_SOURCES.find((s) => s.key === "puesto_responsable_ocupante");
  assert.match(ocupante.sql, /pa\.is_current = 1/);
  assert.match(ocupante.sql, /ti_src\.assigned_person_id IS NULL/);
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
  assert.ok(conn.queries[0].sql.includes("'tarea_participante'"));
  assert.ok(conn.queries[0].sql.includes("'entregable_creador'"));
});

test("las dos mitades que hoy están divididas entre los dos guards están las dos", () => {
  const keys = ACCESS_SOURCES.map((source) => source.key);
  // Las que sólo tenía el guard del documento
  assert.ok(keys.includes("flujo_entrega"));
  assert.ok(keys.includes("flujo_firma"));
  // Las que sólo tenía el chat
  assert.ok(keys.includes("entregable_creador"));
  assert.ok(keys.includes("tarea_participante"));
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
  assert.ok(!accessSubqueryCorrelated("ti").includes("'tarea_participante'"));
  assert.ok(accessSubqueryCorrelated("ti", ACCESS_LEVELS.CONVERSACION).includes("'tarea_participante'"));
});
