// Characterization: EL IDA Y VUELTA DEL EDITOR — autorar un flujo y volver a leerlo.
//
// Por qué existe (sub-paso 5 de `docs/planes/plan-maestro-2026-08.md` §0.8). El endpoint
// `GET /admin/sql/template_artifacts/:id/schema` es lo único que rellena el editor cuando se reabre
// una plantilla (`useAdminDraftArtifactFlow.js:119`, y `:143` para «crear a partir de»). Reconstruía
// `fill_workflow`/`signature_workflow` desde el `meta.yaml` de MinIO; desde este sub-paso los
// reconstruye desde las filas de la base. **El contrato de salida no cambia**: el frontend está
// fuera del alcance de esta tanda.
//
// LO QUE MIDIÓ EL EXPERIMENTO DESECHABLE, y es la razón de que este flow exista: con el lector
// devolviendo flujos VACÍOS a propósito, la caracterización entera pasó 254/254. El único caso que
// tocaba este endpoint (`admin_crud :: template_artifact_schema`) fija las CLAVES de primer nivel y
// nada del contenido. O sea: la red no veía nada de lo que este sub-paso cambia, y el fallo que
// habría dejado pasar no es cosmético — un flujo que se lee vacío es un flujo que el siguiente
// guardado BORRA.
//
// LA ASERCIÓN FUERTE NO ES EL SNAPSHOT, ES LA EQUIVALENCIA. El test autora un flujo por HTTP y
// compara lo que devuelve el endpoint con lo que se autoró, campo a campo. Un golden congela lo que
// hay; esto exige que sea lo MISMO que se pidió, que es la propiedad que el editor necesita.
//
// ⚠️ PREFIJO DE SIETE ZETAS, uno más que `zzzzzz_flow_steps_db`. Los flows corren en orden
// alfabético con --test-concurrency=1 y este ESCRIBE (autora un borrador, con sus filas de flujo y
// sus secuencias): tiene que ir el último para no mover las huellas `list_*` de `admin_crud` ni los
// ids de los flows que escriben, y en particular para no meterse dentro de la foto global que
// `zzzzzz_flow_steps_db` toma de TODOS los flujos de plantilla. Se limpia solo en el `after`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { cleanupDraftArtifactByCode, closeDb } from "../lib/db.mjs";
import { FIXTURE, USERS } from "../config.mjs";

const SUITE = "schema_flow_reread";
const DRAFT_PATH = "/admin/sql/template_artifacts/draft";

const AUTHORED_NAME = "zzzzzzz char relectura de flujo";
const AUTHORED_CODE = "draft_zzzzzzz-char-relectura-de-flujo";

// PDF mínimo pero válido en estructura (el mismo que usan los otros dos flows que autoran).
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

const estado = { artifactId: null, cargoId: null, fill: null, signature: null };

before(async () => {
  await waitForReady();
  await cleanupDraftArtifactByCode(AUTHORED_CODE);
});

after(async () => {
  await cleanupDraftArtifactByCode(AUTHORED_CODE);
  await closeDb();
});

test("relectura · se resuelve el cargo DOCENTE de la fixture", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/cargos", { token });
  assert.equal(res.status, 200, `list cargos debe responder 200: ${JSON.stringify(res.body)}`);
  const rows = Array.isArray(res.body) ? res.body : (res.body?.data ?? res.body?.rows ?? []);
  const docente = rows.find((row) => String(row.code) === FIXTURE.unitPositionCargoCode);
  assert.ok(docente, `la fixture debe traer el cargo ${FIXTURE.unitPositionCargoCode}`);
  estado.cargoId = Number(docente.id);
});

