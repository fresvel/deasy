// Characterization: LOS CAMPOS DEL FORMULARIO, EN LA BASE (§0.4 del plan maestro, sub-paso S6).
//
// POR QUÉ EL ORÁCULO ES LA BASE Y NO UNA RESPUESTA HTTP. Es la misma excepción, con el mismo límite,
// que `zzzzzz_flow_steps_db` y `zz_default_process_routed` (ver la cabecera de `lib/db.mjs`): lo que
// este sub-paso cambia es DÓNDE viven los campos, y **no existe ninguna ruta que lo observe**.
// `GET /template_artifacts/:id/schema` parece servir y no sirve — sigue leyendo el `schema.json` de
// MinIO, porque S6 es escritura doble y los lectores se mudan después—, así que respondería
// exactamente igual con la tabla vacía. Y el `content_hash` que sí se fija por HTTP es el del
// paquete de MinIO, que por construcción NO se mueve en este sub-paso: ese es justo su contrato.
//
// ⚠️ Y NO ES UNA PRECAUCIÓN TEÓRICA: está MEDIDO. Antes de escribir una línea se anuló el escritor
// de campos entero —`schema.json` a `{}` pasara lo que pasara— y `test:char:run` dio **281/281 en
// verde**. Ningún flow manda `schema_fields` en su multipart y el único caso que llega al endpoint
// (`admin_crud :: template_artifact_schema`) fija solo `topLevelKeys`. Este fichero es lo que cierra
// ese hueco.
//
// ⚠️ PREFIJO DE OCHO ZETAS, uno más que `zzzzzzz_schema_flow_reread`. Los flows corren en orden
// alfabético con --test-concurrency=1 y este ESCRIBE (autora un borrador y lo versiona): va el
// último para no mover las huellas `list_*` de `admin_crud` ni los ids de los flows que escriben. Se
// limpia solo en el `after` (el `ON DELETE CASCADE` de la FK se lleva los campos con el artifact).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { cleanupDraftArtifactByCode, closeDb, query } from "../lib/db.mjs";
import { FIXTURE, USERS } from "../config.mjs";

const SUITE = "schema_fields_db";
const DRAFT_PATH = "/admin/sql/template_artifacts/draft";

const AUTHORED_NAME = "zzzzzzzz char campos db";
const AUTHORED_CODE = "draft_zzzzzzzz-char-campos-db";
const BASE_TEMPLATE_CODE = "tpl_informe_general";

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

// Un paso de entrega basta: sin él, una plantilla no-`routed` no se puede crear.
const FILL_WORKFLOW = {
  required: true,
  steps: [{ order: 1, name: "Entrega del responsable", resolver_type: "task_assignee", selection_mode: "auto_one" }],
};

// LOS CAMPOS QUE SE AUTORAN, elegidos para cubrir lo que el escritor puede equivocar:
//   · una clave que es UN ENTERO CANÓNICO (`2025`) en medio de la lista — el caso que justifica la
//     columna `field_order`, porque en el objeto `properties` JS la coloca la primera;
//   · los tres tipos de `type` derivado (string / boolean / number);
//   · un componente inventado, que el formulario degrada a `text`;
//   · un `field_code` explícito de token de firma, que es el que el generador (S8) tendrá que unir
//     con `signature_flow_steps.slot`;
//   · un slug REPETIDO, que se descarta en silencio como siempre.
const CAMPOS = [
  { key: "semestre", title: "Semestre", component: "text", group: "general", required: true },
  { key: "2025", title: "Periodo 2025", component: "text", group: "general" },
  { key: "show_firmas", title: "Mostrar firmas", component: "switch", group: "display" },
  { key: "cuantos", title: "Cuantos", component: "number", group: "general", required: true },
  { key: "firmaElaboradoToken", title: "Token elaborado", field_code: "signatures.elaborado.token", component: "hidden", group: "signatures" },
  { key: "inventado", title: "Inventado", component: "no_existe", group: "general" },
  { key: "Semestre", title: "Semestre repetido", component: "text", group: "general" },
];

const COLUMNAS = "field_order, data_key, field_code, title, ui_component, ui_group, is_required";

const camposDe = (artifactId) => query(
  `SELECT ${COLUMNAS} FROM template_artifact_fields
    WHERE template_artifact_id = $1 ORDER BY field_order`,
  [artifactId],
);

const estado = { artifactId: null, hijaId: null, baseArtifactId: null };

before(async () => {
  await waitForReady();
  await cleanupDraftArtifactByCode(AUTHORED_CODE);
});

after(async () => {
  await cleanupDraftArtifactByCode(AUTHORED_CODE);
  await closeDb();
});

