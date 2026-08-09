// Characterization: MÁQUINA DE ESTADOS DE `fill_requests` — `sign_workflow_controller.js`.
//
// Por qué existe: es la tercera fila pendiente de la Fase D (§5-D del plan de calidad), la que se
// va a extraer a `FillRequestWorkflowService`, y hasta hoy tenía DOS aserciones sueltas en
// `zz_task_generation` (un 403 y un 409, sin golden). Las cinco acciones —start, approve, return,
// reject, cancel— comparten un único `updateFillRequestStatus` cuyo valor está casi todo en el
// ORDEN de sus guards. Mover eso sin red es cambiar contratos de error sin enterarse.
//
// EL ORDEN DE GUARDS QUE ESTE FICHERO CONGELA (de fuera hacia dentro):
//   1. `authMiddleware`                        -> 401  "Token requerido"
//   2. `requirePermissions("fill_flows.update")` -> 403 (NO alcanzable, ver limitaciones)
//   3. id de la solicitud no numérico o cero   -> 400  "Solicitud de entrega inválida."
//   4. la solicitud no existe                  -> 404  "Solicitud de entrega no encontrada."
//   5. el actor no es el asignado              -> 403  "No puedes operar una solicitud ... otro usuario."
//   6. sin responsable y no manual             -> 409  "...no tiene un responsable resoluble."
//   7. la transición no está permitida         -> 409  "La solicitud no puede pasar de X usando Y."
//   8. (solo approve) falta el PDF en working  -> 500  "El último paso ... requiere un PDF ..."
// El 404 va ANTES del 403: una solicitud inexistente y una ajena se distinguen por el código.
//
// ⚠️ PREFIJO "zzzz_" DELIBERADO, y este es el flow MÁS destructivo del harness. Corre el último de
// todos (después de `zzz_artifact_draft` y de `zzzz_sign_batch`) porque conduce la solicitud de
// entrega de la fixture hasta `approved`, lo que dispara la creación del flujo de firma y mueve el
// estado de la versión documental. Si corriera antes, movería los golden de `execution`,
// `user_workspace` y `tasks`. El `after` restaura las dos filas que esos golden leen, pero NO todo
// (ver `restoreFillRequestFixture` en lib/db.mjs): la posición es la garantía, el teardown es la red.
//
// DENTRO DEL FICHERO EL ORDEN TAMBIÉN IMPORTA: primero los guards que no mutan, luego las
// transiciones reversibles, y la aprobación —irreversible— la ÚLTIMA.
//
// LO QUE NO SE PUEDE CUBRIR (para que el siguiente sepa dónde va a ciegas):
//   · El 403 POR PERMISO. El rol base `Usuario` incluye `fill_flows.update`, y toda persona del
//     bootstrap lo tiene, así que ninguna identidad sembrada puede rebotar en ese middleware. El
//     403 que sí se fija aquí es el de PROPIEDAD, que vive dentro del controller.
//   · `reactivatePreviousFillStepIfNeeded` (devolver reactiva el paso ANTERIOR). Los flujos de la
//     fixture tienen UN solo paso, así que la rama `step_order > 1` nunca se ejecuta. Cubrirla
//     exigiría sembrar un flujo de entrega de dos pasos.
//
// ✅ DEFECTO 1, ARREGLADO EL 2026-08-09 (se deja escrito porque el método vale para los que quedan):
//   `return` estaba ROTO EN POSTGRESQL. `DocumentProgressService.syncDocumentProgressFromFillRequest`
//   ejecutaba un `UPDATE fill_requests fr INNER JOIN fill_flow_steps ...`, sintaxis multi-tabla de
//   MySQL que PostgreSQL no acepta: respondía 500 `syntax error at or near "INNER"` y deshacía la
//   transacción entera. Con un solo paso en el flujo la rama se tomaba SIEMPRE, así que "devolver un
//   entregable" no funcionaba para nadie. Residuo vivo de la migración desde MariaDB.
//   Lo destapó ESTA suite: nadie lo había visto porque ninguna prueba miraba ahí. Y había OTROS TRES
//   sitios con la misma sintaxis (`DocumentWorkflowResetService`, `templateLifecycle`,
//   `taskAssignment`), corregidos en el mismo commit.
//   El diff de los goldens `return_ok` / `return_efecto` (500 -> 200) fue la prueba del arreglo.
//
// ✅ DEFECTO 3, ARREGLADO EL 2026-08-09, junto con el corte de la fase D. Una solicitud sin
//   responsable resoluble respondía 500 a cualquier usuario autenticado. Hoy responde 409: no es un
//   fallo del servidor, es un conflicto con el estado del recurso (§4 de este fichero). Los goldens
//   pasaron a llamarse `sin_responsable_usuario` / `sin_responsable_gestor`.
//
// DEFECTOS CONGELADOS A PROPÓSITO (patrón §3.1.b: el diff del golden será la prueba del arreglo):
//   2. La regla de negocio "falta el PDF en working" sale como 500, no como 409/400.
//   4. Con `is_manual = 1` y sin responsable, CUALQUIER usuario con `fill_flows.update` se apropia
//      de la solicitud al iniciarla (el UPDATE le pone su propio id).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post, put } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { captureFillRequestFixture, restoreFillRequestFixture, closeDb } from "../lib/db.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "sign_workflow";

