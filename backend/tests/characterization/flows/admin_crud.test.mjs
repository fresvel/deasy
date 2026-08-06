// Characterization: CRUD genérico de admin y grafos (SqlAdminService).
//
// Esta es la RED DE SEGURIDAD para partir `SqlAdminService` (6851 líneas). Antes
// de este fichero, sus dos funciones más complejas — `create()` (complejidad
// cognitiva 163) y `update()` (218) — no tenían ni un solo test, igual que el
// grafo de unidades y el de procesos.
//
// Lo que se fija aquí:
//   1. El CONTRATO DE ERRORES de create/update. Son mensajes sin ids, así que el
//      golden es estable y captura el orden real de los guards. Ojo: en `create()`
//      la comprobación de campos requeridos corre ANTES que `validateTableRules`,
//      y varias tablas tienen guards propios aún antes; el mensaje que emerge no
//      es necesariamente el del `case` correspondiente del switch.
//   2. El round-trip create -> update -> delete sobre una tabla simple.
//   3. La forma de los grafos y detalles. `processes/graph`, `processes/:id/detail`
//      y `units/:id/processes` estuvieron ROTOS en PostgreSQL (usaban FIELD(), una
//      función de MySQL) sin que ningún test lo notara. Estos casos son su guardia
//      de regresión.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, put, del } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize, listFingerprint } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "admin_crud";

before(async () => {
  await waitForReady();
});

// Huella de un grafo: su tamaño y el contrato de claves de nodos/aristas. Fijar
// cada nodo sería ruidoso y frágil; lo que queremos detectar es que el endpoint
// deje de responder o cambie de forma.
const graphFingerprint = (response) => {
  const body = response.body ?? {};
  const keysOf = (list) => {
    const keys = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      if (item && typeof item === "object") Object.keys(item).forEach((k) => keys.add(k));
    }
    return [...keys].sort();
  };
  return {
    status: response.status,
    topLevelKeys: Object.keys(body).sort(),
    nodeCount: Array.isArray(body.nodes) ? body.nodes.length : null,
    edgeCount: Array.isArray(body.edges) ? body.edges.length : null,
    nodeKeys: keysOf(body.nodes),
    edgeKeys: keysOf(body.edges),
  };
};

// --- 1. Contrato de errores de POST /admin/sql/:table -------------------------

const CREATE_ERROR_CASES = [
  ["tabla_desconocida", "tabla_inexistente", {}],
  ["campo_requerido_ausente", "unit_types", {}],
  ["unit_relations_consigo_misma", "unit_relations", { parent_unit_id: 2, child_unit_id: 2, relation_type_id: 1 }],
  ["series_sin_origen", "process_definition_series", {}],
  ["version_sin_serie", "process_definition_versions", {}],
  ["regla_sin_configuracion", "process_target_rules", {}],
  ["tarea_sin_configuracion", "tasks", {}],
  ["documento_sin_propietario", "documents", {}],
];

for (const [key, table, body] of CREATE_ERROR_CASES) {
  test(`POST /admin/sql/${table} inválido -> error de negocio (${key})`, async () => {
    const token = await tokenFor("admin");
    const res = await post(`/admin/sql/${table}`, { token, body });
    matchSnapshot(SUITE, `create_error_${key}`, { status: res.status, body: normalize(res.body) });
  });
}

// --- 2. Contrato de errores de PUT /admin/sql/:table --------------------------

const UPDATE_ERROR_CASES = [
  ["tabla_desconocida", "tabla_inexistente", { keys: { id: 1 }, data: {} }],
  ["registro_inexistente", "unit_types", { keys: { id: 999999 }, data: { name: "X" } }],
  ["sin_llave_primaria", "unit_types", { keys: {}, data: { name: "X" } }],
];

for (const [key, table, body] of UPDATE_ERROR_CASES) {
  test(`PUT /admin/sql/${table} inválido -> error de negocio (${key})`, async () => {
    const token = await tokenFor("admin");
    const res = await put(`/admin/sql/${table}`, { token, body });
    matchSnapshot(SUITE, `update_error_${key}`, { status: res.status, body: normalize(res.body) });
  });
}

