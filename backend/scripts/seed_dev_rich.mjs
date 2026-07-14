// Fixture RICA de desarrollo: crea un segundo proceso, de modo `single`, dirigido al cargo
// Docente de "Tecnologías de la Información" (unidad 8), y lo lanza en el periodo Permanente.
//
// POR QUÉ EXISTE
// El bootstrap con datos de ejemplo deja un organigrama completo pero UN SOLO proceso: el
// "Proceso por defecto" (routed). Con eso, /home no se puede verificar de verdad: no hay
// multi-selección de procesos, ni encabezados de grupo, ni entregables single/replicated,
// que es justo la parte más intrincada de HomeView. Este script cierra ese hueco.
//
// CÓMO
// Casi todo por la API de admin (/admin/sql/...), NO con SQL directo: así pasa por
// SqlAdminService.validateTableRules y los datos quedan válidos para el esquema de hoy.
// El entregable se obtiene "forkeando" el que ya sembró el bootstrap (tpl_informe_general):
// un entregable pertenece a UNA línea y no se puede prestar a otra, así que el fork crea uno
// propio y copia sus objetos en MinIO. No hace falta subir nada a mano.
//
// RESULTADO
// La persona 3 ("usuario", cédula 1122334455) pasa a ver DOS procesos en /home:
//   - "Proceso por defecto"  (routed)  -> se muestra como "Tareas"
//   - "Informe de Gestión Docente" (single) -> con entregable, flujo de entrega y de firma
//
// USO:  node scripts/seed_dev_rich.mjs        (dentro del contenedor backend)
// Es IDEMPOTENTE: si el proceso ya existe, no lo duplica.

import { get, post, put } from "../tests/characterization/lib/http.mjs";
import { tokenFor } from "../tests/characterization/lib/auth.mjs";
import SqlAdminService from "../services/admin/SqlAdminService.js";

const sqlAdmin = new SqlAdminService();

const SLUG = "informe-gestion-docente";
const UNIT_ID = 8;            // Tecnologías de la Información
const CARGO_DOCENTE = 2;      // destinatario del proceso (quien elabora)
const CARGO_COORDINADOR = 1;  // quien firma
const TERM_TYPE_PERM = 5;     // Permanente
const TERM_PERM = 1;
// Objetos que el bootstrap ya publicó en MinIO: los reutilizamos apuntando a ellos.
const SEED_ARTIFACT_ID = 1;   // tpl_informe_general, ya publicado por el bootstrap

const rowsOf = (res) => (Array.isArray(res.body) ? res.body : res.body?.data ?? res.body?.rows ?? []);

