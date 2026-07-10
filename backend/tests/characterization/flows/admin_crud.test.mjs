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
import { normalize } from "../lib/normalize.mjs";
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