test("relectura · POST draft con los dos flujos -> 200", async () => {
  const token = await tokenFor("admin");
  assert.ok(estado.cargoId, "depende del paso anterior");

  // Los tres pasos de entrega cubren lo que el mapeo puede equivocar: un resolutor SIN ámbito
  // (`task_assignee`, cuyo `unit_scope_type` la base guarda con el valor por defecto del
  // normalizador y el contrato NO debe mostrar), uno por cargo con unidad fija, y uno por cargo en
  // contexto y NO obligatorio.
  estado.fill = {
    required: true,
    steps: [
      { order: 1, name: "Entrega del responsable", resolver_type: "task_assignee", selection_mode: "auto_one" },
      {
        order: 2,
        name: "Revision por cargo",
        resolver_type: "cargo_in_scope",
        cargo_id: estado.cargoId,
        unit_scope_type: "unit_exact",
        unit_id: FIXTURE.unitId,
        selection_mode: "auto_one",
      },
      {
        order: 3,
        name: "Visto por cargo en contexto",
        resolver_type: "cargo_in_scope",
        cargo_id: estado.cargoId,
        unit_scope_type: "context_exact",
        selection_mode: "auto_all",
        required: false,
      },
    ],
  };

  // Firma: un paso de un firmante y otro con DOS y `at_least`, que es lo único que ejercita el
  // JSONB `signers` con más de un elemento y sus dos ámbitos distintos.
  const porCargo = {
    resolver_type: "cargo_in_scope",
    cargo_id: estado.cargoId,
    unit_scope_type: "unit_exact",
    unit_id: FIXTURE.unitId,
    selection_mode: "auto_all",
  };
  estado.signature = {
    required: true,
    steps: [
      { order: 1, code: "firma_cargo", name: "Firma por cargo", signers: [porCargo] },
      {
        order: 2,
        code: "firma_conjunta",
        name: "Firma conjunta",
        approval_mode: "at_least",
        required_signers_min: 1,
        required: false,
        signers: [porCargo, { ...porCargo, unit_scope_type: "context_exact", unit_id: null, selection_mode: "auto_one" }],
      },
    ],
  };

  const res = await post(DRAFT_PATH, {
    token,
    form: {
      display_name: AUTHORED_NAME,
      owner_cedula: USERS.admin.identifier,
      process_definition_id: String(FIXTURE.definitionId),
      fill_workflow: JSON.stringify(estado.fill),
      signature_workflow: JSON.stringify(estado.signature),
      pdf_file: REFERENCE_PDF,
    },
  });

  assert.equal(res.status, 200, `autorar el borrador debe responder 200: ${JSON.stringify(res.body)}`);
  estado.artifactId = res.body?.id;
  assert.ok(estado.artifactId, "debe devolverse el id del artifact creado");
});

// El editor recibe el paso APLANADO (sin `resolver:` anidado), así que la comparación se hace contra
// la misma forma: lo autorado, más los valores por defecto que el contrato rellena. Que los defectos
// estén AQUÍ escritos y no calculados es a propósito — si el endpoint deja de ponerlos, este test lo
// dice; si se calcularan con la misma regla, no diría nada.
const pasoEsperado = (step, { defaults = {} } = {}) => ({
  order: step.order,
  code: step.code || "",
  name: step.name,
  resolver_type: step.resolver_type,
  selection_mode: step.selection_mode,
  cargo_id: step.cargo_id ?? null,
  cargo_code: "",
  // Un resolutor que no es por cargo no tiene ámbito: el contrato devuelve el neutro.
  unit_scope_type: step.resolver_type === "cargo_in_scope" ? step.unit_scope_type : "context_exact",
  unit_id: step.resolver_type === "cargo_in_scope" ? (step.unit_id ?? null) : null,
  unit_type_id: null,
  person_id: null,
  position_id: null,
  ...defaults,
});

test("relectura · el flujo de ENTREGA vuelve equivalente a lo autorado", async () => {
  const token = await tokenFor("admin");
  assert.ok(estado.artifactId, "depende del paso anterior");
  const res = await get(`/admin/sql/template_artifacts/${estado.artifactId}/schema`, { token });
  assert.equal(res.status, 200, `schema debe responder 200: ${JSON.stringify(res.body)}`);

  const esperado = {
    required: true,
    steps: estado.fill.steps.map((step) => ({
      ...pasoEsperado(step),
      field_refs: [],
      required: step.required !== false,
    })),
  };
  assert.deepEqual(res.body?.fill_workflow, esperado, "el flujo de entrega releído debe ser el autorado");
});

test("relectura · el flujo de FIRMA vuelve equivalente a lo autorado", async () => {
  const token = await tokenFor("admin");
  assert.ok(estado.artifactId, "depende del paso anterior");
  const res = await get(`/admin/sql/template_artifacts/${estado.artifactId}/schema`, { token });
  assert.equal(res.status, 200, `schema debe responder 200: ${JSON.stringify(res.body)}`);

  const esperado = {
    required: true,
    steps: estado.signature.steps.map((step) => ({
      order: step.order,
      code: step.code,
      name: step.name,
      approval_mode: step.approval_mode || "and",
      required_signers_min: step.required_signers_min || 1,
      required: step.required !== false,
      // El firmante vuelve con las MISMAS claves que el formulario envía. Es la trampa del JSONB
      // `signers`, que en la base vive en camelCase cuando lo escribe la autoría de plantilla y en
      // snake_case cuando lo escribe el flujo de runtime: si el lector devolviera la fila cruda, el
      // editor recibiría `requiredCargoId` donde espera `cargo_id` y perdería a todos los firmantes.
      signers: step.signers.map((signer) => pasoEsperado(signer, { defaults: {} })).map(
        ({ order: _order, code: _code, name: _name, ...resto }) => resto,
      ),
    })),
  };
  assert.deepEqual(res.body?.signature_workflow, esperado, "el flujo de firma releído debe ser el autorado");
});

