// Characterization: LOS PASOS DE FLUJO TAL COMO QUEDAN EN LA BASE.
//
// Por qué existe (sub-paso 0 de `docs/planes/plan-maestro-2026-08.md` §0.8). Se va a INVERTIR la
// dirección del flujo: hoy el formulario web escribe el `meta.yaml`, lo sube a MinIO y
// `workflowSync` lo proyecta a `fill_flow_steps` / `signature_flow_steps` con DELETE+INSERT;
// después, el formulario escribirá directo en la base y el `meta.yaml` desaparecerá.
//
// La red que había NO sirve para eso. `zzz_artifact_draft` fija `content_hash`, que es el hash del
// directorio del paquete de MinIO — y ese directorio INCLUYE el `meta.yaml`. En cuanto dejemos de
// escribir el flujo en ese fichero el hash cambia POR CONSTRUCCIÓN, sin decir nada sobre si el flujo
// sigue siendo el mismo. Es pesar la caja en vez de mirar lo que hay dentro.
//
// Este flow mira dentro: observa las filas de flujo en PostgreSQL. Cuando llegue la inversión, estos
// goldens deben salir IDÉNTICOS. Si salen idénticos, la inversión no cambió el comportamiento; si se
// mueven, el diff señala el paso y la columna exactos.
//
// ⚠️ EL ORÁCULO NO PUEDE SER `GET /template_artifacts/:id/schema`. Ese endpoint devuelve el flujo en
// forma de formulario, pero HOY LO LEE DEL `meta.yaml` (`templateArtifact.js:127-181`): mediría justo
// lo que vamos a cambiar y se movería entero en el sub-paso 3 sin que nada del comportamiento se
// hubiera roto. El oráculo es la BASE.
//
// ⚠️ EL PREFIJO "zzzzzz_" ES DELIBERADO (seis zetas, una más que `zzzzz_task_item_relay`). Los flows
// corren en orden alfabético con --test-concurrency=1 y la colación del contenedor es POSIX (byte a
// byte: '_' 0x5F < 'z' 0x7A), así que "zzzzz_task_item_relay" < "zzzzzz_flow_steps_db" y este corre
// el ÚLTIMO. Tiene que ser el último por dos razones independientes:
//   · ESCRIBE: autorar un borrador con flujo inserta en deliverables, template_artifacts,
//     process_definition_templates y las cuatro tablas de flujo, y mueve sus secuencias. Corriendo
//     antes movería las huellas `list_*` de admin_crud y los ids de los flows que escriben.
//   · LEE EL ESTADO ACUMULADO: el golden de plantilla incluye lo que dejan `zz_template_lifecycle`
//     (la configuración clonada y su artifact v1.1.0) y `zzz_artifact_draft` (que limpia lo suyo).
//     Eso NO es contaminación: la v1.1.0 heredó su flujo por la copia BINARIA de MinIO, sin que nadie
//     lo autorara, y es exactamente el caso que el sub-paso 5 («el versionado copia FILAS, no bytes»)
//     tiene que arreglar. Congelarlo aquí es lo que le da un antes y un después.
//
// LOS DOS ORÍGENES VAN EN CLAVES SEPARADAS, y no por orden: solo uno va a cambiar.
//   · `plantilla_*` — lo escribe `workflowSync` desde el YAML. **Es lo que la inversión cambia.**
//   · `runtime_*`   — lo escribe `materializeRuntimeFlowForTaskItem` (modo `routed`), que YA escribe
//     directo en la base y no se toca. Es el GRUPO DE CONTROL: si se mueve durante la inversión, es
//     que hemos tocado algo que no tocaba.
// El discriminante es la columna `task_item_id`: NULL = flujo de plantilla, no-NULL = flujo de
// runtime (`generation/documents.js:246,278` lo escribe siempre con el task_item).
//
// SOBRE EL ENMASCARADO. Se enmascaran los ids ESTRUCTURALES (el `id` de la propia fila y los que la
// cuelgan de otra: `fill_flow_template_id`, `template_id`, `process_definition_template_id`,
// `task_item_id`, `template_artifact_id`, `deliverable_id`), porque su valor depende del orden de
// siembra y de qué secuencias movieron los flows anteriores, no del comportamiento. En su lugar cada
// plantilla de flujo lleva su identidad de NEGOCIO (`process_definition_id`, `deliverable_code`,
// `storage_version`, `lifecycle_state`, `item_mode`), que sí es estable y además se lee.
// Los ids con significado de negocio NO se enmascaran — `assigned_person_id`, `unit_id`,
// `unit_type_id`, `relation_type_id`, `cargo_id`, `position_id`, `required_cargo_id` y los del JSONB
// `signers` (en sus DOS convenciones de nombre; ver `MASK_OPTS`): **esos SON el «quién»**, y el
// «quién» es justo lo que la inversión no puede cambiar.
//
// `anchor_refs` se deja fuera a propósito: es el predecesor muerto de `slot` (siempre `[]`, nadie lo
// consume) y el §0.8 lo borra en el sub-paso 7. Incluirlo movería el golden por una razón que no es
// de comportamiento. `created_at` tampoco entra: es el reloj de siembra.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { query, cleanupDraftArtifactByCode, closeDb } from "../lib/db.mjs";
import { FIXTURE, USERS } from "../config.mjs";

