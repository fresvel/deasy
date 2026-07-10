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

// --- Política de contraseñas en el registro (POST /users, middleware) ---------
// Fija el contrato de RECHAZO a nivel HTTP: solo casos que NO crean usuario (400),
// así el golden es determinista y no ensucia la fixture. Blinda la política tras
// unificarla en utils/passwordPolicy.js.
const REGISTER_BASE = { cedula: "9999999998", first_name: "T", last_name: "T", email: "policy@t.co" };

test("POST /users con contraseña de 1 criterio -> 400 política", async () => {
  const res = await post("/users", { body: { ...REGISTER_BASE, password: "abc" } });
  matchSnapshot(SUITE, "register_password_1_criterion", snapshotShape(res));
});

test("POST /users con contraseña de 2 criterios -> 400 política", async () => {
  const res = await post("/users", { body: { ...REGISTER_BASE, password: "abcdefgh" } });
  matchSnapshot(SUITE, "register_password_2_criteria", snapshotShape(res));
});

test("POST /users solo con caracteres especiales -> 400 (special no cuenta)", async () => {
  const res = await post("/users", { body: { ...REGISTER_BASE, password: "!@#$%^&*" } });
  matchSnapshot(SUITE, "register_password_only_special", snapshotShape(res));
});
