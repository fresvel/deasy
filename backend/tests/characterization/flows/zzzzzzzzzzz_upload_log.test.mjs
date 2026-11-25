// Contrato de LA BITÁCORA DE SUBIDAS — quién elaboró un documento (decisión del dueño, 2026-08-23).
//
// ── Qué pasaba antes ──────────────────────────────────────────────────────────────────────
// Nada constaba. `working_file_path` guarda el archivo VIGENTE y se sobrescribe en cada subida, así
// que quién elaboró un documento no estaba en ninguna parte. Y había una incoherencia que lo
// delataba: `document_attachments` —el material de APOYO— sí guarda `uploaded_by_person_id`. De un
// anexo sabías quién lo subió; del entregable, no.
//
// ⚠️ MATIZ QUE ES FÁCIL CONFUNDIR: en MinIO nunca se perdió un fichero. El nombre del objeto lleva
// sello de tiempo y UUID, así que cada subida escribe un objeto NUEVO. Lo que se perdía era el
// PUNTERO — los objetos anteriores quedaban huérfanos, no borrados.
//
// ── Qué fija ──────────────────────────────────────────────────────────────────────────────
//  1. Subir deja fila en la bitácora, con quién y con su número de corrección.
//  2. La segunda subida es la corrección 2, y la primera SIGUE AHÍ.
//  3. La etiqueta de versión sube de 1.0 a 1.1 y a 1.2 — el segundo dígito es la corrección.
//  4. La ruta del objeto lleva la carpeta de la corrección: el bucket se explica solo.
//
// Va el último del orden alfabético: sube ficheros de verdad y mueve el estado del entregable.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { query } from "../lib/db.mjs";
import { FIXTURE } from "../config.mjs";

// Un PDF mínimo pero válido: `pdf-parse` y el guard de firma miran la cabecera.
const pdfMinimo = () =>
  new Blob([Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")], {
    type: "application/pdf",
  });

const subir = async (token, taskItemId, nombre) => {
  const form = new FormData();
  form.append("file", pdfMinimo(), nombre);
  return post(
    `/users/${FIXTURE.usuarioPersonId}/process-definitions/${FIXTURE.definitionId}/task-items/${taskItemId}/upload-file`,
    { token, form },
  );
};

before(async () => {
  await waitForReady();
});

test("cada subida deja fila en la bitácora, con su autor y su número de corrección", async () => {
  const token = await tokenFor("usuario");

  // El entregable del usuario de la fixture, con su versión vigente.
  const [version] = await query(
    `SELECT dv.id, dv.task_item_id, dv.version, dv.version_minor
       FROM document_versions dv
       JOIN task_items ti ON ti.id = dv.task_item_id
      WHERE ti.assigned_person_id = $1
      ORDER BY dv.version DESC, dv.id DESC
      LIMIT 1`,
    [FIXTURE.usuarioPersonId],
  );
  assert.ok(version, "la fixture debe dejar una versión del usuario");

  const primera = await subir(token, version.task_item_id, "informe.pdf");
  assert.equal(primera.status, 200, `la primera subida debe ir bien: ${JSON.stringify(primera.body)}`);

  const segunda = await subir(token, version.task_item_id, "informe-corregido.pdf");
  assert.equal(segunda.status, 200, `la segunda subida debe ir bien: ${JSON.stringify(segunda.body)}`);

  const subidas = await query(
    `SELECT minor, file_name, file_path, uploaded_by_person_id
       FROM document_version_uploads
      WHERE document_version_id = $1
      ORDER BY minor`,
    [version.id],
  );

  assert.equal(subidas.length, 2, "🔴 la segunda subida pisó a la primera: eso es lo que veníamos a arreglar");
  assert.deepEqual(subidas.map((s) => Number(s.minor)), [1, 2], "las correcciones se numeran 1, 2");
  for (const s of subidas) {
    assert.equal(
      Number(s.uploaded_by_person_id),
      Number(FIXTURE.usuarioPersonId),
      "🔴 no consta quién subió el archivo: es justo el dato que faltaba",
    );
  }
  assert.notEqual(subidas[0].file_path, subidas[1].file_path, "cada subida es un objeto distinto en MinIO");

  // La ruta se explica sola: ronda y corrección van en carpetas.
  assert.match(subidas[0].file_path, /\/v\d{4}\/m0001\/working\//, "la primera vive en m0001");
  assert.match(subidas[1].file_path, /\/v\d{4}\/m0002\/working\//, "la segunda en m0002");

  // Y la etiqueta sube el SEGUNDO dígito: sigue siendo la misma ronda.
  const [tras] = await query(
    "SELECT version, version_minor, version_label, working_file_path FROM document_versions WHERE id = $1",
    [version.id],
  );
  assert.equal(Number(tras.version), Number(version.version), "no cambia la RONDA: corregir no es reiniciar");
  assert.equal(Number(tras.version_minor), 2);
  assert.equal(tras.version_label, `${version.version}.2`, "la etiqueta la compone la base");
  assert.equal(tras.working_file_path, subidas[1].file_path, "el archivo vigente es el último subido");
});