const SUITE = "flow_steps_db";

const DRAFT_PATH = "/admin/sql/template_artifacts/draft";

// El borrador que este flow autora. `code` es determinista: `draft_<slugify(display_name)>`.
const AUTHORED_NAME = "zzzzzz char flujo en base";
const AUTHORED_CODE = "draft_zzzzzz-char-flujo-en-base";

// Ids estructurales fuera, ids de negocio dentro. Ver la cabecera.
const MASK_OPTS = {
  maskIdKeys: true,
  keep: [
    "process_definition_id",
    "assigned_person_id",
    "unit_id",
    "unit_type_id",
    "relation_type_id",
    "cargo_id",
    "position_id",
    "required_cargo_id",
    // Y ahora el JSONB `signers`, que lleva el «quién» DENTRO. Ojo, porque aquí hay una trampa
    // medida, no supuesta: **los dos productores guardan `signers` con convenciones de nombre
    // distintas**. `materializeRuntimeFlowForTaskItem` serializa lo que llegó del formulario y sale
    // en snake_case (`{"type","person_id","cargo_id",…}`, `generation/documents.js:288`);
    // `workflowSync` serializa la salida de `normalizeSignatureSigner` y sale en camelCase
    // (`{"resolverType","assignedPersonId","requiredCargoId",…}`, `workflows.js:265-276`). Con solo
    // las snake_case en esta lista, el primer golden capturado enmascaró a los firmantes autorados
    // —`requiredCargoId: "<normalized>"`— y el golden decía «alguien» donde tiene que decir quién.
    // Van las DOS familias. Si el §0.8 unifica la convención al escribir directo, este golden se
    // mueve, y ESE movimiento es información: sería un cambio de contrato del JSONB.
    "person_id",
    "assignedPersonId",
    "requiredCargoId",
    "unitId",
    "unitTypeId",
    "positionId",
    "relationTypeId",
    "cargoId",
  ],
};

// PDF mínimo pero válido en estructura (mismo que usa `zzz_artifact_draft`).
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

// --- Lectura del oráculo: las filas de flujo, agrupadas por su plantilla ------------------------
//
// El origen se elige por `task_item_id`. `esRuntime=false` trae además la identidad de negocio del
// portador (configuración + entregable + versión), que es lo que sustituye a los ids enmascarados.

const FILL_TEMPLATE_COLUMNS = `
  fft.id,
  fft.process_definition_template_id,
  fft.task_item_id,
  fft.name,
  fft.description,
  fft.is_active,
  pdt.process_definition_id,
  pdt.item_mode,
  d.code AS deliverable_code,
  ta.storage_version,
  ta.lifecycle_state`;

const SIGNATURE_TEMPLATE_COLUMNS = FILL_TEMPLATE_COLUMNS.replaceAll("fft.", "sft.");

// Los pasos: TODO lo que lleva significado. Las columnas son distintas en cada lado y no se
// solapan del todo (entrega tiene `relation_type_id`/`can_reject`; firma tiene
// `code`/`name`/`slot`/`approval_mode`/`required_signers_*`/`signers`).
const FILL_STEP_COLUMNS = `
  id, fill_flow_template_id, step_order, resolver_type, assigned_person_id,
  unit_scope_type, unit_id, unit_type_id, relation_type_id, cargo_id, position_id,
  selection_mode, is_required, can_reject`;