// --- La plantilla del bootstrap: el caso que NO pasa por el formulario ---------------------------
//
// `publishBaseSeedAssets` publica `seeds/informe-general/schema.json` tal cual en MinIO y el
// `INSERT INTO template_artifacts` del bootstrap guarda solo el PUNTERO. **Es la misma forma del
// `BASE_META_YAML` que costó el frente 0 entero**: contenido del modelo que entra por un literal de
// fichero y se auto-replica al versionar por copia binaria. Sin el sembrado del sub-paso S6, la
// única plantilla que existe recién instalado el sistema tendría 18 campos en MinIO y CERO filas — y
// el esqueleto que este sub-paso deja para el generador estaría vacío justo donde importa.
test("campos db · la plantilla base del bootstrap trae sus campos como FILAS, no solo como fichero", async () => {
  const [artifact] = await query(
    `SELECT ta.id FROM template_artifacts ta
       INNER JOIN deliverables d ON d.id = ta.deliverable_id
      WHERE d.code = $1 ORDER BY ta.id LIMIT 1`,
    [BASE_TEMPLATE_CODE],
  );
  assert.ok(artifact, `la fixture debe traer la plantilla base ${BASE_TEMPLATE_CODE}`);
  estado.baseArtifactId = Number(artifact.id);

  const filas = await camposDe(estado.baseArtifactId);
  assert.ok(filas.length > 0, "la plantilla base no puede tener sus campos SOLO en MinIO");
  matchSnapshot(SUITE, "campos_de_la_plantilla_base", filas.map((f) => ({ ...f, field_order: Number(f.field_order) })));
});

// HALLAZGO, y por eso este caso se acota a UNA edición: el entregable base tiene DOS en dev —el seed
// rico versiona la 1.0.0 a una 1.1.0 (§0.5 del plan lo describe)— y las DOS traen ahora sus campos
// como filas. La segunda NO la siembra el bootstrap: la copia `copySchemaFieldsToArtifact` desde el
// versionado. O sea que el camino de copia se ejercita solo, de extremo a extremo, en cada arranque
// de la fixture. Preguntar por el `code` del entregable devolvía los tokens por duplicado.
test("campos db · los tres tokens de firma del seed llegan como field_code consultable", async () => {
  // Es el JOIN que el generador (S8) necesita y que un objeto en MinIO no permite. Aquí solo se
  // comprueba que el dato ESTÁ y es consultable; unirlo con `signature_flow_steps.slot` es el S8.
  assert.ok(estado.baseArtifactId, "depende del paso anterior");
  const filas = await query(
    `SELECT field_code, ui_component FROM template_artifact_fields
      WHERE template_artifact_id = $1 AND field_code LIKE 'signatures.%.token'
      ORDER BY field_order`,
    [estado.baseArtifactId],
  );
  assert.deepEqual(filas.map((f) => f.field_code), [
    "signatures.elaborado.token",
    "signatures.revisado.token",
    "signatures.aprobado.token",
  ]);
  assert.deepEqual([...new Set(filas.map((f) => f.ui_component))], ["hidden"]);
});

test("campos db · la SEGUNDA edicion del entregable base tambien los trae, y por la via de la copia", async () => {
  // Ninguna de las dos pasó jamás por el formulario web: la 1.0.0 la siembra el bootstrap desde el
  // fichero del seed, y la 1.1.0 la crea el seed rico versionando. Que las dos tengan los mismos
  // campos es lo que dice que `copySchemaFieldsToArtifact` cierra el problema 1 —la copia binaria de
  // MinIO— en el camino real, no solo en el unitario.
  const ediciones = await query(
    `SELECT ta.id FROM template_artifacts ta
       INNER JOIN deliverables d ON d.id = ta.deliverable_id
      WHERE d.code = $1 ORDER BY ta.id`,
    [BASE_TEMPLATE_CODE],
  );
  assert.ok(ediciones.length >= 2, "la fixture debe traer al menos dos ediciones del entregable base");

  const porEdicion = [];
  for (const edicion of ediciones) {
    const filas = await camposDe(edicion.id);
    porEdicion.push(filas.map((f) => f.data_key));
  }
  for (const claves of porEdicion) {
    assert.deepEqual(claves, porEdicion[0], "cada edición hereda los campos que mostraba su padre");
    assert.ok(claves.length > 0, "y ninguna nace con la tabla vacía");
  }
});

// --- La autoría desde el formulario --------------------------------------------------------------

