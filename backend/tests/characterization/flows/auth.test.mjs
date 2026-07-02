// Characterization: autenticación.
// Fija el contrato observable del login y del "whoami" tal cual es hoy.

import { test, before } from "node:test";
import { post, get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { USERS } from "../config.mjs";

const SUITE = "auth";
// El objeto user trae URLs prefirmadas y tokens de firma volátiles: enmascarar.
const USER_MASK = ["photoUrl", "signatureToken", "signatureMarker"];

before(async () => {
  await waitForReady();
});

test("login admin OK -> { token, expiresIn, user }", async () => {
  const res = await post("/users/login", {
    body: { cedula: USERS.admin.identifier, password: USERS.admin.password },
  });
  matchSnapshot(SUITE, "login_admin_ok", snapshotShape(res, { extraMask: USER_MASK }));
});

test("login password incorrecta -> 401", async () => {
  const res = await post("/users/login", {
    body: { cedula: USERS.admin.identifier, password: "contraseña-incorrecta" },
  });
  matchSnapshot(SUITE, "login_bad_password", snapshotShape(res));
});

test("login sin credenciales -> 400", async () => {
  const res = await post("/users/login", { body: {} });
  matchSnapshot(SUITE, "login_missing_fields", snapshotShape(res));
});

test("GET /users/me con token -> { result, user }", async () => {
  const token = await tokenFor("admin");
  const res = await get("/users/me", { token });
  matchSnapshot(SUITE, "me_admin", snapshotShape(res, { extraMask: USER_MASK }));
});

test("GET /users/me sin token -> 401 token requerido", async () => {
  const res = await get("/users/me");
  matchSnapshot(SUITE, "me_no_token", snapshotShape(res));
});
