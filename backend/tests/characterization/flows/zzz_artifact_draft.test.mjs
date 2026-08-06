// Characterization: BORRADOR DE PLANTILLA (`saveTemplateArtifactDraft`).
//
// Por qué existe: es la función más compleja del backend (541 L, CC 158 según Sonar) y no
// tenía NINGÚN golden. El cut #8 la movió literalmente de fichero; el siguiente paso es
// partirla, y partir a ciegas 541 líneas que escriben en cinco sitios (deliverables,
// template_artifacts, el vínculo a configuración, los flujos sincronizados y MinIO) es
// exactamente lo que esta red de seguridad impide.
//
// ⚠️ EL PREFIJO "zzz_" ES DELIBERADO. Los flows corren en orden alfabético con
// --test-concurrency=1 y este MUTA la base. "zz_artifact_draft" habría corrido el PRIMERO de
// los zz_ ("artifact" < "task" < "template") y habría movido las secuencias y los conteos que
// observan `zz_task_generation` y `zz_template_lifecycle`. Con "zzz_" corre el ÚLTIMO y no
// puede perturbar ningún golden existente.
//
// Qué se fija:
//   1. Los contratos de error de la fase de validación (la mitad de las ramas, y baratos).
//   2. Que `routed` NO exige flujo de entrega (los demás modos sí).
//   3. El camino feliz de CREAR (POST) y de EDITAR (PUT), con su contrato de respuesta.
//   4. El DEFECTO DE COMPENSACIÓN: una creación que falla después del INSERT en `deliverables`
//      deja la fila huérfana. Se fija el comportamiento ROTO a propósito (patrón §3.1.b de la
//      auditoría): cuando se corrija, el diff del golden SERÁ la prueba del arreglo.
//
// Sobre el enmascarado: sólo se enmascara `id`. Medido contra dev, `storage_version`,
// `base_object_prefix` y `content_hash` son DETERMINISTAS — `content_hash` sale idéntico entre
// corridas con la base reseteada y MinIO en distinto estado, y la versión se calcula de la BASE
// (`getNextStorageVersionForTemplateCode` une template_artifacts→deliverables por `code`), no de
// MinIO. Con el round-trip autolimpiante vuelve a 1.0.0 en cada corrida. Fijarlos literalmente
// convierte el golden en una huella byte a byte del meta.yaml, el schema.json, el contrato de la
// semilla y el fichero subido.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, put } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { cleanupDraftArtifactByCode, findDeliverableByCode, closeDb } from "../lib/db.mjs";
import { FIXTURE, USERS } from "../config.mjs";

const SUITE = "artifact_draft";

const DRAFT_PATH = "/admin/sql/template_artifacts/draft";

// `templateCode` es determinista: `draft_<slugify(display_name)>`. Cada caso que escribe usa un
// nombre propio para que el defecto del huérfano no contamine el camino feliz (que reusaría la
// fila `deliverables` por `code`).
const NAMES = {
  happy: "zzz char draft",
  routed: "zzz char routed",
  orphan: "zzz char huerfano",
};
const CODES = {
  happy: "draft_zzz-char-draft",
  routed: "draft_zzz-char-routed",
  orphan: "draft_zzz-char-huerfano",
};

// PDF mínimo pero válido en estructura. Bytes fijos → `content_hash` estable.
const REFERENCE_PDF = {
  filename: "referencia.pdf",
  contentType: "application/pdf",
  content:
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n" +
    "%%EOF\n",
};

// Un paso de entrega válido: el responsable del entregable lo llena.
const FILL_WORKFLOW = JSON.stringify({
  steps: [{ order: 1, resolver_type: "task_assignee", selection_mode: "auto_one" }],
});

// Sólo `id` es volátil (las secuencias de PostgreSQL no retroceden al borrar, así que una
// segunda corrida sin reset daría otro id). Todo lo demás se fija literal a propósito.
const DRAFT_OPTS = { extraMask: ["id"] };

const draftForm = (overrides = {}) => ({
  display_name: NAMES.happy,
  owner_cedula: USERS.admin.identifier,
  process_definition_id: String(FIXTURE.definitionId),
  fill_workflow: FILL_WORKFLOW,
  pdf_file: REFERENCE_PDF,
  ...overrides,
});

before(async () => {
  await waitForReady();
  // Idempotencia: si una corrida anterior murió a medias, los restos se limpian antes de empezar.
  for (const code of Object.values(CODES)) {
    await cleanupDraftArtifactByCode(code);
  }
});

after(async () => {
  for (const code of Object.values(CODES)) {
    await cleanupDraftArtifactByCode(code);
  }
  await closeDb();
});

// --- Contratos de error de la validación (no escriben nada) -------------------------------------

test("POST draft sin nombre -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, { token, form: draftForm({ display_name: "" }) });
  matchSnapshot(SUITE, "error_sin_nombre", { status: res.status, body: normalize(res.body) });
});

test("POST draft sin cedula del propietario -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, { token, form: draftForm({ owner_cedula: "" }) });
  matchSnapshot(SUITE, "error_sin_cedula", { status: res.status, body: normalize(res.body) });
});