const ACCIONES = ["start", "approve", "return", "reject", "cancel"];

// Los ids de la capa de ejecución derivan entre reseeds; el resto del cuerpo (message, status,
// flowStatus) ES el contrato.
const OBJ_OPTS = { maskIdKeys: true };

// La solicitud de entrega de la persona "usuario", resuelta por su responsable (no por id: el
// autoincremento no es estable) — igual que hace zz_task_generation.
const USUARIO_ID = FIXTURE.usuarioPersonId;

let miSolicitud = null;
let estadoOriginal = null;

const ruta = (id, accion) => `/sign/fill-requests/${id}/${accion}`;

const listarSolicitudes = async () => {
  const admin = await tokenFor("admin");
  const res = await get("/admin/sql/fill_requests", { token: admin });
  return Array.isArray(res.body) ? res.body : res.body?.data ?? [];
};

// Reposiciona la solicitud en un estado de partida conocido. Va por el CRUD de admin (HTTP), no por
// SQL: es la misma vía que ya usa zz_task_generation para reasignar el responsable.
const ponerEnEstado = async (data) => {
  const admin = await tokenFor("admin");
  const res = await put("/admin/sql/fill_requests", {
    token: admin,
    body: { keys: { id: miSolicitud }, data },
  });
  assert.ok(
    res.status < 400,
    `no pude reposicionar la solicitud (${JSON.stringify(data)}): ${res.status} ${JSON.stringify(res.body)}`,
  );
};

const estadoActual = async () => {
  const filas = await listarSolicitudes();
  return filas.find((fila) => Number(fila.id) === Number(miSolicitud)) ?? null;
};

before(async () => {
  await waitForReady();
  const filas = await listarSolicitudes();
  const mia = filas.find((fila) => Number(fila.assigned_person_id) === USUARIO_ID);
  assert.ok(
    mia,
    "no hay ninguna solicitud de entrega de la persona usuario: ¿corrió setup/seed_execution.mjs?",
  );
  miSolicitud = Number(mia.id);
  estadoOriginal = await captureFillRequestFixture(miSolicitud);
  assert.ok(estadoOriginal, "no pude capturar el estado inicial de la solicitud");
});

after(async () => {
  await restoreFillRequestFixture(estadoOriginal);
  await closeDb();
});

// ─── 1. Guards que NO mutan ─────────────────────────────────────────────────────────────────────

for (const accion of ACCIONES) {
  test(`POST /sign/fill-requests/:id/${accion} sin token -> 401`, async () => {
    const res = await post(ruta(1, accion));
    assert.equal(res.status, 401, `la acción ${accion} debe exigir token`);
    matchSnapshot(SUITE, `sin_token_${accion}`, snapshotShape(res, OBJ_OPTS));
  });
}

for (const accion of ACCIONES) {
  test(`POST .../${accion} con id no numérico -> 400 (antes de tocar la base)`, async () => {
    const token = await tokenFor("usuario");
    const res = await post(ruta("abc", accion), { token });
    assert.equal(res.status, 400);
    matchSnapshot(SUITE, `id_no_numerico_${accion}`, snapshotShape(res, OBJ_OPTS));
  });
}

test("POST .../start con id 0 -> 400 (el cero cuenta como inválido)", async () => {
  const token = await tokenFor("usuario");
  const res = await post(ruta(0, "start"), { token });
  matchSnapshot(SUITE, "id_cero", snapshotShape(res, OBJ_OPTS));
});

for (const accion of ACCIONES) {
  test(`POST .../${accion} de una solicitud inexistente -> 404 (la existencia va ANTES que la propiedad)`, async () => {
    // Se pide con el ADMIN, que no es responsable de ninguna solicitud: si el guard de propiedad
    // corriera primero, esto saldría 403. Que salga 404 es el contrato.
    const token = await tokenFor("admin");
    const res = await post(ruta(999999, accion), { token });
    assert.equal(res.status, 404, `${accion} sobre una solicitud inexistente debe ser 404, no 403`);
    matchSnapshot(SUITE, `inexistente_${accion}`, snapshotShape(res, OBJ_OPTS));
  });
}

