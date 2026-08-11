// Acceso SQL directo — EXCLUSIVAMENTE para el teardown de los flows que escriben.
//
// Por qué existe (y por qué es una excepción, no la nueva norma):
// el harness es deliberadamente HTTP-only, porque lo que fijamos es el CONTRATO HTTP.
// Pero el borrador de plantilla escribe en cinco sitios y la limpieza NO se puede hacer
// por HTTP. Medido contra dev:
//   - `deliverables` no está en `config/sqlTables.js` ni tiene método de servicio que la
//     borre: NO existe ninguna ruta que elimine esa fila.
//   - `DELETE /admin/sql/process_definition_templates` responde 400 mientras la
//     configuración destino no esté en `draft` (la de la fixture está `active`).
//   - y sin borrar el vínculo, `DELETE /admin/sql/template_artifacts` responde 409 por FK.
// Dejar las filas rompería la regla de round-trips autolimpiantes.
//
// REGLA: esto se usa para LIMPIAR, nunca para ASERTAR. Una aserción contra SQL dejaría de
// verificar el contrato observable y empezaría a verificar el esquema.
//
// EXCEPCIÓN, con nombre y fecha: `flows/zzzzzz_flow_steps_db.test.mjs` (2026-08-10) SÍ asierta
// contra SQL, y usa el `query` de aquí para hacerlo. No es una grieta en la regla, es su límite:
// el §0.8 del plan maestro va a mover el flujo del `meta.yaml` a la base, y NO EXISTE contrato HTTP
// que observe el resultado. `GET /template_artifacts/:id/schema` parece servir y no sirve, y desde el
// sub-paso 5 sigue sin servir aunque ya lea de la base: devuelve el flujo APLANADO en forma de
// formulario, colapsa los dos portadores en una sola vista y no dice de cuál leyó, así que no puede
// observar la escritura doble ni el `can_reject` derivado. Y lo que se fija por HTTP del paquete es
// el `content_hash` de MinIO, que INCLUYE el `meta.yaml` y cambiará por construcción sin decir nada
// del flujo. Cuando lo que hay que caracterizar es el estado que un cambio va a reescribir, y
// ninguna ruta lo expone, el oráculo es la base. Fuera de ese flow, sigue valiendo la regla.
//
// SEGUNDA EXCEPCIÓN, con nombre y fecha: `flows/zzzzzzzz_default_process_routed.test.mjs`
// (2026-08-11), por el mismo límite. Ejercita el camino de usuario del Proceso por defecto
// (`POST /users/:id/general-tasks`, modo `routed`) y tiene que comprobar DE QUÉ cuelga el flujo que
// se materializa: `task_item_id` relleno y `template_artifact_id` en `NULL` es *la* propiedad que
// define el modo, y no hay respuesta HTTP que la diga. El endpoint devuelve ids y nada más.

import pg from "pg";

const { Pool } = pg;

let pool = null;

