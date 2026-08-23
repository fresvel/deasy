// Contrato HTTP del ACCESO A UN ENTREGABLE, por el camino de las observaciones.
//
// ── Por qué nace este fichero (2026-08-22) ─────────────────────────────────────────────────
// Al unificar el conjunto de participantes (paso P2) se midió que **la caracterización no
// tocaba NI UNO de los cuatro endpoints que usan `getAccessibleTaskItemForUser`**: cero
// menciones de `observations` y cero de `can_add` en toda la suite. El guard más sensible del
// sistema —el que lleva dentro el arreglo del IDOR— no tenía contrato HTTP que lo fijara.
//
// Y se comprobó por mutación: relajar el predicado del IDOR dejaba la suite en **291/291
// verde**. El golden del IDOR que ya existe (`zz_task_generation`) protege el PANEL y el
// FICHERO, que van por otras dos copias del predicado. Este fichero cubre la tercera.
//
// ── Qué fija ───────────────────────────────────────────────────────────────────────────────
//  1. El dueño de un entregable lee sus observaciones y puede añadir.
//  2. El entregable de OTRA persona de la MISMA tarea responde 404 — no 403, que confirmaría
//     que existe (mismo criterio que el defecto 1.4).
//  3. Añadir una observación al entregable ajeno tampoco pasa.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { FIXTURE } from "../config.mjs";

const SUITE = "deliverable_access";
const DEFINITION_ID = FIXTURE.definitionId;
const USUARIO_ID = FIXTURE.usuarioPersonId;
const OBJ_OPTS = { maskIdKeys: true, extraMask: ["created_at", "resolved_at"] };

before(async () => {
  await waitForReady();
});

// Los dos entregables que `zz_task_generation` construye en la MISMA tarea del sistema: uno de
// la persona 3 y otro del puesto 21. Se localizan por título para no depender de ids.
const buscarItems = async () => {
  const admin = await tokenFor("admin");
  const res = await get("/admin/sql/task_items", { token: admin });
  const filas = Array.isArray(res.body) ? res.body : res.body?.data ?? [];
  const mio = filas.find((r) => String(r.title || "").includes("Mi entregable (test IDOR)"));
  const ajeno = filas.find((r) => String(r.title || "").includes("Entregable de OTRA persona"));
  return { mio, ajeno };
};

test("acceso · el dueño LEE las observaciones de su entregable", async () => {
  const { mio } = await buscarItems();
  assert.ok(mio, "no está el entregable del test de IDOR: ¿corrió zz_task_generation?");

  const usuario = await tokenFor("usuario");
  const res = await get(
    `/users/${USUARIO_ID}/process-definitions/${DEFINITION_ID}/task-items/${mio.id}/observations`,
    { token: usuario }
  );
  assert.equal(res.status, 200, `esperaba 200 y vino ${res.status}`);
  await matchSnapshot(SUITE, "observaciones_propias", snapshotShape(res, OBJ_OPTS));
});

test("acceso · IDOR: las observaciones del entregable AJENO responden 404, no 403", async () => {
  // 404 y no 403 a propósito: un 403 confirmaría que el recurso existe.
  const { ajeno } = await buscarItems();
  assert.ok(ajeno, "no está el entregable ajeno del test de IDOR");

  const usuario = await tokenFor("usuario");
  const res = await get(
    `/users/${USUARIO_ID}/process-definitions/${DEFINITION_ID}/task-items/${ajeno.id}/observations`,
    { token: usuario }
  );
  assert.equal(res.status, 404, `🔴 IDOR por observaciones: vino ${res.status}`);
});

test("acceso · IDOR: tampoco se puede AÑADIR una observación al entregable ajeno", async () => {
  const { ajeno } = await buscarItems();
  const usuario = await tokenFor("usuario");
  const res = await post(
    `/users/${USUARIO_ID}/process-definitions/${DEFINITION_ID}/task-items/${ajeno.id}/observations`,
    { token: usuario, body: { message: "no debería poder", phase: "fill", kind: "comment" } }
  );
  assert.ok(res.status >= 400, `🔴 IDOR de escritura: vino ${res.status}`);
  assert.notEqual(res.status, 500, "un guard no debe salir por 500");
});
