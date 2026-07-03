// Characterization: RBAC.
// Fija rechazos por permiso y por propiedad (ownership) tal cual son hoy.
// Estos 403 son comportamiento que la migración/refactor NO debe alterar.
//
// NOTA de acoplamiento con el setup: setup/seed_execution.mjs asigna a la
// persona "usuario" (id 3) un puesto que le confiere el rol
// GestorEjecucionProcesos (gana people.read, documents.*, process_execution.*,
// etc.). Por eso las denegaciones se fijan sobre el LÍMITE admin — permisos que
// ni el usuario base ni el GestorEjecucionProcesos tienen (people.create,
// process_definitions.create) — de modo que el 403 es estable corra o no el
// setup. (Con datos: el middleware de permisos responde antes que el
// controlador, así que el body {} no dispara validación.)

import { test, before } from "node:test";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "rbac";

before(async () => {
  await waitForReady();
});

test("usuario sin people.create -> POST /admin/perfil -> 403", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/admin/perfil", { token, body: {} });
  matchSnapshot(SUITE, "usuario_people_create_denied", snapshotShape(res));
});

test("usuario sin process_definitions.create -> POST /admin/process -> 403", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/admin/process", { token, body: {} });
  matchSnapshot(SUITE, "usuario_process_create_denied", snapshotShape(res));
});

test("usuario accede a document-center ajeno (id admin=1) -> 403 (ownership)", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/users/1/document-center", { token });
  matchSnapshot(SUITE, "usuario_others_document_center_denied", snapshotShape(res));
});

test("sin token en ruta protegida -> 401 token requerido", async () => {
  const res = await get("/users");
  matchSnapshot(SUITE, "no_token_denied", snapshotShape(res));
});

// Caso positivo: el admin SÍ pasa el gate. Fijamos solo el status para no atar
// el golden a la lista completa de personas (eso lo cubre processes/tasks).
test("admin con people.read -> GET /users -> 200", async () => {
  const token = await tokenFor("admin");
  const res = await get("/users", { token });
  matchSnapshot(SUITE, "admin_list_users_status", { status: res.status });
});
