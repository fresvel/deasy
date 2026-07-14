// Characterization: GENERACIÓN Y LANZAMIENTO DE TAREAS (TaskGenerationService, 2006 L).
//
// Por qué existe: los 4 endpoints que alimenta este servicio NO tenían ninguna
// cobertura. El setup solo lo ejercía de refilón por /users/:id/general-tasks (camino
// ad-hoc); todo el camino de LANZAMIENTO — launchDefinitionInTerm, ensureProcessRun,
// ensureTaskItemsForTask, ensureTaskAssignmentsForDefinition, generateTasksForTerm —
// estaba a ciegas. Este flow lo fija ANTES de partir el God Object.
//
// ⚠️ EL PREFIJO "zz_" ES DELIBERADO, NO UN DESCUIDO.
// Los flows se ejecutan en orden alfabético (glob) y con --test-concurrency=1. Este
// flow MUTA la base (lanzar una definición crea process_runs, tasks y task_items), así
// que debe correr EL ÚLTIMO: si corriera antes, sus escrituras alterarían los golden de
// execution/tasks/user_workspace (panel, document-center...) y los romperían.
// Si algún día añades un flow que ordene después de este, muévelo o renómbralo.
//
// Dentro del fichero el orden TAMBIÉN importa: primero se fijan los estados "antes de
// lanzar", luego se lanza, luego el "después".
//
// ✅ DEFECTO YA CORREGIDO (commit del arreglo de codigos de estado). Estos tests fijaban
// el comportamiento roto: el "no encontrado" salia como 500 (la excepcion caia en el catch
// generico) y /launch como 400. Ahora los cuatro endpoints devuelven 404, y el resto de
// excepciones de negocio llevan su codigo (403 "no puedes", 409 "ya esta iniciado") via
// errors/HttpError.js. Estos casos son ahora la regresion que impide volver al 500.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, put } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "task_generation";

// Los ids de la capa de ejecución derivan entre reseeds; las fechas del term sentinela
// (1900-01-01 / 9999-12-31) son estables y sí forman parte del contrato.
const OBJ_OPTS = { extraMask: ["launched_at", "created_at", "term_name"], maskIdKeys: true };

const DEFINITION_ID = FIXTURE.definitionId; // 1 = "Proceso por defecto" (routed, Permanente)
const TERM_ID = 1;                          // term sentinela "Permanente"
const USUARIO_ID = FIXTURE.usuarioPersonId;

before(async () => {
  await waitForReady();
});

// ─── 1. Estado ANTES de lanzar (getTermLaunchStatus / getDefinitionLaunchInfo) ───

test("GET /admin/terms/:termId/launch-status (sin lanzar) -> pendiente", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/terms/${TERM_ID}/launch-status`, { token });
  assert.equal(res.status, 200);
  assert.equal(res.body?.definitions?.[0]?.launched, false, "la definición aún no debe estar lanzada");
  matchSnapshot(SUITE, "launch_status_antes", snapshotShape(res, OBJ_OPTS));
});

test("GET /admin/process-definitions/:id/launch-info (sin lanzar) -> términos disponibles", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/process-definitions/${DEFINITION_ID}/launch-info`, { token });
  assert.equal(res.status, 200);
  matchSnapshot(SUITE, "launch_info_antes", snapshotShape(res, OBJ_OPTS));
});

// ─── 2. Rutas de error (NO mutan) — fijan el defecto de status descrito arriba ───