const SIGNATURE_STEP_COLUMNS = `
  id, template_id, step_order, code, name, slot, resolver_type, assigned_person_id,
  unit_scope_type, unit_id, unit_type_id, position_id, required_cargo_id,
  selection_mode, approval_mode, required_signers_min, required_signers_max,
  is_required, signers`;

// LEFT JOIN a propósito: si un vínculo se quedara sin artifact, la fila debe SALIR en el golden
// (con nulos) en vez de desaparecer en silencio.
async function readFillFlows({ runtime, deliverableCode = null }) {
  const templates = await query(
    `SELECT ${FILL_TEMPLATE_COLUMNS}
       FROM fill_flow_templates fft
       LEFT JOIN process_definition_templates pdt ON pdt.id = fft.process_definition_template_id
       LEFT JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
       LEFT JOIN deliverables d ON d.id = ta.deliverable_id
      WHERE fft.task_item_id IS ${runtime ? "NOT NULL" : "NULL"}
        AND ($1::text IS NULL OR d.code = $1::text)
      ORDER BY d.code, ta.storage_version, pdt.process_definition_id, fft.id`,
    [deliverableCode],
  );
  const ids = templates.map((row) => row.id);
  const steps = ids.length
    ? await query(
        `SELECT ${FILL_STEP_COLUMNS}
           FROM fill_flow_steps
          WHERE fill_flow_template_id = ANY($1::int[])
          ORDER BY fill_flow_template_id, step_order`,
        [ids],
      )
    : [];
  return attachSteps(templates, steps, "fill_flow_template_id");
}

async function readSignatureFlows({ runtime, deliverableCode = null }) {
  const templates = await query(
    `SELECT ${SIGNATURE_TEMPLATE_COLUMNS}
       FROM signature_flow_templates sft
       LEFT JOIN process_definition_templates pdt ON pdt.id = sft.process_definition_template_id
       LEFT JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
       LEFT JOIN deliverables d ON d.id = ta.deliverable_id
      WHERE sft.task_item_id IS ${runtime ? "NOT NULL" : "NULL"}
        AND ($1::text IS NULL OR d.code = $1::text)
      ORDER BY d.code, ta.storage_version, pdt.process_definition_id, sft.id`,
    [deliverableCode],
  );
  const ids = templates.map((row) => row.id);
  const steps = ids.length
    ? await query(
        `SELECT ${SIGNATURE_STEP_COLUMNS}
           FROM signature_flow_steps
          WHERE template_id = ANY($1::int[])
          ORDER BY template_id, step_order`,
        [ids],
      )
    : [];
  return attachSteps(templates, steps, "template_id");
}

// Anida los pasos bajo su plantilla y quita la clave de agrupación de cada paso (ya la lleva el
// padre). Así el golden se lee como el flujo, no como un volcado de dos tablas.
function attachSteps(templates, steps, foreignKey) {
  return templates.map((template) => ({
    ...template,
    steps: steps
      .filter((step) => Number(step[foreignKey]) === Number(template.id))
      .map(({ [foreignKey]: _fk, ...rest }) => rest),
  }));
}

// El flujo de runtime cuelga de un `task_item`, cuyo id es autoincremental. Se sustituye por su
// identidad legible para que el golden diga de QUÉ entregable es el flujo.
async function readRuntimeAnchors() {
  return query(
    `SELECT ti.id AS task_item_id, ti.title, ti.origin_kind
       FROM task_items ti
      WHERE EXISTS (SELECT 1 FROM fill_flow_templates f WHERE f.task_item_id = ti.id)
         OR EXISTS (SELECT 1 FROM signature_flow_templates s WHERE s.task_item_id = ti.id)
      ORDER BY ti.id`,
  );
}

before(async () => {
  await waitForReady();
  // Idempotencia: si una corrida anterior murió a medias, los restos se limpian antes de empezar.
  await cleanupDraftArtifactByCode(AUTHORED_CODE);
});