for (const accion of ACCIONES) {
  test(`POST .../${accion} de una solicitud AJENA -> 403`, async () => {
    const token = await tokenFor("admin");
    const res = await post(ruta(miSolicitud, accion), { token });
    assert.equal(res.status, 403, `${accion} sobre la solicitud de otro debe ser 403`);
    matchSnapshot(SUITE, `ajena_admin_${accion}`, snapshotShape(res, OBJ_OPTS));
  });
}

// Que el 403 es por PROPIEDAD y no por rol se demuestra con un segundo actor de rol distinto: el
// gestor tampoco puede, y recibe exactamente el mismo contrato.
test("POST .../start de una solicitud ajena, con el gestor -> 403 (es propiedad, no rol)", async () => {
  const token = await tokenFor("gestor");
  const res = await post(ruta(miSolicitud, "start"), { token });
  assert.equal(res.status, 403);
  matchSnapshot(SUITE, "ajena_gestor_start", snapshotShape(res, OBJ_OPTS));
});

// ─── 2. Transiciones válidas e inválidas, conducidas por el responsable ─────────────────────────

test("pending -> start -> 200 in_progress", async () => {
  await ponerEnEstado({ status: "pending", responded_at: null, response_note: null });
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "start"), { token });
  assert.equal(res.status, 200, `start desde pending debe funcionar: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "start_ok", snapshotShape(res, OBJ_OPTS));
});

test("in_progress -> start -> 409 (no 500): la transición no existe", async () => {
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "start"), { token });
  assert.equal(res.status, 409);
  // El mensaje NOMBRA el estado y la acción: es contrato para el frontend, no texto decorativo.
  matchSnapshot(SUITE, "start_repetido_409", snapshotShape(res, OBJ_OPTS));
});

// ✅ Antes DEFECTO 1 (arreglado el 2026-08-09). `syncDocumentProgressFromFillRequest` usaba
// `UPDATE ... INNER JOIN ... SET`, multi-tabla de MySQL, y PostgreSQL respondía 500
// `syntax error at or near "INNER"`. El diff de estos dos goldens (500 -> 200) FUE la prueba del
// arreglo. Ahora sí hay `assert`: el contrato dejó de ser "revienta" y pasó a ser observable.
test("in_progress -> return con motivo -> 200", async () => {
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "return"), {
    token,
    body: { note: "faltan datos en el formulario" },
  });
  assert.equal(res.status, 200);
  matchSnapshot(SUITE, "return_ok", snapshotShape(res, OBJ_OPTS));
});

// Devolver NO deja la solicitud en `returned`: con un flujo de UN paso, la reactivación de
// `syncDocumentProgressFromFillRequest` la devuelve a `pending` para que se pueda rehacer. Esa es
// justo la rama que el defecto impedía ejecutar, así que aquí es donde se ve que funciona.
test("tras el return, el paso se reactiva y el motivo queda guardado", async () => {
  const fila = await estadoActual();
  matchSnapshot(SUITE, "return_efecto", {
    status: fila?.status ?? null,
    response_note: fila?.response_note ?? null,
  });
});

test("in_progress -> reject con motivo -> 200 rejected (flowStatus=rejected)", async () => {
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "reject"), {
    token,
    body: { note: "el entregable no corresponde" },
  });
  assert.equal(res.status, 200, `reject desde in_progress debe funcionar: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "reject_ok", snapshotShape(res, OBJ_OPTS));
});

for (const accion of ACCIONES) {
  test(`rejected -> ${accion} -> 409 (estado terminal para las cinco acciones)`, async () => {
    const token = await tokenFor("usuario");
    const res = await post(ruta(miSolicitud, accion), { token });
    assert.equal(res.status, 409, `desde rejected, ${accion} debe ser 409`);
    matchSnapshot(SUITE, `terminal_rejected_${accion}`, snapshotShape(res, OBJ_OPTS));
  });
}