test("POST draft sin proceso destino -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, { token, form: draftForm({ process_definition_id: "" }) });
  matchSnapshot(SUITE, "error_sin_proceso", { status: res.status, body: normalize(res.body) });
});

test("POST draft sin documento de referencia -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, { token, form: draftForm({ pdf_file: undefined }) });
  matchSnapshot(SUITE, "error_sin_documento", { status: res.status, body: normalize(res.body) });
});

test("POST draft sin paso de flujo de entrega -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, { token, form: draftForm({ fill_workflow: undefined }) });
  matchSnapshot(SUITE, "error_sin_paso_de_flujo", { status: res.status, body: normalize(res.body) });
});

test("PUT draft de un artifact inexistente -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await put(`${DRAFT_PATH}/999999`, { token, form: draftForm() });
  matchSnapshot(SUITE, "error_artifact_inexistente", { status: res.status, body: normalize(res.body) });
});

test("PUT draft sobre una plantilla PUBLICADA -> guard de inmutabilidad", async () => {
  const token = await tokenFor("admin");
  const list = await get("/admin/sql/template_artifacts", { token });
  const published = (list.body || []).find((row) => String(row.lifecycle_state || "published") !== "draft");
  assert.ok(published, "la fixture debe traer al menos una plantilla no-borrador");

  const res = await put(`${DRAFT_PATH}/${published.id}`, { token, form: draftForm() });
  // El id del artifact publicado depende de lo que dejaron los flows anteriores: se fija el
  // contrato (status + mensaje), no el id.
  matchSnapshot(SUITE, "error_publicada_inmutable", { status: res.status, body: normalize(res.body) });
});

// --- El camino feliz: crear y editar -------------------------------------------------------------

const happy = {};

test("POST draft con PDF y un paso de entrega -> crea el borrador", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, { token, form: draftForm() });
  matchSnapshot(SUITE, "crear_ok", { status: res.status, body: normalize(res.body, DRAFT_OPTS) });
  assert.equal(res.status, 200, `crear el borrador debe responder 200: ${JSON.stringify(res.body)}`);

  happy.id = res.body?.id;
  assert.ok(happy.id, "debe devolverse el id del artifact creado");
});

test("el borrador creado queda en lifecycle_state=draft y vinculado al proceso", async () => {
  const token = await tokenFor("admin");
  assert.ok(happy.id, "depende del paso anterior");

  const artifacts = await get("/admin/sql/template_artifacts", { token });
  const created = (artifacts.body || []).find((row) => Number(row.id) === Number(happy.id));
  const links = await get("/admin/sql/process_definition_templates", { token });
  const link = (links.body || []).find((row) => Number(row.template_artifact_id) === Number(happy.id));

  matchSnapshot(SUITE, "crear_efectos", {
    lifecycle_state: created?.lifecycle_state ?? null,
    storage_version: created?.storage_version ?? null,
    vinculado_al_proceso: Number(link?.process_definition_id) === FIXTURE.definitionId,
    item_mode: link?.item_mode ?? null,
  });
});

test("PUT draft sobre el borrador recién creado -> lo actualiza sin cambiar de versión", async () => {
  const token = await tokenFor("admin");
  assert.ok(happy.id, "depende del paso anterior");

  const res = await put(`${DRAFT_PATH}/${happy.id}`, {
    token,
    form: draftForm({ description: "editado por el characterization test" }),
  });
  matchSnapshot(SUITE, "editar_ok", { status: res.status, body: normalize(res.body, DRAFT_OPTS) });
  assert.equal(res.status, 200, `editar el borrador debe responder 200: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.id, happy.id, "editar NO crea un artifact nuevo");
  assert.equal(res.body?.storage_version, "1.0.0", "editar un borrador NO sube la versión de almacenamiento");
});

// --- `routed` no autora flujo --------------------------------------------------------------------

test("POST draft con item_mode=routed y SIN flujo -> se permite (el flujo es de runtime)", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, {
    token,
    form: draftForm({ display_name: NAMES.routed, item_mode: "routed", fill_workflow: undefined }),
  });
  matchSnapshot(SUITE, "routed_sin_flujo_ok", { status: res.status, body: normalize(res.body, DRAFT_OPTS) });
  assert.equal(res.status, 200, `routed sin flujo debe responder 200: ${JSON.stringify(res.body)}`);
});

// --- DEFECTO DE COMPENSACIÓN (comportamiento ROTO fijado a propósito) ----------------------------

test("POST draft con proceso inexistente -> falla PERO deja el deliverable huérfano", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, {
    token,
    form: draftForm({ display_name: NAMES.orphan, process_definition_id: "999999" }),
  });

  // El `catch` de la función (compensación manual, no hay transacción) borra la fila de
  // `template_artifacts` y el prefijo de MinIO, pero NO la fila de `deliverables` que acaba de
  // insertar. Consecuencia: el siguiente intento con el mismo nombre la REUSA por `code` y se
  // queda con `owner_process_id` NULL para siempre, aunque el artifact sí quede bien vinculado.
  const huerfano = await findDeliverableByCode(CODES.orphan);

  matchSnapshot(SUITE, "defecto_deliverable_huerfano", {
    status: res.status,
    body: normalize(res.body),
    deliverable_superviviente: huerfano,
  });
});