after(async () => {
  await cleanupDraftArtifactByCode(AUTHORED_CODE);
  await closeDb();
});

// --- 1) Origen PLANTILLA: lo que `workflowSync` proyectó desde el `meta.yaml` --------------------
//
// Estas dos claves se capturan ANTES de autorar nada, así que retratan lo que dejan el bootstrap y
// los flows anteriores. Es el estado que el sub-paso 3 tiene que reproducir sin moverse, y el que el
// sub-paso 6 (borrar `BASE_META_YAML`) vaciará a propósito.

test("origen PLANTILLA · flujos de ENTREGA en la base", async () => {
  const flows = await readFillFlows({ runtime: false });
  assert.ok(flows.length, "la fixture debe traer al menos un flujo de entrega de plantilla");
  matchSnapshot(SUITE, "plantilla_entrega", normalize(flows, MASK_OPTS));
});

test("origen PLANTILLA · flujos de FIRMA en la base", async () => {
  // Hoy sale VACÍO, y eso es el hallazgo, no un fallo: `BASE_META_YAML` declara
  // `signatures: steps: []` (`SystemBootstrapService.js:302-304`), así que el sync desactiva/no crea
  // nada del lado de la firma. Congelarlo es lo que hace visible el día en que deje de estarlo.
  const flows = await readSignatureFlows({ runtime: false });
  matchSnapshot(SUITE, "plantilla_firma", normalize(flows, MASK_OPTS));
});

// --- 2) Origen RUNTIME: el GRUPO DE CONTROL ------------------------------------------------------
//
// `materializeRuntimeFlowForTaskItem` ya escribe directo en la base. La inversión NO debe tocarlo:
// si estas dos claves se mueven, es que el cambio se salió de su sitio.

test("origen RUNTIME · el entregable que ancla los flujos materializados al enviar", async () => {
  const anchors = await readRuntimeAnchors();
  assert.ok(anchors.length, "el setup debe dejar una tarea ad-hoc routed con su flujo materializado");
  matchSnapshot(SUITE, "runtime_anclas", normalize(anchors, MASK_OPTS));
});

test("origen RUNTIME · flujos de ENTREGA en la base (control)", async () => {
  const flows = await readFillFlows({ runtime: true });
  assert.ok(flows.length, "el setup routed debe materializar un flujo de entrega de runtime");
  matchSnapshot(SUITE, "runtime_entrega", normalize(flows, MASK_OPTS));
});

test("origen RUNTIME · flujos de FIRMA en la base (control)", async () => {
  const flows = await readSignatureFlows({ runtime: true });
  assert.ok(flows.length, "el setup routed debe materializar un flujo de firma de runtime");
  matchSnapshot(SUITE, "runtime_firma", normalize(flows, MASK_OPTS));
});

// --- 3) AUTORÍA COMPLETA: el camino que la inversión reescribe entero ----------------------------
//
// Lo anterior retrata un flujo de entrega de UN paso y ningún flujo de firma: no basta para
// caracterizar la proyección. Aquí se autora un borrador con los DOS lados y con las columnas que
// hoy nadie ejercita — `cargo_id`/`required_cargo_id` con su unidad, `can_reject` derivado del
// orden, `approval_mode`/`required_signers_min` y el JSONB `signers` multi-firmante.
//
// Es exactamente el camino del sub-paso 3: formulario web -> meta.yaml -> MinIO -> workflowSync ->
// filas. Después de la inversión será formulario web -> filas, en una transacción. **Las filas
// tienen que salir iguales**, y esta clave es la que lo dice.

const autorado = { artifactId: null, cargoId: null };

test("autoría · se resuelve el cargo DOCENTE de la fixture (el «quién» del paso por cargo)", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/cargos", { token });
  assert.equal(res.status, 200, `list cargos debe responder 200: ${JSON.stringify(res.body)}`);
  const rows = Array.isArray(res.body) ? res.body : (res.body?.data ?? res.body?.rows ?? []);
  const docente = rows.find((row) => String(row.code) === FIXTURE.unitPositionCargoCode);
  assert.ok(docente, `la fixture debe traer el cargo ${FIXTURE.unitPositionCargoCode}`);
  autorado.cargoId = Number(docente.id);
});