// --- 3. Round-trip create -> update -> delete ---------------------------------
// Sobre `unit_types`, cuya cuenta no fija ningún otro golden. Se limpia al final,
// así que la fixture queda como estaba.

test("POST/PUT/DELETE /admin/sql/unit_types -> ciclo de vida completo", async () => {
  const token = await tokenFor("admin");

  const created = await post("/admin/sql/unit_types", {
    token,
    body: { name: "Tipo caracterización", is_active: 1 },
  });
  matchSnapshot(SUITE, "roundtrip_create", {
    status: created.status,
    body: normalize(created.body, { maskIdKeys: true }),
  });

  const id = created.body?.id;
  assert.ok(id, "create debe devolver el id de la fila insertada");

  const updated = await put("/admin/sql/unit_types", {
    token,
    body: { keys: { id }, data: { name: "Tipo caracterización (renombrado)" } },
  });
  matchSnapshot(SUITE, "roundtrip_update", {
    status: updated.status,
    body: normalize(updated.body, { maskIdKeys: true }),
  });

  const removed = await del("/admin/sql/unit_types", { token, body: { keys: { id } } });
  matchSnapshot(SUITE, "roundtrip_delete", {
    status: removed.status,
    body: normalize(removed.body, { maskIdKeys: true }),
  });

  // La fila ya no existe: actualizarla debe fallar igual que un id inventado.
  const afterDelete = await put("/admin/sql/unit_types", {
    token,
    body: { keys: { id }, data: { name: "Zombi" } },
  });
  assert.equal(afterDelete.status, 400, "actualizar una fila borrada debe fallar");
});

// --- 4. Grafos y detalles (guardia de regresión de FIELD()) -------------------

test("GET /admin/sql/units/graph -> grafo de unidades", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/units/graph", { token });
  matchSnapshot(SUITE, "units_graph", graphFingerprint(res));
});

test("GET /admin/sql/processes/graph -> grafo de procesos", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/processes/graph", { token });
  assert.equal(res.status, 200, `processes/graph debe responder 200: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "processes_graph", graphFingerprint(res));
});

test("GET /admin/sql/units/:id/detail -> detalle de unidad", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/sql/units/${FIXTURE.unitId}/detail`, { token });
  matchSnapshot(SUITE, "unit_detail", {
    status: res.status,
    topLevelKeys: Object.keys(res.body ?? {}).sort(),
    unit: normalize(res.body?.unit, { maskIdKeys: true }),
    positionCount: Array.isArray(res.body?.positions) ? res.body.positions.length : null,
  });
});

test("GET /admin/sql/processes/:id/detail -> detalle de proceso", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/sql/processes/${FIXTURE.processId}/detail`, { token });
  assert.equal(res.status, 200, `processes/:id/detail debe responder 200: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "process_detail", {
    status: res.status,
    topLevelKeys: Object.keys(res.body ?? {}).sort(),
    process: normalize(res.body?.process, { maskIdKeys: true }),
    configurationCount: Array.isArray(res.body?.configurations) ? res.body.configurations.length : null,
  });
});

test("GET /admin/sql/units/:id/processes -> procesos de la unidad", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/sql/units/${FIXTURE.unitId}/processes`, { token });
  assert.equal(res.status, 200, `units/:id/processes debe responder 200: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "unit_processes", {
    status: res.status,
    topLevelKeys: Object.keys(res.body ?? {}).sort(),
    processCount: Array.isArray(res.body?.processes) ? res.body.processes.length : null,
  });
});

