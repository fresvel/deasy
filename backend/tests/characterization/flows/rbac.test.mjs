// Characterization: RBAC.
// Fija los rechazos por permiso y por propiedad (ownership) tal cual son hoy.
// Estos 403 son comportamiento que la migración/refactor NO debe alterar.

import { test, before } from "node:test";
import { get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "rbac";

before(async () => {
  await waitForReady();
});

test("usuario sin people.read -> GET /users -> 403", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/users", { token });
  matchSnapshot(SUITE, "usuario_list_users_denied", snapshotShape(res));
});

test("usuario accede a document-center ajeno (id admin=1) -> 403", async () => {
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
