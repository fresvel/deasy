// Characterization: CICLO DE VIDA DE PLANTILLAS Y ENTREGABLES (cluster del cut #8).
//
// Por qué existe: son ~1.264 L dentro de `SqlAdminService` (el mayor bloque que queda tras el
// cut #7) y sus caminos de ESCRITURA no tenían cobertura. Solo estaba caracterizado el GET de
// `activation-diff`. Todo lo demás — el update guiado, la publicación, el sync de semillas —
// se iba a mover a ciegas.
//
// Lo que fija:
//   1. El update GUIADO completo: crear borradores (plantilla + configuración clonada) y
//      publicarlos. Es el camino que encadena versionado, clonado de hijos, publicación de
//      plantillas borrador, los tres guards de activación y el retiro de la versión anterior.
//      Si el Extract Class rompe cualquiera de esos eslabones, este golden lo ve.
//   2. El diff de activación sobre el borrador recién creado.
//   3. El sync de semillas contra MinIO.
//   4. Los contratos de error de preview y de use-in-config.
//
// ⚠️ EL PREFIJO "zz_" ES DELIBERADO (misma razón que `zz_task_generation`): los flows corren en
// orden alfabético con --test-concurrency=1 y este MUTA la base — publica una plantilla, activa
// una configuración y retira la anterior. Debe correr EL ÚLTIMO. Va después de
// `zz_task_generation` porque "task" < "template".
//
// Los ids se enmascaran: las secuencias de PostgreSQL NO retroceden al borrar, así que los
// round-trips autolimpiantes de `admin_crud` las hacen avanzar y el id concreto no es estable.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { cleanupDraftArtifactByCode, closeDb } from "../lib/db.mjs";
import { FIXTURE, USERS } from "../config.mjs";

const SUITE = "template_lifecycle";

// Segundo entregable que se cuela en el borrador de configuración durante el update guiado (1.12).
// El `code` es determinista: `draft_<slugify(display_name)>`.
const COLADO = {
  name: "zz char colado",
  code: "draft_zz-char-colado",
};

// PDF mínimo pero válido en estructura (mismos bytes que `zzz_artifact_draft`, para que el
// `content_hash` sea estable si algún día se fija).
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

// Un paso de entrega válido: sin él la plantilla no supera el readiness de publicación.
const FILL_WORKFLOW = JSON.stringify({
  steps: [{ order: 1, resolver_type: "task_assignee", selection_mode: "auto_one" }],
});

before(async () => {
  await waitForReady();
  // Idempotencia: si una corrida anterior murió a medias, los restos se limpian antes de empezar.
  await cleanupDraftArtifactByCode(COLADO.code);
});

after(async () => {
  await cleanupDraftArtifactByCode(COLADO.code);
  await closeDb();
});

// Estado compartido entre los pasos del update guiado (son un flujo, no casos sueltos).
const guided = {};

test("POST /admin/sql/template_seeds/sync -> descubre las semillas publicadas en MinIO", async () => {
  const token = await tokenFor("admin");
  const res = await post("/admin/sql/template_seeds/sync", { token, body: {} });
  matchSnapshot(SUITE, "seed_sync", { status: res.status, body: normalize(res.body, { maskIdKeys: true }) });
  assert.equal(res.status, 200, `el sync debe responder 200: ${JSON.stringify(res.body)}`);
});

test("GET /admin/sql/template_seeds/:id/preview -> contrato cuando no hay PDF publicado", async () => {
  const token = await tokenFor("admin");
  const seeds = await get("/admin/sql/template_seeds", { token });
  const seedId = seeds.body?.[0]?.id;
  assert.ok(seedId, "la fixture debe traer al menos una semilla");
  const res = await get(`/admin/sql/template_seeds/${seedId}/preview`, { token });
  matchSnapshot(SUITE, "seed_preview", { status: res.status, body: normalize(res.body, { maskIdKeys: true }) });
});

test("POST /admin/sql/template_artifacts/use-in-config sin datos -> contrato de error", async () => {
  const token = await tokenFor("admin");
  const res = await post("/admin/sql/template_artifacts/use-in-config", { token, body: {} });
  matchSnapshot(SUITE, "use_in_config_sin_datos", { status: res.status, body: normalize(res.body) });
});

// --- El update guiado, de principio a fin ------------------------------------------------------

test("POST /admin/sql/template_artifacts/guided-update -> crea borrador de plantilla Y de configuración", async () => {
  const token = await tokenFor("admin");
  const templates = await get("/admin/sql/process_definition_templates", { token });
  const link = templates.body?.[0];
  assert.ok(link, "la fixture debe traer una plantilla vinculada");

  const res = await post("/admin/sql/template_artifacts/guided-update", {
    token,
    body: { definition_id: link.process_definition_id, template_artifact_id: link.template_artifact_id },
  });
  matchSnapshot(SUITE, "guided_update_start", { status: res.status, body: normalize(res.body, { maskIdKeys: true }) });
  assert.equal(res.status, 200, `guided-update debe responder 200: ${JSON.stringify(res.body)}`);

  // Lo esencial del graft: sube la versión de AMBOS y deja los dos en borrador.
  assert.equal(res.body?.template_storage_version, "1.1.0", "la plantilla debe subir a 1.1.0");
  assert.equal(res.body?.config_definition_version, "1.1.0", "la configuración debe subir a 1.1.0");
  guided.templateDraftId = res.body?.template_draft_id;
  guided.configDraftId = res.body?.config_draft_id;
  assert.ok(guided.templateDraftId && guided.configDraftId, "deben devolverse ambos ids de borrador");
});