// El schema del artifact procesa available_formats con parseAvailableFormats. Fija su
// contrato de claves: guardia de la unificación de esa función (antes triplicada).
test("GET /admin/sql/template_artifacts/:id/schema -> esquema del artifact", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/template_artifacts/1/schema", { token });
  assert.equal(res.status, 200, `schema debe responder 200: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "template_artifact_schema", {
    status: res.status,
    topLevelKeys: Object.keys(res.body ?? {}).sort(),
  });
});

// --- 5. Contrato de LECTURA del list() genérico ------------------------------
// El motor de lectura de SqlAdminService (`list`) no tenía NINGÚN test. Se fija su
// huella (status + conteo + contrato de columnas) sobre las tablas que el refactor
// por Extract Class va a tocar: si mover código altera qué columnas devuelve el list
// de una tabla, o rompe la consulta, esto lo detecta. Conteo y claves son deterministas
// con el bootstrap+seed de la fixture. Es la guardia del futuro `SqlCrudEngine`.
const LIST_TABLES = [
  "persons", "units", "unit_types", "unit_relations", "relation_unit_types",
  "cargos", "unit_positions", "position_assignments", "term_types", "terms",
  "processes", "process_definition_series", "process_definition_versions",
  "process_target_rules", "process_definition_templates",
  "template_seeds", "template_artifacts",
  "tasks", "task_items", "task_assignments", "documents", "document_versions",
  "roles", "permissions", "role_permissions", "cargo_role_map",
];

for (const table of LIST_TABLES) {
  test(`GET /admin/sql/${table} -> contrato de lectura del list()`, async () => {
    const token = await tokenFor("admin");
    const res = await get(`/admin/sql/${table}`, { token });
    matchSnapshot(SUITE, `list_${table}`, listFingerprint(res));
  });
}

// --- 6. Endpoints de LECTURA de los subsistemas (guardia del Extract Class) ---
// Cada uno vive en un subsistema que el refactor separará en su propia clase
// (versionado de definiciones, target-scope/series, task-assignment, artifacts).
// Son GET puros, sin efectos. Se fija su forma de respuesta; el valor concreto no
// importa, sí que el endpoint siga respondiendo con la misma forma tras mover el código.
test("GET /admin/sql/template_artifacts/versions -> versiones de artifacts", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/template_artifacts/versions", { token });
  matchSnapshot(SUITE, "template_artifact_versions", listFingerprint(res));
});

const READ_SUBSYSTEM_CASES = [
  ["activation_diff", `/admin/sql/process_definitions/${FIXTURE.definitionId}/activation-diff`],
  ["target_scope", `/admin/sql/process_definitions/${FIXTURE.definitionId}/target-scope`],
  ["resolvable_cargos", `/admin/sql/process_definitions/${FIXTURE.definitionId}/resolvable-cargos`],
  ["series_scope", `/admin/sql/process_definitions/${FIXTURE.definitionId}/series-scope`],
  ["stuck_task_items", "/admin/sql/task-items/stuck"],
  ["unit_attachable_processes", `/admin/sql/units/${FIXTURE.unitId}/attachable-processes`],
];

// Huella estable para respuestas que pueden ser array u objeto: solo forma, sin
// contenido volátil (un objeto se reduce a sus claves de primer nivel).
const readShape = (res) => ({
  status: res.status,
  shape: Array.isArray(res.body)
    ? {
        isArray: true,
        count: res.body.length,
        itemKeys: [
          ...new Set(res.body.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : []))),
        ].sort(),
      }
    : { isArray: false, topLevelKeys: Object.keys(res.body ?? {}).sort() },
});

for (const [key, path] of READ_SUBSYSTEM_CASES) {
  test(`GET ${path} -> ${key}`, async () => {
    const token = await tokenFor("admin");
    const res = await get(path, { token });
    matchSnapshot(SUITE, `read_${key}`, readShape(res));
  });
}

// --- 7. SUCCESS de los grafts por-tabla (red para el registro de hooks del cut #7) ------------
// create()/update() tienen ~20 ramas `if (tableName === X)` que TRANSFORMAN el payload por tabla
// (hash de password, validación de cabeza de unidad, ids derivados...). El cut #7 las convertirá en
// un registro de hooks; estos round-trips capturan la SALIDA OBSERVABLE del graft en su camino de
// ÉXITO, que el refactor debe preservar. Son AUTOLIMPIANTES (crear -> fijar -> borrar) para no
// alterar los conteos de las huellas `list_*` de la sección 5. El mapa de cobertura completo
// (qué graft se cubre cómo, y la estrategia por-tabla del cut #7) está en
// docs/auditoria-god-objects-2026-07.md.

test("POST /admin/sql/persons -> graft: hashea la contraseña (no la devuelve) y genera token", async () => {
  const token = await tokenFor("admin");
  const created = await post("/admin/sql/persons", {
    token,
    body: {
      cedula: "9999999999",
      first_name: "Caracterizacion",
      last_name: "Grafts",
      email: "caract-grafts@test.local",
      password: "Demo1234!",
      cargo_id: 1,
      role_id: 1,
    },
  });
  matchSnapshot(SUITE, "graft_persons_create", {
    status: created.status,
    body: normalize(created.body, { maskIdKeys: true }),
  });
  const id = created.body?.id;
  assert.ok(id, "persons create debe devolver el id de la fila insertada");
  // El graft de persons es de SEGURIDAD: hashea la contraseña y NUNCA la devuelve, y genera un token.
  assert.ok(!("password" in (created.body || {})), "la respuesta NO debe exponer 'password'");
  assert.ok(!("password_hash" in (created.body || {})), "la respuesta NO debe exponer 'password_hash'");
  assert.ok(created.body?.token, "el graft de persons debe generar un token");

  await del("/admin/sql/persons", { token, body: { keys: { id } } });
});

test("POST /admin/sql/unit_positions -> graft: valida cabeza/tipo y crea el puesto", async () => {
  const token = await tokenFor("admin");
  const created = await post("/admin/sql/unit_positions", {
    token,
    body: { unit_id: FIXTURE.unitId, cargo_id: 1, slot_no: 99, is_unit_head: 0, position_type: "real" },
  });
  matchSnapshot(SUITE, "graft_unit_positions_create", {
    status: created.status,
    body: normalize(created.body, { maskIdKeys: true }),
  });
  const id = created.body?.id;
  assert.ok(id, "unit_positions create debe devolver el id de la fila insertada");

  await del("/admin/sql/unit_positions", { token, body: { keys: { id } } });
});

// El graft de update de unit_positions NO es el mismo que el de create: calcula los valores
// EFECTIVOS mezclando `updates` con la fila existente antes de validar. Aquí `position_type` no
// viaja en el PUT, así que sale de `existing` — si el merge se rompiera, la validación de cabeza
// de unidad se haría contra `undefined` y este 200 pasaría a 400.
// Necesita una unidad SIN cabeza (la unidad de la fixture ya tiene una y chocaría con uq_unit_head),
// así que fabrica la suya.
test("PUT /admin/sql/unit_positions -> graft: valida cabeza/tipo sobre el merge con la fila existente", async () => {
  const token = await tokenFor("admin");
  const unitTypes = await get("/admin/sql/unit_types", { token });
  const unitTypeId = unitTypes.body?.[0]?.id;
  assert.ok(unitTypeId, "hace falta al menos un tipo de unidad en la fixture");

  const unit = await post("/admin/sql/units", {
    token,
    body: { name: "Unidad caracterización puesto", slug: "unidad-caract-puesto", unit_type_id: unitTypeId },
  });
  const unitId = unit.body?.id;
  assert.ok(unitId, "units create debe devolver id");

  const created = await post("/admin/sql/unit_positions", {
    token,
    body: { unit_id: unitId, cargo_id: 1, slot_no: 1, is_unit_head: 0, position_type: "real" },
  });
  const id = created.body?.id;
  assert.ok(id, "unit_positions create debe devolver id");

  // `position_type` NO viaja en el PUT: sale de `existing`. Si el merge se rompiera, la validación
  // correría contra `undefined` y este 200 pasaría a 400.
  const updated = await put("/admin/sql/unit_positions", {
    token,
    body: { keys: { id }, data: { is_unit_head: 1 } },
  });
  matchSnapshot(SUITE, "graft_unit_positions_update", {
    status: updated.status,
    body: normalize(updated.body, { maskIdKeys: true }),
  });
  assert.equal(updated.status, 200, `el merge debe permitir cabeza sobre un puesto real: ${JSON.stringify(updated.body)}`);

  // Y el guard SÍ salta en el sentido contrario: el tipo llega en el PUT y la cabeza de `existing`.
  const rejected = await put("/admin/sql/unit_positions", {
    token,
    body: { keys: { id }, data: { position_type: "simbolico" } },
  });
  matchSnapshot(SUITE, "graft_unit_positions_update_head_rechazada", {
    status: rejected.status,
    body: normalize(rejected.body, { maskIdKeys: true }),
  });

  await del("/admin/sql/unit_positions", { token, body: { keys: { id } } });
  await del("/admin/sql/units", { token, body: { keys: { id: unitId } } });
});

// `persons` tiene graft en AMBOS métodos y ambos son de seguridad. El de update rehashea la
// contraseña que llega en claro y no debe devolverla nunca.
test("PUT /admin/sql/persons -> graft: rehashea la contraseña y no la devuelve", async () => {
  const token = await tokenFor("admin");
  const created = await post("/admin/sql/persons", {
    token,
    body: {
      cedula: "9999999998",
      first_name: "Caracterizacion",
      last_name: "GraftsUpdate",
      email: "caract-grafts-upd@test.local",
      password: "Demo1234!",
      cargo_id: 1,
      role_id: 1,
    },
  });
  const id = created.body?.id;
  assert.ok(id, "persons create debe devolver id");

  const updated = await put("/admin/sql/persons", {
    token,
    body: { keys: { id }, data: { password: "Otra1234!" } },
  });
  matchSnapshot(SUITE, "graft_persons_update", {
    status: updated.status,
    body: normalize(updated.body, { maskIdKeys: true }),
  });
  assert.ok(!("password" in (updated.body || {})), "la respuesta NO debe exponer 'password'");
  assert.ok(!("password_hash" in (updated.body || {})), "la respuesta NO debe exponer 'password_hash'");

  await del("/admin/sql/persons", { token, body: { keys: { id } } });
});

// `unit_relations` valida jerarquía: unicidad de padre por tipo de relación y ausencia de ciclos.
// Necesita una unidad hija SIN padre en ese tipo, así que la fabrica y la limpia.
test("POST/PUT /admin/sql/unit_relations -> graft: padre único por tipo y sin ciclos", async () => {
  const token = await tokenFor("admin");
  const unitTypes = await get("/admin/sql/unit_types", { token });
  const unitTypeId = unitTypes.body?.[0]?.id;
  assert.ok(unitTypeId, "hace falta al menos un tipo de unidad en la fixture");

  const childUnit = await post("/admin/sql/units", {
    token,
    body: { name: "Unidad caracterización rel", slug: "unidad-caract-rel", unit_type_id: unitTypeId },
  });
  const childUnitId = childUnit.body?.id;
  assert.ok(childUnitId, "units create debe devolver id");

  const created = await post("/admin/sql/unit_relations", {
    token,
    body: { parent_unit_id: FIXTURE.unitId, child_unit_id: childUnitId, relation_type_id: 1 },
  });
  matchSnapshot(SUITE, "graft_unit_relations_create", {
    status: created.status,
    body: normalize(created.body, { maskIdKeys: true }),
  });
  const relationId = created.body?.id;
  assert.ok(relationId, "unit_relations create debe devolver id");

  // Un segundo padre para la misma hija y tipo debe rechazarse (unicidad del graft).
  const duplicated = await post("/admin/sql/unit_relations", {
    token,
    body: { parent_unit_id: 1, child_unit_id: childUnitId, relation_type_id: 1 },
  });
  matchSnapshot(SUITE, "graft_unit_relations_padre_duplicado", {
    status: duplicated.status,
    body: normalize(duplicated.body),
  });

  // Reasignar el padre por PUT sí es válido: el graft de update excluye la propia fila del duplicado.
  const updated = await put("/admin/sql/unit_relations", {
    token,
    body: { keys: { id: relationId }, data: { parent_unit_id: 1 } },
  });
  matchSnapshot(SUITE, "graft_unit_relations_update", {
    status: updated.status,
    body: normalize(updated.body, { maskIdKeys: true }),
  });

  await del("/admin/sql/unit_relations", { token, body: { keys: { id: relationId } } });
  await del("/admin/sql/units", { token, body: { keys: { id: childUnitId } } });
});

// `vacancies` es el ÚNICO graft que corre DESPUÉS de validateTableRules: el orden importa y este
// caso lo fija (un puesto simbólico no admite vacante).
test("POST /admin/sql/vacancies -> graft: solo puestos reales o de promoción", async () => {
  const token = await tokenFor("admin");
  const position = await post("/admin/sql/unit_positions", {
    token,
    body: { unit_id: FIXTURE.unitId, cargo_id: 1, slot_no: 97, is_unit_head: 0, position_type: "real" },
  });
  const positionId = position.body?.id;
  assert.ok(positionId, "unit_positions create debe devolver id");

  const created = await post("/admin/sql/vacancies", {
    token,
    body: {
      position_id: positionId,
      title: "Vacante caracterización",
      dedication: "TC",
      relation_type: "dependencia",
    },
  });
  matchSnapshot(SUITE, "graft_vacancies_create", {
    status: created.status,
    body: normalize(created.body, { maskIdKeys: true }),
  });
  assert.equal(created.status, 200, `la vacante sobre un puesto real debe crearse: ${JSON.stringify(created.body)}`);
  const vacancyId = created.body?.id;

  // El graft corre DESPUÉS de validateTableRules: con todos los campos presentes, el mensaje que
  // emerge es el suyo, no el de "datos incompletos".
  const inexistente = await post("/admin/sql/vacancies", {
    token,
    body: {
      position_id: 999999,
      title: "Vacante fantasma",
      dedication: "TC",
      relation_type: "dependencia",
    },
  });
  matchSnapshot(SUITE, "graft_vacancies_puesto_inexistente", {
    status: inexistente.status,
    body: normalize(inexistente.body),
  });

  if (vacancyId) {
    await del("/admin/sql/vacancies", { token, body: { keys: { id: vacancyId } } });
  }
  await del("/admin/sql/unit_positions", { token, body: { keys: { id: positionId } } });
});

// `cargos`, `unit_types` y `processes` comparten un graft POST-UPDATE en el camino genérico:
// renombrarlos regenera los nombres de las configuraciones de proceso que dependen de ellos.
// (`unit_types` ya lo ejercita el round-trip de la sección 3.)
test("PUT /admin/sql/cargos -> graft: renombrar refresca los nombres de configuraciones", async () => {
  const token = await tokenFor("admin");
  const created = await post("/admin/sql/cargos", {
    token,
    body: { code: "CARACT", name: "Cargo caracterización", is_active: 1 },
  });
  const id = created.body?.id;
  assert.ok(id, "cargos create debe devolver id");

  const updated = await put("/admin/sql/cargos", {
    token,
    body: { keys: { id }, data: { name: "Cargo caracterización (renombrado)" } },
  });
  matchSnapshot(SUITE, "graft_cargos_update", {
    status: updated.status,
    body: normalize(updated.body, { maskIdKeys: true }),
  });

  await del("/admin/sql/cargos", { token, body: { keys: { id } } });
});

test("PUT /admin/sql/processes -> graft: renombrar refresca los nombres de configuraciones", async () => {
  const token = await tokenFor("admin");
  const created = await post("/admin/sql/processes", {
    token,
    body: { name: "Proceso caracterización", slug: "proceso-caracterizacion", is_active: 1 },
  });
  const id = created.body?.id;
  assert.ok(id, "processes create debe devolver id");

  const updated = await put("/admin/sql/processes", {
    token,
    body: { keys: { id }, data: { name: "Proceso caracterización (renombrado)" } },
  });
  matchSnapshot(SUITE, "graft_processes_update", {
    status: updated.status,
    body: normalize(updated.body, { maskIdKeys: true }),
  });

  await del("/admin/sql/processes", { token, body: { keys: { id } } });
});
