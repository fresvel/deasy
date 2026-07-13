// Characterization: GENERACIÓN Y LANZAMIENTO DE TAREAS (TaskGenerationService, 2006 L).
//
// Por qué existe: los 4 endpoints que alimenta este servicio NO tenían ninguna
// cobertura. El setup solo lo ejercía de refilón por /users/:id/general-tasks (camino
// ad-hoc); todo el camino de LANZAMIENTO — launchDefinitionInTerm, ensureProcessRun,
// ensureTaskItemsForTask, ensureTaskAssignmentsForDefinition, generateTasksForTerm —
// estaba a ciegas. Este flow lo fija ANTES de partir el God Object.
//
// ⚠️ EL PREFIJO "zz_" ES DELIBERADO, NO UN DESCUIDO.
// Los flows se ejecutan en orden alfabético (glob) y con --test-concurrency=1. Este
// flow MUTA la base (lanzar una definición crea process_runs, tasks y task_items), así
// que debe correr EL ÚLTIMO: si corriera antes, sus escrituras alterarían los golden de
// execution/tasks/user_workspace (panel, document-center...) y los romperían.
// Si algún día añades un flow que ordene después de este, muévelo o renómbralo.
//
// Dentro del fichero el orden TAMBIÉN importa: primero se fijan los estados "antes de
// lanzar", luego se lanza, luego el "después".
//
// 🔶 DEFECTO FIJADO TAL CUAL (no corregido aquí): el "no encontrado" es incoherente
// entre endpoints. /launch devuelve 400 ante una definición inexistente, mientras
// /launch-info, /launch-status y /generate-tasks devuelven 500 ante term/definición
// inexistente (la excepción "Periodo no encontrado." cae en el catch genérico). Lo
// correcto seria 404 en los cuatro. Se captura el comportamiento ACTUAL para que el
// refactor no lo altere; cambiarlo es una decision de contrato aparte.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "task_generation";

// Los ids de la capa de ejecución derivan entre reseeds; las fechas del term sentinela
// (1900-01-01 / 9999-12-31) son estables y sí forman parte del contrato.
const OBJ_OPTS = { extraMask: ["launched_at", "created_at", "term_name"], maskIdKeys: true };

const DEFINITION_ID = FIXTURE.definitionId; // 1 = "Proceso por defecto" (routed, Permanente)
const TERM_ID = 1;                          // term sentinela "Permanente"

before(async () => {
  await waitForReady();
});

// ─── 1. Estado ANTES de lanzar (getTermLaunchStatus / getDefinitionLaunchInfo) ───

test("GET /admin/terms/:termId/launch-status (sin lanzar) -> pendiente", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/terms/${TERM_ID}/launch-status`, { token });
  assert.equal(res.status, 200);
  assert.equal(res.body?.definitions?.[0]?.launched, false, "la definición aún no debe estar lanzada");
  matchSnapshot(SUITE, "launch_status_antes", snapshotShape(res, OBJ_OPTS));
});

test("GET /admin/process-definitions/:id/launch-info (sin lanzar) -> términos disponibles", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/process-definitions/${DEFINITION_ID}/launch-info`, { token });
  assert.equal(res.status, 200);
  matchSnapshot(SUITE, "launch_info_antes", snapshotShape(res, OBJ_OPTS));
});

// ─── 2. Rutas de error (NO mutan) — fijan el defecto de status descrito arriba ───

test("GET /admin/terms/:termId/launch-status con periodo inexistente -> 500 (deberia ser 404)", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/terms/999999/launch-status", { token });
  matchSnapshot(SUITE, "launch_status_periodo_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("GET /admin/process-definitions/:id/launch-info inexistente -> 500 (deberia ser 404)", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/process-definitions/999999/launch-info", { token });
  matchSnapshot(SUITE, "launch_info_definicion_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/process-definitions/:id/launch inexistente -> 400 (incoherente con los GET)", async () => {
  const token = await tokenFor("admin");
  const res = await post("/admin/process-definitions/999999/launch", { token, body: { term_id: TERM_ID } });
  matchSnapshot(SUITE, "launch_definicion_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/process-definitions/:id/launch sin term_id -> 400", async () => {
  const token = await tokenFor("admin");
  const res = await post(`/admin/process-definitions/${DEFINITION_ID}/launch`, { token, body: {} });
  matchSnapshot(SUITE, "launch_sin_term", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/terms/:termId/generate-tasks con periodo inexistente -> 500 (deberia ser 404)", async () => {
  const token = await tokenFor("admin");
  const res = await post("/admin/terms/999999/generate-tasks", { token });
  matchSnapshot(SUITE, "generate_tasks_periodo_inexistente", snapshotShape(res, OBJ_OPTS));
});

// OJO: aquí NO vale probar el 403 con el usuario "usuario". Parece de baja privilegia,
// pero `cargo_role_map` lo ELEVA a GestorEjecucionProcesos por su cargo DOCENTE (ver
// config.mjs), así que SÍ tiene process_execution.create y el lanzamiento le sale 200
// — mutando la base antes del test de lanzamiento de abajo. El 403 por permisos ya está
// cubierto en rbac.test.mjs; aquí basta la puerta de autenticación, que no muta.
test("POST /admin/process-definitions/:id/launch sin token -> 401", async () => {
  const res = await post(`/admin/process-definitions/${DEFINITION_ID}/launch`, { body: { term_id: TERM_ID } });
  assert.equal(res.status, 401, `debería exigir token, devolvió ${res.status}`);
  matchSnapshot(SUITE, "launch_sin_token", snapshotShape(res, OBJ_OPTS));
});

// ─── 3. Lanzamiento real (MUTA) — el camino que estaba a ciegas ───

test("POST /admin/process-definitions/:id/launch -> lanza la definicion en el periodo", async () => {
  const token = await tokenFor("admin");
  const res = await post(`/admin/process-definitions/${DEFINITION_ID}/launch`, {
    token,
    body: { term_id: TERM_ID },
  });
  assert.equal(res.status, 200, `el lanzamiento debe funcionar: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "launch_ok", snapshotShape(res, OBJ_OPTS));
});

test("GET /admin/terms/:termId/launch-status (tras lanzar) -> launched=true y run activo", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/terms/${TERM_ID}/launch-status`, { token });
  assert.equal(res.status, 200);
  const def = res.body?.definitions?.[0];
  assert.equal(def?.launched, true, "tras lanzar, launched debe ser true");
  assert.ok(def?.run_count >= 1, "debe haber al menos una corrida");
  matchSnapshot(SUITE, "launch_status_despues", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/terms/:termId/generate-tasks -> generacion automatica idempotente", async () => {
  const token = await tokenFor("admin");
  const res = await post(`/admin/terms/${TERM_ID}/generate-tasks`, { token });
  matchSnapshot(SUITE, "generate_tasks_ok", snapshotShape(res, OBJ_OPTS));
});
