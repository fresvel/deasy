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