function getPool() {
  if (pool) return pool;
  const missing = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"]
    .filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Teardown SQL no disponible: faltan variables de entorno ${missing.join(", ")}. ` +
        "Los characterization tests deben correr DENTRO del contenedor backend.",
    );
  }
  pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    max: 2,
  });
  return pool;
}

export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result.rows;
}

export async function closeDb() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

// Borra TODO lo que deja un borrador de plantilla identificado por `code` (template_code /
// deliverables.code). El orden respeta las FK (ninguna cascada: todas son NO ACTION):
//   pasos de flujo → plantillas de flujo → vínculo a configuración → artifact → deliverable.
//
// ⚠️ EL FLUJO CUELGA DE DOS SITIOS, Y ESTE LIMPIADOR SOLO CONOCÍA UNO. Desde el sub-paso 3 del §0.8
// `saveTemplateArtifactDraft` escribe también el flujo AUTORADO colgando de `template_artifact_id`
// (con el vínculo a NULL), así que borrar solo lo que cuelga del vínculo dejaba filas apuntando al
// artifact y el `DELETE FROM template_artifacts` reventaba con
// `fk_fill_flow_templates_artifact`. No se manifestaba como un golden movido sino como TRES suites
// caídas en su `after()` —`zz_template_lifecycle`, `zzz_artifact_draft` y este mismo flow—, y de
// rebote como restos acumulados en `plantilla_entrega`. Fue el hallazgo del experimento desechable.
//
// Los objetos de MinIO NO se tocan a propósito: el prefijo es determinista
// (`System/<code>/<storage_version>/`), la subida lo reescribe idéntico en cada corrida y
// ningún golden lo observa. Borrarlo no aportaría estabilidad y no hay ruta que lo haga.
export async function cleanupDraftArtifactByCode(code) {
  const artifacts = await query(
    `SELECT ta.id
       FROM template_artifacts ta
       INNER JOIN deliverables d ON d.id = ta.deliverable_id
      WHERE d.code = $1`,
    [code],
  );
  const artifactIds = artifacts.map((row) => row.id);

  if (artifactIds.length) {
    const links = await query(
      "SELECT id FROM process_definition_templates WHERE template_artifact_id = ANY($1::int[])",
      [artifactIds],
    );
    const linkIds = links.map((row) => row.id);

    if (linkIds.length) {
      await query(
        `DELETE FROM fill_flow_steps
          WHERE fill_flow_template_id IN (
            SELECT id FROM fill_flow_templates WHERE process_definition_template_id = ANY($1::int[])
          )`,
        [linkIds],
      );
      await query(
        `DELETE FROM signature_flow_steps
          WHERE template_id IN (
            SELECT id FROM signature_flow_templates WHERE process_definition_template_id = ANY($1::int[])
          )`,
        [linkIds],
      );
      await query("DELETE FROM fill_flow_templates WHERE process_definition_template_id = ANY($1::int[])", [linkIds]);
      await query("DELETE FROM signature_flow_templates WHERE process_definition_template_id = ANY($1::int[])", [linkIds]);
      await query("DELETE FROM process_definition_templates WHERE id = ANY($1::int[])", [linkIds]);
    }

    // El segundo portador: el flujo autorado que cuelga del propio artifact (§0.8, sub-paso 3).
    await query(
      `DELETE FROM fill_flow_steps
        WHERE fill_flow_template_id IN (
          SELECT id FROM fill_flow_templates WHERE template_artifact_id = ANY($1::int[])
        )`,
      [artifactIds],
    );
    await query(
      `DELETE FROM signature_flow_steps
        WHERE template_id IN (
          SELECT id FROM signature_flow_templates WHERE template_artifact_id = ANY($1::int[])
        )`,
      [artifactIds],
    );
    await query("DELETE FROM fill_flow_templates WHERE template_artifact_id = ANY($1::int[])", [artifactIds]);
    await query("DELETE FROM signature_flow_templates WHERE template_artifact_id = ANY($1::int[])", [artifactIds]);

    await query("DELETE FROM template_artifacts WHERE id = ANY($1::int[])", [artifactIds]);
  }

  await query("DELETE FROM deliverables WHERE code = $1", [code]);
}

// --- Tareas ad-hoc del Proceso por defecto: borrar el GRAFO entero -------------------------------
//
// Lo usa `flows/zzzzzzzz_default_process_routed.test.mjs`, que ejercita el camino de usuario
// `POST /users/:id/general-tasks`. Ese endpoint escribe en NUEVE tablas dentro de una sola
// transacción (terms, tasks, task_items, las cuatro de flujo de runtime, documents,
// document_versions, document_fill_flows, fill_requests) y **no existe ninguna ruta HTTP que
// deshaga nada de eso**: el CRUD de admin no expone `terms` ni `document_fill_flows`, y el borrado
// de un `task_item` chocaría con las FK de `documents` (todas NO ACTION salvo dos).
//
// Se entra por el TÍTULO del entregable en vez de por ids, para que el limpiador valga también como
// guardia de idempotencia en el `before`: si una corrida anterior murió a medias, los restos se
// localizan sin recordar ningún id. De los entregables se sube a sus tareas y se borra la tarea
// COMPLETA — el modo `derived` cuelga su entregable de la tarea que creó el modo `free`, así que
// borrar por tarea cubre los dos de una vez.
//
// El orden respeta las FK de abajo arriba. Las dos cascadas que sí existen
// (`fill_flow_templates.task_item_id` y su gemela de firma) se borran igualmente a mano: dependen de
// que el `DELETE` de `task_items` llegue a ejecutarse, y ese es justo el que revienta si algo quedó
// colgando.
export async function cleanupGeneralTaskGraphByItemTitlePrefix(prefix) {
  const taskRows = await query(
    "SELECT DISTINCT task_id AS id FROM task_items WHERE title LIKE $1",
    [`${prefix}%`],
  );
  const taskIds = taskRows.map((row) => Number(row.id));
  if (!taskIds.length) return;

  const itemRows = await query("SELECT id FROM task_items WHERE task_id = ANY($1::int[])", [taskIds]);
  const itemIds = itemRows.map((row) => Number(row.id));

  const documentRows = itemIds.length
    ? await query("SELECT id FROM documents WHERE task_item_id = ANY($1::int[])", [itemIds])
    : [];
  const documentIds = documentRows.map((row) => Number(row.id));

  const versionRows = documentIds.length
    ? await query("SELECT id FROM document_versions WHERE document_id = ANY($1::int[])", [documentIds])
    : [];
  const versionIds = versionRows.map((row) => Number(row.id));

  if (versionIds.length) {
    await query(
      `DELETE FROM fill_requests
        WHERE document_fill_flow_id IN (
          SELECT id FROM document_fill_flows WHERE document_version_id = ANY($1::int[])
        )`,
      [versionIds],
    );
    await query("DELETE FROM document_fill_flows WHERE document_version_id = ANY($1::int[])", [versionIds]);
    // Firma: hoy este camino no llega a instanciarla (hace falta subir y aprobar), pero el borrado
    // va igual — un teardown que solo funciona mientras el flujo no avance no es un teardown.
    await query(
      `DELETE FROM signature_requests
        WHERE instance_id IN (
          SELECT id FROM signature_flow_instances WHERE document_version_id = ANY($1::int[])
        )`,
      [versionIds],
    );
    await query("DELETE FROM signature_flow_instances WHERE document_version_id = ANY($1::int[])", [versionIds]);
    await query("DELETE FROM document_signatures WHERE document_version_id = ANY($1::int[])", [versionIds]);
    await query("DELETE FROM document_workflow_observations WHERE document_version_id = ANY($1::int[])", [versionIds]);
    await query("DELETE FROM document_attachments WHERE document_version_id = ANY($1::int[])", [versionIds]);
    await query("DELETE FROM document_versions WHERE id = ANY($1::int[])", [versionIds]);
  }
  if (documentIds.length) {
    await query("DELETE FROM documents WHERE id = ANY($1::int[])", [documentIds]);
  }

  if (itemIds.length) {
    await query(
      `DELETE FROM fill_flow_steps
        WHERE fill_flow_template_id IN (
          SELECT id FROM fill_flow_templates WHERE task_item_id = ANY($1::int[])
        )`,
      [itemIds],
    );
    await query(
      `DELETE FROM signature_flow_steps
        WHERE template_id IN (
          SELECT id FROM signature_flow_templates WHERE task_item_id = ANY($1::int[])
        )`,
      [itemIds],
    );
    await query("DELETE FROM fill_flow_templates WHERE task_item_id = ANY($1::int[])", [itemIds]);
    await query("DELETE FROM signature_flow_templates WHERE task_item_id = ANY($1::int[])", [itemIds]);
    await query("DELETE FROM task_item_handovers WHERE task_item_id = ANY($1::int[])", [itemIds]);
    await query("DELETE FROM task_items WHERE id = ANY($1::int[])", [itemIds]);
  }

  const termRows = await query("SELECT DISTINCT term_id AS id FROM tasks WHERE id = ANY($1::int[])", [taskIds]);
  const termIds = termRows.map((row) => Number(row.id)).filter(Boolean);

  await query("DELETE FROM task_assignments WHERE task_id = ANY($1::int[])", [taskIds]);
  await query("DELETE FROM tasks WHERE id = ANY($1::int[])", [taskIds]);

  // El periodo Custom lo crea la tarea libre y es suyo (`terms.name` es UNIQUE global y lleva un
  // sufijo con el reloj). Aun así se comprueba que no lo use nadie más: si el `NOT EXISTS` sobra,
  // no cuesta nada; si algún día no sobra, evita un teardown que borra la fixture de otro.
  if (termIds.length) {
    await query(
      "DELETE FROM terms WHERE id = ANY($1::int[]) AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.term_id = terms.id)",
      [termIds],
    );
  }
}

// ¿Sobrevive una fila `deliverables` con este `code`? Se usa para FIJAR el defecto de
// compensación (la creación fallida deja el deliverable huérfano), no para limpiar.
export async function findDeliverableByCode(code) {
  const rows = await query(
    "SELECT code, owner_process_id, owner_variation_key FROM deliverables WHERE code = $1",
    [code],
  );
  return rows[0] ?? null;
}

// --- Jobs de firma masiva: SEMBRAR la precondición, no asertar sobre ella -----------------------
//
// Segunda excepción a la regla HTTP-only, y por el mismo motivo que la primera: no hay otra vía.
// `signature_batch_jobs` NO está en `config/sqlTables.js`, así que no la expone el CRUD de admin, y
// el único camino HTTP que crea un job es `POST /sign/batch/start`, que exige un certificado PKCS#12
// real en MinIO y arranca de inmediato un bucle que habla con el firmante por RabbitMQ. Caracterizar
// los guards de `getSignBatchStatus`/`downloadSignBatch` (404 antes que 403, y el 400 del lote sin
// firmados) por esa vía sería atar el golden al microservicio de firma.
//
// Se siembra la fila, se ejercitan los guards por HTTP y se borra en el `after`. La ASERCIÓN sigue
// siendo el contrato HTTP; esto solo pone la precondición.
export async function upsertSignatureBatchJob(job) {
  await query(
    `INSERT INTO signature_batch_jobs
       (job_id, user_id, sign_mode, status, total, processed, success_count, failed_count, results)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (job_id) DO UPDATE SET
       user_id = EXCLUDED.user_id, sign_mode = EXCLUDED.sign_mode, status = EXCLUDED.status,
       total = EXCLUDED.total, processed = EXCLUDED.processed,
       success_count = EXCLUDED.success_count, failed_count = EXCLUDED.failed_count,
       results = EXCLUDED.results`,
    [
      job.jobId,
      job.userId ?? null,
      job.signMode ?? "coordinates",
      job.status ?? "completed",
      job.total ?? 0,
      job.processed ?? 0,
      job.successCount ?? 0,
      job.failedCount ?? 0,
      JSON.stringify(job.results ?? []),
    ],
  );
}

export async function deleteSignatureBatchJob(jobId) {
  await query("DELETE FROM signature_batch_jobs WHERE job_id = $1", [jobId]);
}

export async function countSignatureBatchJobs() {
  const rows = await query("SELECT COUNT(*)::int AS total FROM signature_batch_jobs");
  return Number(rows[0]?.total ?? 0);
}

// --- Restauración de la solicitud de entrega usada por zzzz_sign_workflow -----------------------
//
// La máquina de estados de `fill_requests` NO tiene marcha atrás por HTTP: de `approved` no se sale,
// y el CRUD de admin rechaza el `UPDATE` porque su hook re-sincroniza el progreso documental y la
// transición inversa de `document_versions` es ilegal. Así que la vuelta al estado inicial se hace
// por SQL, igual que la limpieza del borrador de plantilla.
//
// Restaura SOLO las dos filas cuyos valores leen los golden de otros flows (la solicitud y su
// versión documental). Lo que este teardown NO deshace, y por eso el flow lleva prefijo `zzzz_` y
// debe seguir corriendo el último: `document_observations`, `task_items.user_started_at`,
// `document_fill_flows.status/current_step_order` y las instancias de flujo de firma que crea una
// aprobación.
export async function captureFillRequestFixture(fillRequestId) {
  const rows = await query(
    `SELECT fr.id, fr.assigned_person_id, fr.status, fr.is_manual, fr.responded_at, fr.response_note,
            dv.id AS document_version_id, dv.status AS dv_status, dv.working_file_path
       FROM fill_requests fr
       INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
       INNER JOIN document_versions dv ON dv.id = dff.document_version_id
      WHERE fr.id = $1`,
    [fillRequestId],
  );
  return rows[0] ?? null;
}

export async function restoreFillRequestFixture(snapshot) {
  if (!snapshot) return;
  await query(
    `UPDATE fill_requests
        SET assigned_person_id = $2, status = $3, is_manual = $4, responded_at = $5, response_note = $6
      WHERE id = $1`,
    [
      snapshot.id,
      snapshot.assigned_person_id,
      snapshot.status,
      snapshot.is_manual,
      snapshot.responded_at,
      snapshot.response_note,
    ],
  );
  await query(
    "UPDATE document_versions SET status = $2, working_file_path = $3 WHERE id = $1",
    [snapshot.document_version_id, snapshot.dv_status, snapshot.working_file_path],
  );
}
