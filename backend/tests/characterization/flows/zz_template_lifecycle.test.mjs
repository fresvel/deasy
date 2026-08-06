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

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "template_lifecycle";

before(async () => {
  await waitForReady();
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