const create = async (table, body, token) => {
  const res = await post(`/admin/sql/${table}`, { token, body });
  if (res.status >= 400) {
    throw new Error(`POST /admin/sql/${table} -> ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const id = res.body?.insertId ?? res.body?.id ?? res.body?.data?.id;
  console.log(`  ✔ ${table} #${id}`);
  return id;
};

const main = async () => {
  const token = await tokenFor("admin");

  // Idempotencia: si ya está, no duplicar.
  const existing = rowsOf(await get("/admin/sql/processes", { token }));
  if (existing.some((p) => p.slug === SLUG)) {
    console.log(`El proceso "${SLUG}" ya existe. Nada que hacer.`);
    return;
  }

  console.log("Creando proceso 'Informe de Gestión Docente' (modo single)...");

  // 1. Serie: nombra el proceso y blinda el cargo de la regla.
  const seriesId = await create("process_definition_series", {
    source_type: "cargo",
    cargo_id: CARGO_DOCENTE,
    code: SLUG,
    is_active: 1,
  }, token);

  // 2. Proceso.
  const processId = await create("processes", {
    name: "Informe de Gestión Docente",
    slug: SLUG,
    is_active: 1,
  }, token);

  // 3. Definición. REGLA DE NEGOCIO: sólo puede crearse en `draft`; se activa al final,
  //    cuando ya tiene plantilla, flujos y regla de reparto (SqlAdminService lo exige).
  const today = new Date().toISOString().slice(0, 10);
  const definitionId = await create("process_definition_versions", {
    process_id: processId,
    series_id: seriesId,
    variation_key: "general",
    definition_version: "1.0.0",
    name: "Informe de Gestión Docente",
    description: "Informe semestral de gestión que elabora cada docente y firma su coordinador.",
    status: "draft",
    active_series_flag: 1,
    effective_from: today,
  }, token);

  // 4. Periodo en el que puede lanzarse: Permanente (para poder lanzar en el term 1).
  await create("process_definition_period_types", {
    process_definition_id: definitionId,
    term_type_id: TERM_TYPE_PERM,
    is_active: 1,
  }, token);

  // 5. Entregable PROPIO de esta línea, "forkeado" del que sembró el bootstrap.
  //
  //    REGLA DE NEGOCIO: un entregable pertenece a una línea (owner_process_id +
  //    owner_variation_key) y NO puede vincularse a otra configuración. Por eso NO se puede
  //    reutilizar "tpl_informe_general" (es del proceso por defecto).
  //
  //    forkDeliverableForConfig es justo la operación que la UI llama "Crear a partir de
  //    este": crea el entregable de la línea destino, COPIA los objetos de MinIO a un
  //    prefijo propio y publica el artefacto. Hoy no está expuesta como endpoint, así que se
  //    invoca directamente sobre el servicio (este script corre dentro del backend).
  //
  //    Se llama ANTES de crear el vínculo: el fork solo hace UPDATE del enlace existente
  //    (que aún no hay, así que no afecta a nada) y nos devuelve el artefacto nuevo, que ya
  //    pertenece a nuestra línea y por tanto SÍ pasa la validación al vincularlo.
  console.log("Forkeando el entregable a la nueva línea (copia objetos en MinIO)...");
  const fork = await sqlAdmin.forkDeliverableForConfig({
    sourceArtifactId: SEED_ARTIFACT_ID,
    definitionId,
    newCode: "tpl_informe_gestion_docente",
  });
  console.log(`  ✔ entregable #${fork.deliverable_id}, artefacto #${fork.artifact_id} (${fork.base_object_prefix})`);

  // 6. Plantilla vinculada en modo SINGLE: 1 instancia al lanzar, con flujo predefinido.
  const pdtId = await create("process_definition_templates", {
    process_definition_id: definitionId,
    template_artifact_id: fork.artifact_id,
    sort_order: 1,
    item_mode: "single",
  }, token);

  // 7. Flujo de ENTREGA: lo llena el responsable de la tarea (el docente).
  const fillTplId = await create("fill_flow_templates", {
    process_definition_template_id: pdtId,
    name: "Elaboración del informe",
    is_active: 1,
  }, token);
  await create("fill_flow_steps", {
    fill_flow_template_id: fillTplId,
    step_order: 1,
    resolver_type: "task_assignee",   // "Responsable del entregable"
    selection_mode: "auto_one",
    is_required: 1,
  }, token);

  // 8. Flujo de FIRMA: lo firma el Coordinador de la misma unidad.
  const signTplId = await create("signature_flow_templates", {
    process_definition_template_id: pdtId,
    name: "Firma del coordinador",
    is_active: 1,
  }, token);
  await create("signature_flow_steps", {
    template_id: signTplId,
    step_order: 1,
    name: "Coordinador de carrera",
    resolver_type: "cargo_in_scope",  // "Por cargo"
    required_cargo_id: CARGO_COORDINADOR,
    unit_scope_type: "unit_exact",
    unit_id: UNIT_ID,
    selection_mode: "auto_all",
    approval_mode: "and",
  }, token);

  // 9. Regla de reparto: a los Docentes de la unidad 8 (ahí está la persona 3).
  await create("process_target_rules", {
    process_definition_id: definitionId,
    unit_scope_type: "unit_exact",
    unit_id: UNIT_ID,
    cargo_id: CARGO_DOCENTE,
    recipient_policy: "all_matches",
    priority: 1,
    is_active: 1,
  }, token);

  // 10. ACTIVAR la definición: ya tiene plantilla, flujos y regla. Hasta ahora era draft.
  console.log("Activando la definición...");
  // La ruta es PUT /:table (sin :id): la fila se identifica con `keys` en el cuerpo.
  const act = await put("/admin/sql/process_definition_versions", {
    token,
    body: { keys: { id: definitionId }, data: { status: "active" } },
  });
  if (act.status >= 400) {
    throw new Error(`Activación falló -> ${act.status}: ${JSON.stringify(act.body)}`);
  }
  console.log("  ✔ activa");

  // 11. Lanzar en el periodo Permanente -> materializa tareas, task_items y flujos.
  console.log("Lanzando la definición en el periodo Permanente...");
  const launch = await post(`/admin/process-definitions/${definitionId}/launch`, {
    token,
    body: { term_id: TERM_PERM },
  });
  if (launch.status >= 400) {
    throw new Error(`Lanzamiento falló -> ${launch.status}: ${JSON.stringify(launch.body)}`);
  }
  console.log("  ✔ lanzado:", JSON.stringify(launch.body).slice(0, 160));

  // Comprobación: ¿la persona 3 ve ya los dos procesos?
  const menu = await get("/users/3/menu", { token });
  const procesos = (menu.body?.units ?? [])
    .flatMap((u) => u.cargos ?? [])
    .flatMap((c) => c.processes ?? [])
    .map((p) => p.name);
  console.log("\nProcesos visibles para la persona 3:", procesos);
  if (procesos.length < 2) {
    console.warn("⚠ La persona 3 sigue sin ver 2 procesos: revisa la regla de reparto.");
  } else {
    console.log("✅ Fixture rica lista: /home ya tiene multi-proceso.");
  }
};

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
