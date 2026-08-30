// Characterization: autenticación.
// Fija el contrato observable del login y del "whoami" tal cual es hoy.

import { test, before } from "node:test";
import assert from "node:assert/strict";
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

// PUBLICO A PROPOSITO, como el catalogo geografico: lo consume el REGISTRO, que por definicion usa
// quien todavia no tiene cuenta. Se congela SIN token para que quede fijado que no lo pide.
//
// Este golden nacio de un fallo: el endpoint se estreno el 2026-08-29 y devolvia 500 —el servicio no
// tenia pool por defecto— con las 303 pruebas EN VERDE, porque ninguna lo miraba. Estrenar una ruta
// sin prueba es estrenarla sin red.
test("GET /system/institucion sin token -> el país del despliegue y el nombre local del documento", async () => {
  const res = await get("/system/institucion");
  matchSnapshot(SUITE, "institucion_publica", snapshotShape(res));
});

test("login admin OK -> { token, expiresIn, user }", async () => {
  const res = await post("/users/login", {
    body: { email: USERS.admin.email, password: USERS.admin.password },
  });
  matchSnapshot(SUITE, "login_admin_ok", snapshotShape(res, { extraMask: USER_MASK }));
});

test("login password incorrecta -> 401", async () => {
  const res = await post("/users/login", {
    body: { email: USERS.admin.email, password: "contraseña-incorrecta" },
  });
  matchSnapshot(SUITE, "login_bad_password", snapshotShape(res));
});

// LA CÉDULA YA NO ENTRA, y esto es lo que lo impide mañana.
//
// Hasta el 2026-08-29 el login aceptaba `{ cedula }` y resolvía `d.numero = ?` A SECAS, cuando la
// unicidad de un documento es (tipo, país, número): podía emparejar a la persona equivocada. Se
// quitó en vez de acotarse, porque el problema de fondo no era la unicidad sino la ESTABILIDAD —
// un pasaporte se renueva con número nuevo y quien entrara con él perdería su acceso.
//
// Sin este caso, devolver la rama sería un cambio silencioso: mandar `{ cedula }` daría 400 por
// "falta el correo" tanto si la rama existe como si no, y nadie se enteraría hasta que alguien
// entrara con el documento de otro.
// «OLVIDÉ MI CORREO»: público, y NO es un directorio de cédulas.
//
// «Recuérdame mi correo» y «no reveles quién está registrado» son opuestos: cualquier cosa que le
// diga a alguien su correo se lo dice también a quien pruebe con una cédula ajena — y en Ecuador el
// número de cédula es semipúblico. Por eso se pide la CONTRASEÑA: quien olvidó cuál de sus correos
// usó sigue sabiéndola, y quien tiene una cédula ajena no obtiene nada.
//
// Los dos goldens de abajo son el par que importa: el error de «no existe» y el de «contraseña
// incorrecta» tienen que ser IDÉNTICOS. Si algún día alguien "mejora" los mensajes distinguiéndolos,
// esto se cae — y con razón, porque reconstruiría el oráculo.
test("POST /users/recuperar-correo con la contraseña -> devuelve el correo completo", async () => {
  const res = await post("/users/recuperar-correo", {
    body: { numero: USERS.admin.cedula, password: USERS.admin.password },
  });
  matchSnapshot(SUITE, "recuperar_correo_ok", snapshotShape(res));
  assert.equal(res.body?.email, USERS.admin.email);
});

test("POST /users/recuperar-correo con la contraseña MAL -> error genérico", async () => {
  const res = await post("/users/recuperar-correo", {
    body: { numero: USERS.admin.cedula, password: "no-es-la-suya" },
  });
  matchSnapshot(SUITE, "recuperar_correo_clave_mala", snapshotShape(res));
  assert.equal(res.status, 401);
});

test("POST /users/recuperar-correo con un documento que NO existe -> el MISMO error", async () => {
  const res = await post("/users/recuperar-correo", {
    body: { numero: "1710034065", password: USERS.admin.password },
  });
  matchSnapshot(SUITE, "recuperar_correo_documento_desconocido", snapshotShape(res));
  // La comparación que da sentido a los tres casos: los dos fallos son indistinguibles.
  const claveMala = await post("/users/recuperar-correo", {
    body: { numero: USERS.admin.cedula, password: "no-es-la-suya" },
  });
  assert.equal(res.status, claveMala.status);
  assert.equal(res.body?.message, claveMala.body?.message);
});

test("POST /users/login con cédula -> ya no es una credencial", async () => {
  const res = await post("/users/login", {
    body: { cedula: USERS.admin.cedula, password: USERS.admin.password },
  });
  matchSnapshot(SUITE, "login_por_cedula_rechazado", snapshotShape(res));
  assert.equal(res.status, 400, "la cédula no puede abrir sesión");
  assert.equal(res.body?.token, undefined, "y desde luego no puede devolver un token");
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
