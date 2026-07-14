// Characterization: ESPACIO DE TRABAJO del usuario (endpoints de lectura de user_router).
//
// Por qué existe este flow: al refactorizar user_controler.js (4118 L, God Object #2)
// se descubrió que los char tests cubrían /users/:id/document-center y /signature-center,
// pero NO el resto de lecturas del router — en particular el PANEL
// (/process-definitions/:definitionId/panel), que es la salida de
// `buildUserProcessDefinitionPanel` (~400 L) y consume casi todo el acceso a datos
// del controller. Extraer ese código sin golden-master sería refactorizar a ciegas.
//
// Estos snapshots fijan el contrato ANTES de mover una sola línea (módulos M3/M4 del
// plan). Ver docs/auditoria-refactor-user-controler-2026-07.md
//
// REQUIERE: seed baseline + setup/seed_execution.mjs (igual que execution.test.mjs).
// Un panel vacío no invalida el golden: fija la forma de la respuesta, que es lo que
// la extracción no debe alterar.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "user_workspace";

// Mismo criterio que execution.test.mjs: rutas/hashes de almacenamiento son
// volátiles (infra) y los auto-increment derivan entre reseeds.
// `requested_at` es la marca de tiempo de la solicitud de firma: la fija el reloj
// de siembra, no la lógica (hermana de created_at/read_at, ya volátiles).
// `effective_from/to` y `start_date/end_date` los fija el RELOJ DE SIEMBRA (el bootstrap los
// pone a "hoy"), no la lógica. Sin enmascararlos, este golden es una bomba de relojería:
// pasa el día que se captura y falla al siguiente, cuando cambia la fecha. Ya ocurrió.
const STORAGE_MASK = [
  "working_file_path", "final_file_path", "payload_object_path", "payload_hash",
  "base_object_prefix", "schema_object_key", "meta_object_key",
  "url", "signedUrl", "downloadUrl", "path",
  "term_name", "requested_at",
  "effective_from", "effective_to", "start_date", "end_date",
];

// `available_terms` se DESCARTA del snapshot de objeto y se fija aparte (abajo) por
// su contrato estructural: el term ad-hoc que siembra el setup lleva un sufijo
// ALEATORIO en `name` (p.ej. "...· #3-mrjdu4l2"), y la clave es `name` a secas —
// enmascararla globalmente borraría también los nombres de proceso/unidad/paso, que
// son justo la señal del JOIN que este golden debe proteger.
const OBJ_OPTS = { extraMask: STORAGE_MASK, maskIdKeys: true, drop: ["available_terms"] };

const USER_ID = FIXTURE.usuarioPersonId;
const DEFINITION_ID = FIXTURE.definitionId;

before(async () => {
  await waitForReady();
});

// --- El panel: la lectura más pesada del controller (M4 + la mayoría de M3) ---

test("GET /users/:id/process-definitions/:definitionId/panel -> panel operativo", async () => {
  const token = await tokenFor("usuario");
  const res = await get(
    `/users/${USER_ID}/process-definitions/${DEFINITION_ID}/panel`,
    { token }
  );
  // 200 (con acceso) o 404 (sin acceso operativo) son ambos contratos válidos y
  // deterministas; lo que NO debe cambiar al refactorizar es cuál de los dos sale.
  assert.ok([200, 404].includes(res.status), `status inesperado: ${res.status}`);
  matchSnapshot(SUITE, "panel_usuario", snapshotShape(res, OBJ_OPTS));
});

// `available_terms` sale de getAvailableTerms (una de las queries de M3): su valor es
// volátil (sufijo aleatorio) pero su CONTRATO DE COLUMNAS no. Eso es lo que se fija.
test("GET .../panel -> available_terms: contrato de columnas (valor volátil)", async () => {
  const token = await tokenFor("usuario");
  const res = await get(
    `/users/${USER_ID}/process-definitions/${DEFINITION_ID}/panel`,
    { token }
  );
  const terms = res.body?.available_terms ?? [];
  assert.ok(Array.isArray(terms), "available_terms debe ser una lista");
  const itemKeys = [...new Set(terms.flatMap((t) => Object.keys(t ?? {})))].sort();
  matchSnapshot(SUITE, "panel_available_terms", { isArray: true, nonEmpty: terms.length > 0, itemKeys });
});

test("GET .../panel con definitionId inexistente -> 404", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/process-definitions/999999/panel`, { token });
  matchSnapshot(SUITE, "panel_definicion_inexistente", snapshotShape(res, OBJ_OPTS));
});

// --- Menú operativo (getUserOperationalProcessRows) ---

test("GET /users/:id/menu -> menú operativo del usuario", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/menu`, { token });
  matchSnapshot(SUITE, "menu_usuario", snapshotShape(res, OBJ_OPTS));
});

// --- Bandejas de envíos / recibidos ---

test("GET /users/:id/my-sends -> entregables enviados", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/my-sends`, { token });
  matchSnapshot(SUITE, "my_sends_usuario", snapshotShape(res, OBJ_OPTS));
});

test("GET /users/:id/my-received -> entregables recibidos", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/my-received`, { token });
  matchSnapshot(SUITE, "my_received_usuario", snapshotShape(res, OBJ_OPTS));
});

// --- Catálogos de apoyo al instanciar entregables ---

test("GET /users/:id/flow-catalog -> catálogo de flujos", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/flow-catalog`, { token });
  matchSnapshot(SUITE, "flow_catalog_usuario", snapshotShape(res, OBJ_OPTS));
});

test("GET /users/:id/addable-deliverables?definition_id -> entregables añadibles", async () => {
  const token = await tokenFor("usuario");
  const res = await get(
    `/users/${USER_ID}/addable-deliverables?definition_id=${DEFINITION_ID}`,
    { token }
  );
  matchSnapshot(SUITE, "addable_deliverables_usuario", snapshotShape(res, OBJ_OPTS));
});

test("GET /users/:id/addable-deliverables sin task_id ni definition_id -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/addable-deliverables`, { token });
  matchSnapshot(SUITE, "addable_deliverables_sin_filtro", snapshotShape(res, OBJ_OPTS));
});

test("GET /users/:id/task-recipients?q -> búsqueda de destinatarios", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${USER_ID}/task-recipients?q=a`, { token });
  matchSnapshot(SUITE, "task_recipients_usuario", snapshotShape(res, OBJ_OPTS));
});

// --- Ownership: un usuario no puede leer el espacio de trabajo de otro ---

test("GET /users/:otro/my-sends -> no expone la bandeja ajena", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/users/${FIXTURE.gestorPersonId}/my-sends`, { token });
  assert.ok(res.status >= 400, `debería denegar, devolvió ${res.status}`);
  matchSnapshot(SUITE, "my_sends_ajeno_denegado", snapshotShape(res, OBJ_OPTS));
});
