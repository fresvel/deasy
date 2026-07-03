// Setup reproducible de datos de EJECUCIÓN vía API (no vía seed SQL).
//
// El seed baseline deja vacía TODA la capa de plantillas+ejecución (incluidas
// process_definition_templates / target_rules / period_types), así que un
// "launch" de la definición sembrada no produce nada. La vía self-contained es
// la ROUTED: el "Proceso por defecto" (pdv 1) permite crear una tarea ad-hoc
// que materializa su propio flujo (entrega + firma) en runtime.
//
// Este script, ejecutado por HTTP contra el stack, deja datos deterministas en:
//   tasks, task_items, documents, document_versions,
//   fill_flow_templates, fill_flow_steps, document_fill_flows, fill_requests,
//   signature_flow_templates, signature_flow_steps
// (signature_flow_instances/requests requieren upload+approve; se abordan aparte)
//
// Orden reproducible:
//   1) scripts/seed-db.sh dev apply         (baseline limpio)
//   2) node tests/characterization/setup/seed_execution.mjs
//   3) capturar/verificar golden (npm run test:char)

import { post, get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { getMariaDBPool } from "../../../config/mariadb.js";

// unit_position 10 vive en unit_id 16 (ver DESCRIBE unit_positions). Le damos
// puesto vigente a la persona 3 (usuario) para que pueda crear general-tasks ahí.
const UNIT_POSITION_ID = Number(process.env.SEED_UNIT_POSITION_ID ?? 10);
const UNIT_ID = Number(process.env.SEED_UNIT_ID ?? 16);
const USUARIO_PERSON_ID = Number(process.env.SEED_USUARIO_PERSON_ID ?? 3);
const ADMIN_PERSON_ID = Number(process.env.SEED_ADMIN_PERSON_ID ?? 1);

// El baseline siembra `deliverables` (identidad) pero NO `template_artifacts`
// ni el link `process_definition_templates`. Sin ese link, ni el launch ni el
// routed pueden materializar entregables. Sembramos el mínimo por CRUD, ligado
// al deliverable del proceso por defecto (id 5, tpl_informe_general, process 1).
// Asume baseline fresco (protocolo: seed apply -> este setup), así que no hay
// que deduplicar.
const DELIVERABLE_ID = Number(process.env.SEED_DELIVERABLE_ID ?? 5);
const DEFINITION_ID = Number(process.env.SEED_DEFINITION_ID ?? 1);

// La creación de template_artifacts está bloqueada en el endpoint CRUD (solo
// se registran por sync desde MinIO o el flujo de plantilla). Para un golden
// determinista SIN infra de MinIO, sembramos la fila directamente por el pool
// (bypass del guard del endpoint, no de la DB) y dejamos que el resto del flujo
// de ejecución lo produzca la lógica real de la app vía API. Idempotente.
async function seedTemplateLayer() {
  const pool = getMariaDBPool();
  const prefix = "official/tpl_informe_general";

  const [existing] = await pool.query(
    `SELECT ta.id FROM process_definition_templates pdt
       JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
      WHERE pdt.process_definition_id = ? LIMIT 1`,
    [DEFINITION_ID]
  );
  if (existing.length) {
    console.log("[setup] template layer ya presente (artifact id=%s), skip", existing[0].id);
    return;
  }

  const [artRes] = await pool.query(
    `INSERT INTO template_artifacts
       (deliverable_id, storage_version, lifecycle_state, base_object_prefix,
        available_formats, schema_object_key, meta_object_key, is_active)
     VALUES (?, ?, 'published', ?, ?, ?, ?, 1)`,
    [DELIVERABLE_ID, "v1", prefix, '["pdf"]', `${prefix}/schema.json`, `${prefix}/meta.json`]
  );
  const artifactId = artRes.insertId;

  await pool.query(
    `INSERT INTO process_definition_templates
       (process_definition_id, template_artifact_id, sort_order, item_mode)
     VALUES (?, ?, 1, 'single')`,
    [DEFINITION_ID, artifactId]
  );
  console.log("[setup] template layer sembrado (artifact id=%s, ligado a pdv %s)", artifactId, DEFINITION_ID);
}

async function main() {
  await waitForReady();
  const admin = await tokenFor("admin");

  // 0) Sembrar la capa de plantillas mínima que el baseline omite.
  await seedTemplateLayer();

  // 1) Asignar puesto vigente a la persona usuario (idempotente: el endpoint
  //    hace upsert del assignment current).
  const assign = await post(`/admin/sql/units/positions/${UNIT_POSITION_ID}/assign`, {
    token: admin,
    body: { person_id: USUARIO_PERSON_ID },
  });
  console.log("[setup] assign puesto:", assign.status, JSON.stringify(assign.body));

  // 2) Crear la tarea ad-hoc routed como la persona usuario, con flujo de
  //    entrega (usuario) y firma (admin).
  const usuario = await tokenFor("usuario");
  const task = await post(`/users/${USUARIO_PERSON_ID}/general-tasks`, {
    token: usuario,
    body: {
      mode: "free",
      title: "Informe de evento (characterization seed)",
      description: "Tarea ad-hoc determinista para golden-master.",
      unit_id: UNIT_ID,
      recipient_person_id: USUARIO_PERSON_ID,
      flow: {
        entrega: [{ person_id: USUARIO_PERSON_ID }],
        firma: [{ person_id: ADMIN_PERSON_ID }],
      },
    },
  });
  console.log("[setup] general-task:", task.status, JSON.stringify(task.body));
  if (task.status !== 200 && task.status !== 201) {
    throw new Error(`general-task falló: ${task.status} ${JSON.stringify(task.body)}`);
  }

  // 3) Comprobación de poblado.
  for (const t of [
    "tasks", "task_items", "task_assignments", "documents", "document_versions",
    "fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests",
    "signature_flow_templates", "signature_flow_steps",
    "signature_flow_instances", "signature_requests",
  ]) {
    const res = await get(`/admin/sql/${t}`, { token: admin });
    const rows = Array.isArray(res.body) ? res.body : res.body?.data ?? res.body?.rows ?? res.body;
    const count = Array.isArray(rows) ? rows.length : "?";
    console.log(`[setup] ${t}: status=${res.status} count=${count}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