test("autoría · POST draft con flujo de ENTREGA y de FIRMA -> 200", async () => {
  const token = await tokenFor("admin");
  assert.ok(autorado.cargoId, "depende del paso anterior");

  // Entrega: paso 1 responsable del entregable, paso 2 por cargo en una unidad fija. El segundo
  // paso existe para fijar `can_reject`, que NO se lee del formulario: lo DERIVA el orden
  // (`workflows.js:170-172`). Un solo paso nunca lo demostraría.
  const fillWorkflow = JSON.stringify({
    required: true,
    steps: [
      { order: 1, name: "Entrega del responsable", resolver_type: "task_assignee", selection_mode: "auto_one" },
      {
        order: 2,
        name: "Revision por cargo",
        resolver_type: "cargo_in_scope",
        cargo_id: autorado.cargoId,
        unit_scope_type: "unit_exact",
        unit_id: FIXTURE.unitId,
        selection_mode: "auto_one",
      },
    ],
  });

  // Firma: paso 1 de un firmante por cargo; paso 2 con DOS firmantes y `at_least`, que es lo único
  // que ejercita `approval_mode`, `required_signers_min` y el JSONB `signers` con más de un elemento.
  // `required: true` no es decorativo: `isArtifactSignatureWorkflowSyncEnabled` (`artifacts.js:108`)
  // exige que lo esté o el sync no materializa NADA del lado de la firma.
  const porCargo = {
    resolver_type: "cargo_in_scope",
    cargo_id: autorado.cargoId,
    unit_scope_type: "unit_exact",
    unit_id: FIXTURE.unitId,
    selection_mode: "auto_all",
  };
  const signatureWorkflow = JSON.stringify({
    required: true,
    steps: [
      { order: 1, code: "firma_cargo", name: "Firma por cargo", signers: [porCargo] },
      {
        order: 2,
        code: "firma_conjunta",
        name: "Firma conjunta",
        approval_mode: "at_least",
        required_signers_min: 1,
        signers: [porCargo, { ...porCargo, selection_mode: "auto_one" }],
      },
    ],
  });

  const res = await post(DRAFT_PATH, {
    token,
    form: {
      display_name: AUTHORED_NAME,
      owner_cedula: USERS.admin.identifier,
      process_definition_id: String(FIXTURE.definitionId),
      fill_workflow: fillWorkflow,
      signature_workflow: signatureWorkflow,
      pdf_file: REFERENCE_PDF,
    },
  });

  assert.equal(res.status, 200, `autorar el borrador debe responder 200: ${JSON.stringify(res.body)}`);
  // Si el sync falla, las filas no se escriben y el golden siguiente sería un vacío MENTIROSO: el
  // endpoint devuelve 200 igual y solo lo delata esta bandera (`templateLifecycle.js:1704`).
  assert.equal(res.body?.workflow_sync_failed, false, `el sync no debe fallar: ${JSON.stringify(res.body)}`);
  autorado.artifactId = res.body?.id;
  assert.ok(autorado.artifactId, "debe devolverse el id del artifact creado");
});

test("autoría · flujo de ENTREGA autorado, tal como quedó en la base", async () => {
  assert.ok(autorado.artifactId, "depende del paso anterior");
  const flows = await readFillFlows({ runtime: false, deliverableCode: AUTHORED_CODE });
  assert.equal(flows.length, 1, "la autoría debe dejar exactamente UNA plantilla de flujo de entrega");
  assert.equal(flows[0].steps.length, 2, "los dos pasos autorados deben materializarse");
  matchSnapshot(SUITE, "autorado_entrega", normalize(flows, MASK_OPTS));
});

test("autoría · flujo de FIRMA autorado, tal como quedó en la base", async () => {
  assert.ok(autorado.artifactId, "depende del paso anterior");
  const flows = await readSignatureFlows({ runtime: false, deliverableCode: AUTHORED_CODE });
  assert.equal(flows.length, 1, "la autoría debe dejar exactamente UNA plantilla de flujo de firma");
  assert.equal(flows[0].steps.length, 2, "los dos pasos de firma autorados deben materializarse");
  matchSnapshot(SUITE, "autorado_firma", normalize(flows, MASK_OPTS));
});