test("GET /admin/sql/process_definitions/:id/activation-diff -> diff del borrador recién creado", async () => {
  const token = await tokenFor("admin");
  assert.ok(guided.configDraftId, "depende del paso anterior");
  const res = await get(`/admin/sql/process_definitions/${guided.configDraftId}/activation-diff`, { token });
  matchSnapshot(SUITE, "activation_diff_borrador", {
    status: res.status,
    topLevelKeys: Object.keys(res.body ?? {}).sort(),
  });
});

// --- Defecto 1.12: un segundo entregable SIN PUBLICAR dentro del borrador de configuración -------
//
// El update guiado versiona UNA plantilla, pero nada impide añadir otro entregable al borrador de
// configuración mientras dura la edición. Ese entregable nace en `draft` y el `finish` no lo mira:
// publica solo la suya, y el gate de activación comprueba `is_active`, no `lifecycle_state`.
test("POST draft vinculado al borrador de configuración -> segundo entregable en borrador", async () => {
  const token = await tokenFor("admin");
  assert.ok(guided.configDraftId, "depende del paso anterior");

  const res = await post("/admin/sql/template_artifacts/draft", {
    token,
    form: {
      display_name: COLADO.name,
      owner_cedula: USERS.admin.identifier,
      process_definition_id: String(guided.configDraftId),
      fill_workflow: FILL_WORKFLOW,
      pdf_file: REFERENCE_PDF,
    },
  });
  matchSnapshot(SUITE, "colado_creado", {
    status: res.status,
    template_code: res.body?.template_code ?? null,
  });
  assert.equal(res.status, 200, `crear el segundo borrador debe responder 200: ${JSON.stringify(res.body)}`);
  guided.coladoId = res.body?.id;
  assert.ok(guided.coladoId, "debe devolverse el id del segundo entregable");
});

test("POST /admin/sql/template_artifacts/guided-update/finish -> publica la plantilla y activa la configuración", async () => {
  const token = await tokenFor("admin");
  assert.ok(guided.templateDraftId, "depende del paso anterior");

  const res = await post("/admin/sql/template_artifacts/guided-update/finish", {
    token,
    body: { template_artifact_id: guided.templateDraftId, config_definition_id: guided.configDraftId },
  });
  matchSnapshot(SUITE, "guided_update_finish", { status: res.status, body: normalize(res.body, { maskIdKeys: true }) });
  assert.equal(res.status, 200, `finish debe responder 200: ${JSON.stringify(res.body)}`);

  // Los tres efectos que encadena: publicar, activar y retirar la anterior de la misma serie.
  assert.equal(res.body?.template_lifecycle_state, "published");
  assert.equal(res.body?.config_status, "active");
  assert.equal(res.body?.retired_previous_config, 1, "la configuración activa anterior debe retirarse");
});

// La clave del golden se llama `defecto_borrador_colado_en_activacion` a propósito y NO se renombra
// al cerrarlo (mismo criterio que `defecto_deliverable_huerfano` en `zzz_artifact_draft`): fijó
// primero el comportamiento ROTO —la configuración quedaba ACTIVA con un entregable en `draft`
// dentro, y `launch.js` no mira `lifecycle_state` en ningún sitio— y el diff de ese golden,
// de "draft" a "published", ES la prueba del arreglo. Renombrarla la borraría.
test("defecto 1.12: la configuración se activa con el segundo entregable aún en borrador", async () => {
  const token = await tokenFor("admin");
  assert.ok(guided.coladoId, "depende del paso anterior");

  const artifacts = await get("/admin/sql/template_artifacts", { token });
  const colado = (artifacts.body || []).find((row) => Number(row.id) === Number(guided.coladoId));
  const definitions = await get("/admin/sql/process_definition_versions", { token });
  const config = (definitions.body || []).find((row) => Number(row.id) === Number(guided.configDraftId));

  matchSnapshot(SUITE, "defecto_borrador_colado_en_activacion", {
    config_status: config?.status ?? null,
    colado_lifecycle_state: colado?.lifecycle_state ?? null,
  });
});

test("tras publicar, la configuración anterior queda retirada y la nueva activa", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/process_definition_versions", { token });
  const byStatus = (res.body || []).reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  matchSnapshot(SUITE, "estado_configuraciones_tras_publicar", { status: res.status, byStatus });
  assert.equal(byStatus.active, 1, "solo puede quedar una configuración activa en la serie");
});

test("GET /admin/sql/process_definitions/:id/activation-diff con configuración inexistente", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/sql/process_definitions/${FIXTURE.definitionId + 99999}/activation-diff`, { token });
  matchSnapshot(SUITE, "activation_diff_inexistente", { status: res.status, body: normalize(res.body) });
});
