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

    await query("DELETE FROM template_artifacts WHERE id = ANY($1::int[])", [artifactIds]);
  }

  await query("DELETE FROM deliverables WHERE code = $1", [code]);
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