test("pending -> cancel -> 200 cancelled (y el flujo del documento vuelve a pending)", async () => {
  await ponerEnEstado({ status: "pending", responded_at: null, response_note: null });
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "cancel"), { token });
  assert.equal(res.status, 200, `cancel desde pending debe funcionar: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "cancel_ok", snapshotShape(res, OBJ_OPTS));
});

test("cancelled -> approve -> 409 (cancelar también es terminal)", async () => {
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "approve"), { token });
  assert.equal(res.status, 409);
  matchSnapshot(SUITE, "terminal_cancelled_approve", snapshotShape(res, OBJ_OPTS));
});

// ─── 3. El guard propio de `approve` ────────────────────────────────────────────────────────────

// 🔴 DEFECTO 2 — regla de negocio devuelta como error de servidor. Sin `assert`: el golden manda.
test("approve del último paso sin PDF en working -> 500 (DEFECTO: debería ser 409/400)", async () => {
  await ponerEnEstado({ status: "pending", responded_at: null, response_note: null });
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "approve"), { token });
  matchSnapshot(SUITE, "defecto_approve_sin_pdf", snapshotShape(res, OBJ_OPTS));
});

test("el approve fallido no cambió el estado de la solicitud", async () => {
  const fila = await estadoActual();
  matchSnapshot(SUITE, "approve_sin_pdf_rollback", { status: fila?.status ?? null });
});

// ─── 4. Solicitudes sin responsable resoluble ───────────────────────────────────────────────────

// ✅ Antes DEFECTO 3 (arreglado el 2026-08-09, con el corte a `FillRequestWorkflowService`).
// Con `assigned_person_id` NULL no hay a quién comparar, así que el guard de propiedad no puede
// pronunciarse... y la condición salía como 500. No lo es: la petición está bien formada y el
// servidor está sano; lo que pasa es que la solicitud está mal configurada. Ahora es 409, el mismo
// código que la transición ilegal de justo debajo. El diff de estos dos goldens (500 -> 409, y las
// claves renombradas de `defecto_sin_responsable_*` a `sin_responsable_*`) ES la prueba.
// Sigue fijándose con DOS actores: el 409 no distingue quién pregunta, y eso es deliberado —la
// existencia de la solicitud ya la revela el par 404/403 de la sección 1, así que responder lo
// mismo a los dos no filtra nada nuevo.
test("sin responsable y sin modo manual -> 409 para el responsable original", async () => {
  await ponerEnEstado({ assigned_person_id: null, status: "pending" });
  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "start"), { token });
  assert.equal(res.status, 409, "una solicitud sin responsable es un conflicto de estado, no un 500");
  matchSnapshot(SUITE, "sin_responsable_usuario", snapshotShape(res, OBJ_OPTS));
});

test("sin responsable y sin modo manual -> el MISMO 409 para un tercero (no hay guard de propiedad)", async () => {
  const token = await tokenFor("gestor");
  const res = await post(ruta(miSolicitud, "start"), { token });
  assert.equal(res.status, 409);
  matchSnapshot(SUITE, "sin_responsable_gestor", snapshotShape(res, OBJ_OPTS));
});

// 🔴 DEFECTO 4 — la solicitud manual se la queda quien la inicie. Es el comportamiento buscado para
// pasos "manuales", pero hoy no hay ninguna restricción de quién puede reclamarlos.
test("sin responsable pero manual -> un tercero la INICIA y se la auto-asigna", async () => {
  await ponerEnEstado({ assigned_person_id: null, status: "pending", is_manual: 1 });
  const token = await tokenFor("gestor");
  const res = await post(ruta(miSolicitud, "start"), { token });
  assert.equal(res.status, 200, `manual + sin responsable debe permitir el auto-reclamo: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "manual_autoasignacion", snapshotShape(res, OBJ_OPTS));
});

test("tras el auto-reclamo, el responsable de la solicitud es quien la inició", async () => {
  const fila = await estadoActual();
  matchSnapshot(SUITE, "manual_autoasignacion_efecto", {
    reclamada_por_el_gestor: Number(fila?.assigned_person_id) === FIXTURE.gestorPersonId,
    status: fila?.status ?? null,
  });
});

// ─── 5. La aprobación real: IRREVERSIBLE, va la última ──────────────────────────────────────────

test("con PDF en working, el responsable aprueba -> 200 approved (flowStatus=approved)", async () => {
  const admin = await tokenFor("admin");
  await ponerEnEstado({
    assigned_person_id: USUARIO_ID,
    is_manual: 0,
    status: "pending",
    responded_at: null,
    response_note: null,
  });
  // El guard de `approve` mira la EXTENSIÓN de `working_file_path`, no que el objeto exista en
  // MinIO: basta con que termine en .pdf. Ese es el contrato, y es más laxo de lo que parece.
  const dv = await put("/admin/sql/document_versions", {
    token: admin,
    body: {
      keys: { id: estadoOriginal.document_version_id },
      data: { working_file_path: "Unidades/characterization/entregable.pdf" },
    },
  });
  assert.ok(dv.status < 400, `no pude poner el PDF en working: ${dv.status} ${JSON.stringify(dv.body)}`);

  const token = await tokenFor("usuario");
  const res = await post(ruta(miSolicitud, "approve"), { token });
  assert.equal(res.status, 200, `approve con PDF debe funcionar: ${JSON.stringify(res.body)}`);
  matchSnapshot(SUITE, "approve_ok", snapshotShape(res, OBJ_OPTS));
});

for (const accion of ACCIONES) {
  test(`approved -> ${accion} -> 409 (aprobar cierra la solicitud)`, async () => {
    const token = await tokenFor("usuario");
    const res = await post(ruta(miSolicitud, accion), { token });
    assert.equal(res.status, 409, `desde approved, ${accion} debe ser 409`);
    matchSnapshot(SUITE, `terminal_approved_${accion}`, snapshotShape(res, OBJ_OPTS));
  });
}