test("campos db · POST draft con schema_fields -> 200", async () => {
  const token = await tokenFor("admin");
  const res = await post(DRAFT_PATH, {
    token,
    form: {
      display_name: AUTHORED_NAME,
      owner_cedula: USERS.admin.identifier,
      process_definition_id: String(FIXTURE.definitionId),
      fill_workflow: JSON.stringify(FILL_WORKFLOW),
      schema_fields: JSON.stringify(CAMPOS),
      pdf_file: REFERENCE_PDF,
    },
  });

  assert.equal(res.status, 200, `autorar el borrador debe responder 200: ${JSON.stringify(res.body)}`);
  estado.artifactId = res.body?.id;
  assert.ok(estado.artifactId, "debe devolverse el id del artifact creado");
});

test("campos db · las filas guardan el ORDEN AUTORADO, no el de las claves del objeto", async () => {
  assert.ok(estado.artifactId, "depende del paso anterior");
  const filas = await camposDe(estado.artifactId);

  // `2025` va SEGUNDO, que es donde lo puso el autor. En `schema.json` va el PRIMERO, porque JS
  // itera antes las claves de índice de array — medido con un experimento desechable. Esa
  // diferencia es exactamente lo que la columna `field_order` viene a arreglar, y por eso este
  // `deepEqual` es la aserción central del sub-paso.
  assert.deepEqual(filas.map((f) => [Number(f.field_order), f.data_key]), [
    [1, "semestre"],
    [2, "2025"],
    [3, "show_firmas"],
    [4, "cuantos"],
    [5, "firmaelaboradotoken"],
    [6, "inventado"],
  ]);
});

test("campos db · el slug repetido se descarta, como en el fichero", async () => {
  assert.ok(estado.artifactId, "depende del paso anterior");
  const filas = await camposDe(estado.artifactId);
  assert.equal(filas.filter((f) => f.data_key === "semestre").length, 1);
  assert.equal(filas.find((f) => f.data_key === "semestre").title, "Semestre");
});

test("campos db · huella de las filas autoradas", async () => {
  assert.ok(estado.artifactId, "depende del paso anterior");
  const filas = await camposDe(estado.artifactId);
  matchSnapshot(SUITE, "campos_autorados", filas.map((f) => ({ ...f, field_order: Number(f.field_order) })));
});

test("campos db · el editor sigue leyendo los MISMOS campos (nada observable cambia)", async () => {
  // La otra mitad del contrato de la escritura doble: el lector no se ha movido, así que el editor
  // recibe lo de siempre. Aquí se ve la asimetría a propósito: el fichero coloca `2025` el primero.
  const token = await tokenFor("admin");
  assert.ok(estado.artifactId, "depende del paso anterior");
  const res = await get(`/admin/sql/template_artifacts/${estado.artifactId}/schema`, { token });
  assert.equal(res.status, 200, `schema debe responder 200: ${JSON.stringify(res.body)}`);
  assert.deepEqual(res.body?.fields?.map((f) => f.key), [
    "2025", "semestre", "show_firmas", "cuantos", "firmaelaboradotoken", "inventado",
  ]);
  matchSnapshot(SUITE, "campos_que_lee_el_editor", res.body?.fields);
});

// --- El versionado: filas, no bytes --------------------------------------------------------------

test("campos db · versionar COPIA LAS FILAS de campos a la hija", async () => {
  // El problema 1 de los tres que este sub-paso cierra: `createTemplateArtifactVersion` clona el
  // prefijo de MinIO con `copyMinioObjectBinary`, o sea el MISMO tubo por el que viajaba el
  // `document_owner` que costó el frente 0. Con filas, lo que hereda la hija es contable.
  const token = await tokenFor("admin");
  assert.ok(estado.artifactId, "depende del paso anterior");

  const version = await post(`/admin/sql/template_artifacts/${estado.artifactId}/version`, {
    token,
    body: { bump_level: "minor" },
  });
  assert.equal(version.status, 200, `versionar debe responder 200: ${JSON.stringify(version.body)}`);
  estado.hijaId = version.body?.id;
  assert.ok(estado.hijaId, "debe devolverse el id de la version nueva");

  const padre = await camposDe(estado.artifactId);
  const hija = await camposDe(estado.hijaId);
  assert.deepEqual(hija, padre, "la hija nace con los mismos campos que el editor mostraba del padre");
  assert.ok(hija.length > 0, "y no con la tabla vacía, que es lo que pasaba antes de este sub-paso");
});

test("campos db · el padre conserva los suyos: copiar no mueve el origen", async () => {
  assert.ok(estado.hijaId, "depende del paso anterior");
  const padre = await camposDe(estado.artifactId);
  assert.equal(padre.length, 6);
});