// Y además se congela la respuesta entera (sin `fields`, que es el schema.json de MinIO y no es
// asunto de este sub-paso): el día que alguien añada o quite una clave del contrato del editor, el
// diff del golden lo dice aunque la equivalencia de arriba siga cumpliéndose.
test("relectura · huella del contrato que consume el editor", async () => {
  const token = await tokenFor("admin");
  assert.ok(estado.artifactId, "depende del paso anterior");
  const res = await get(`/admin/sql/template_artifacts/${estado.artifactId}/schema`, { token });
  assert.equal(res.status, 200, `schema debe responder 200: ${JSON.stringify(res.body)}`);
  const { fields: _fields, artifact_id: _artifactId, ...contrato } = res.body ?? {};
  matchSnapshot(SUITE, "schema_flujo_autorado", contrato);
});

// El tercer escalón, que NO estaba en el plan y salió de verificar esto en el navegador:
// `createTemplateArtifactVersion` copia MinIO en binario y no crea filas de flujo ni vínculo. Antes
// del sub-paso 5 la versión nueva enseñaba el flujo porque lo llevaba el `meta.yaml` copiado byte a
// byte; leyendo la base no tiene NADA propio, así que lo hereda de su padre. Sin eso, versionar una
// plantilla y reabrirla mostraba el flujo vacío y el primer guardado lo borraba.
//
// Ojo con lo que este caso NO arregla: publicar esa versión sigue fallando con «debe definir al menos
// un paso de flujo de entrega», porque el gate (sub-paso 4) cuenta FILAS y la versión no las tiene.
// Eso es exactamente lo que cierra el sub-paso 6, y no se toca aquí.
test("relectura · una VERSION recien creada hereda el flujo de su padre", async () => {
  const token = await tokenFor("admin");
  assert.ok(estado.artifactId, "depende del paso anterior");

  const original = await get(`/admin/sql/template_artifacts/${estado.artifactId}/schema`, { token });
  const version = await post(`/admin/sql/template_artifacts/${estado.artifactId}/version`, {
    token,
    body: { bump_level: "minor" },
  });
  assert.equal(version.status, 200, `versionar debe responder 200: ${JSON.stringify(version.body)}`);
  const hijaId = version.body?.id;
  assert.ok(hijaId, "debe devolverse el id de la version nueva");

  const hija = await get(`/admin/sql/template_artifacts/${hijaId}/schema`, { token });
  assert.equal(hija.status, 200, `schema de la version debe responder 200: ${JSON.stringify(hija.body)}`);
  assert.deepEqual(hija.body?.fill_workflow, original.body?.fill_workflow, "la version hereda la entrega");
  assert.deepEqual(hija.body?.signature_workflow, original.body?.signature_workflow, "la version hereda la firma");
});

// La otra mitad del sub-paso, y la que sostiene el andamiaje: una plantilla que NUNCA pasó por el
// formulario nuevo —la de la fixture, cuyo flujo lo sembró el sync desde `BASE_META_YAML`— tiene sus
// filas colgadas del VÍNCULO y ninguna colgada del artifact. Se sigue leyendo, por el segundo
// escalón del lector. Cuando los sub-pasos 6, 7 y 8 dejen ese escalón sin productores, este caso
// cambia de valor y ESE diff es su prueba.
test("relectura · una plantilla sembrada por el sync se lee por el portador del vínculo", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/sql/template_artifacts/1/schema", { token });
  assert.equal(res.status, 200, `schema debe responder 200: ${JSON.stringify(res.body)}`);
  assert.equal(res.body?.fill_workflow?.steps?.length, 1, "la plantilla de la fixture define un paso de entrega");
  const { fields: _fields, ...contrato } = res.body ?? {};
  matchSnapshot(SUITE, "schema_fixture_sembrada_por_sync", contrato);
});