test("GET /admin/terms/:termId/launch-status con periodo inexistente -> 404", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/terms/999999/launch-status", { token });
  assert.equal(res.status, 404, "un periodo inexistente es 404, no un error de servidor");
  matchSnapshot(SUITE, "launch_status_periodo_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("GET /admin/process-definitions/:id/launch-info inexistente -> 404", async () => {
  const token = await tokenFor("admin");
  const res = await get("/admin/process-definitions/999999/launch-info", { token });
  assert.equal(res.status, 404, "una definicion inexistente es 404, no un error de servidor");
  matchSnapshot(SUITE, "launch_info_definicion_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/process-definitions/:id/launch inexistente -> 404", async () => {
  const token = await tokenFor("admin");
  const res = await post("/admin/process-definitions/999999/launch", { token, body: { term_id: TERM_ID } });
  assert.equal(res.status, 404, "coherente con los GET: definicion inexistente = 404 (antes daba 400)");
  matchSnapshot(SUITE, "launch_definicion_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/process-definitions/:id/launch sin term_id -> 400", async () => {
  const token = await tokenFor("admin");
  const res = await post(`/admin/process-definitions/${DEFINITION_ID}/launch`, { token, body: {} });
  matchSnapshot(SUITE, "launch_sin_term", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/terms/:termId/generate-tasks con periodo inexistente -> 404", async () => {
  const token = await tokenFor("admin");
  const res = await post("/admin/terms/999999/generate-tasks", { token });
  assert.equal(res.status, 404, "un periodo inexistente es 404, no un error de servidor");
  matchSnapshot(SUITE, "generate_tasks_periodo_inexistente", snapshotShape(res, OBJ_OPTS));
});

// OJO: aquí NO vale probar el 403 con el usuario "usuario". Parece de baja privilegia,
// pero `cargo_role_map` lo ELEVA a GestorEjecucionProcesos por su cargo DOCENTE (ver
// config.mjs), así que SÍ tiene process_execution.create y el lanzamiento le sale 200
// — mutando la base antes del test de lanzamiento de abajo. El 403 por permisos ya está
// cubierto en rbac.test.mjs; aquí basta la puerta de autenticación, que no muta.
test("POST /admin/process-definitions/:id/launch sin token -> 401", async () => {
  const res = await post(`/admin/process-definitions/${DEFINITION_ID}/launch`, { body: { term_id: TERM_ID } });
  assert.equal(res.status, 401, `debería exigir token, devolvió ${res.status}`);
  matchSnapshot(SUITE, "launch_sin_token", snapshotShape(res, OBJ_OPTS));
});

// ─── 3. Lanzamiento real (MUTA) — el camino que estaba a ciegas ───

test("POST /admin/process-definitions/:id/launch -> lanza la definicion en el periodo", async () => {
  const token = await tokenFor("admin");
  const res = await post(`/admin/process-definitions/${DEFINITION_ID}/launch`, {
    token,
    body: { term_id: TERM_ID },
  });
  assert.equal(res.status, 200, `el lanzamiento debe funcionar: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "launch_ok", snapshotShape(res, OBJ_OPTS));
});

test("GET /admin/terms/:termId/launch-status (tras lanzar) -> launched=true y run activo", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/admin/terms/${TERM_ID}/launch-status`, { token });
  assert.equal(res.status, 200);
  const def = res.body?.definitions?.[0];
  assert.equal(def?.launched, true, "tras lanzar, launched debe ser true");
  assert.ok(def?.run_count >= 1, "debe haber al menos una corrida");
  matchSnapshot(SUITE, "launch_status_despues", snapshotShape(res, OBJ_OPTS));
});

test("POST /admin/terms/:termId/generate-tasks -> generacion automatica idempotente", async () => {
  const token = await tokenFor("admin");
  const res = await post(`/admin/terms/${TERM_ID}/generate-tasks`, { token });
  matchSnapshot(SUITE, "generate_tasks_ok", snapshotShape(res, OBJ_OPTS));
});

// ─── 3-bis. Códigos de estado de las excepciones de negocio ───
//
// Defecto sistémico corregido: TODA excepción de negocio caía en el catch genérico y salía
// como 500 con el mensaje interno en crudo. Un entregable ya iniciado, una solicitud de otra
// persona y un periodo inexistente eran, los tres, "error de servidor". Eso miente al cliente,
// ensucia la monitorización (un 500 deja de significar nada) e impide al frontend distinguir
// "no existe" de "no puedes" de "ya está hecho". Ahora cada uno lleva su código (errors/HttpError.js).
// El fixture base no tiene solicitudes de entrega de OTRAS personas (solo la ad-hoc de la
// persona 3), así que el test construye la condición: reasigna temporalmente la solicitud a
// otra persona, comprueba el 403 y la devuelve a su dueña.
test("la solicitud de entrega de OTRA persona -> 403 (no 500)", async () => {
  const admin = await tokenFor("admin");
  const usuario = await tokenFor("usuario");

  const reqs = await get("/admin/sql/fill_requests", { token: admin });
  const filas = Array.isArray(reqs.body) ? reqs.body : reqs.body?.data ?? [];
  const mia = filas.find((r) => Number(r.assigned_person_id) === USUARIO_ID);
  assert.ok(mia, "no hay ninguna solicitud de entrega de la persona 3: ¿corrió el setup?");

  const reasignar = (personId) => put("/admin/sql/fill_requests", {
    token: admin,
    body: { keys: { id: mia.id }, data: { assigned_person_id: personId } },
  });

  await reasignar(FIXTURE.gestorPersonId); // ahora es de OTRA persona
  try {
    const res = await post(`/sign/fill-requests/${mia.id}/start`, { token: usuario });
    assert.equal(res.status, 403, "operar la solicitud de otro es 403, no un error de servidor");
  } finally {
    await reasignar(USUARIO_ID); // devolver a su dueña, pase lo que pase
  }
});

test("re-iniciar un entregable YA iniciado -> 409 (no 500)", async () => {
  const admin = await tokenFor("admin");
  const usuario = await tokenFor("usuario");

  const reqs = await get("/admin/sql/fill_requests", { token: admin });
  const filas = Array.isArray(reqs.body) ? reqs.body : reqs.body?.data ?? [];
  const mia = filas.find((r) => Number(r.assigned_person_id) === USUARIO_ID);
  assert.ok(mia, "no hay ninguna solicitud de entrega de la persona 3");

  // Primer start: puede ir bien (si estaba pendiente) o ser ya un 409 (si el setup la inició).
  await post(`/sign/fill-requests/${mia.id}/start`, { token: usuario });

  // El SEGUNDO start es el caso: el estado ya no admite la operación.
  const res = await post(`/sign/fill-requests/${mia.id}/start`, { token: usuario });
  assert.equal(res.status, 409, "un entregable ya iniciado es 409 (conflicto), no un error de servidor");
});

// ─── 4. REGRESIÓN DE SEGURIDAD: IDOR entre entregables de la misma tarea ───
//
// Un proceso dirigido a un CARGO crea UNA tarea por unidad con UN task_item por persona.
// El guard de acceso comprobaba la asignación a la TAREA, no la propiedad del ENTREGABLE,
// así que todos los responsables de una misma tarea podían leer (y DESCARGAR) el documento
// de los demás. Verificado en su día: HTTP 200 devolviendo el PDF ajeno.
//
// El fixture base NO reproduce el escenario (no hay tareas multi-persona), así que el test
// lo CONSTRUYE: añade a la tarea de la persona 3 un task_item cuyo responsable es OTRO
// puesto, ocupado por otra persona. Si alguien relaja el predicado, esto vuelve a pasar.
test("un usuario NO puede acceder al entregable de otro dentro de su misma tarea (IDOR)", async () => {
  const admin = await tokenFor("admin");

  // OJO con la elección de la tarea: NO vale la tarea ad-hoc de la persona 3, porque hay una
  // rama LEGÍTIMA (`t.created_by_user_id = ?`) que da acceso a todos los ítems de una tarea
  // que TÚ creaste (es tu envío). El IDOR vivía en las tareas LANZADAS POR EL SISTEMA, así
  // que usamos una de esas (created_by NULL), que el test de lanzamiento de arriba ya creó.
  const tareas = await get("/admin/sql/tasks", { token: admin });
  const filas = Array.isArray(tareas.body) ? tareas.body : tareas.body?.data ?? [];
  const tarea = filas.find(
    (t) => t.created_by_user_id == null
      && Number(t.process_definition_id) === DEFINITION_ID
      && Number(t.scope_unit_id) === FIXTURE.unitId
  );
  assert.ok(tarea, "no hay tarea del sistema en la unidad del usuario: ¿corrió el lanzamiento?");

  // Dos entregables en LA MISMA tarea: uno del usuario, otro de una persona distinta.
  const crearItem = async (responsiblePositionId, titulo, sortOrder) => {
    const res = await post("/admin/sql/task_items", {
      token: admin,
      body: {
        task_id: tarea.id,
        process_definition_template_id: 1, // exigido cuando origin_kind = process_defined
        template_artifact_id: 1,           // obligatorio ("Plantilla documental")
        start_date: "2026-01-01",       // obligatorio ("Inicio entregable")
        responsible_position_id: responsiblePositionId,
        // El indice unico uq_task_items_defined_target es (task, pdt, target_position, target_person):
        // cada entregable debe apuntar a SU puesto, o los dos colisionan.
        target_position_id: responsiblePositionId,
        origin_kind: "process_defined",
        sort_order: sortOrder,
        title: titulo,
      },
    });
    assert.ok(res.status < 400, `no pude crear el task_item: ${JSON.stringify(res.body)}`);
    const id = res.body?.insertId ?? res.body?.id;
    assert.ok(id, "sin id del task_item creado");
    return Number(id);
  };

  const mioId = await crearItem(FIXTURE.unitPositionId, "Mi entregable (test IDOR)", 90);
  const ajenoId = await crearItem(21, "Entregable de OTRA persona (test IDOR)", 91); // puesto de otra persona

  const usuario = await tokenFor("usuario"); // persona 3: dueña de `mio`, NO de `ajeno`

  // 1) El panel NO debe entregarle el entregable ajeno... pero SÍ el suyo.
  const panel = await get(`/users/${USUARIO_ID}/process-definitions/${DEFINITION_ID}/panel`, { token: usuario });
  const entregados = (panel.body?.tasks ?? []).flatMap((t) => t.items ?? []).map((i) => Number(i.id));
  assert.ok(
    !entregados.includes(ajenoId),
    `🔴 IDOR: el panel entregó el entregable ajeno ${ajenoId}. Items: ${JSON.stringify(entregados)}`
  );
  assert.ok(
    entregados.includes(mioId),
    `el usuario dejó de ver su PROPIO entregable ${mioId}: el guard se pasó de estricto. Items: ${JSON.stringify(entregados)}`
  );

  // 2) Y no debe poder pedir su fichero. Lo relevante es que NO sea 200: da igual 403 o 404
  //    (404 incluso es preferible, no revela que el recurso exista).
  const file = await get(
    `/users/${USUARIO_ID}/process-definitions/${DEFINITION_ID}/task-items/${ajenoId}/file`,
    { token: usuario }
  );
  assert.notEqual(file.status, 200, "🔴 IDOR: el usuario descargó el fichero del entregable de otra persona");
});
