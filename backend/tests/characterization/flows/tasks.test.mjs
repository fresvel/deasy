// Characterization: tareas.
// GET /tarea?usuario=<cedula> devuelve filas joineadas de tasks/assignments/
// process. Fijamos huella estructural (contrato de columnas del JOIN) — es de
// las consultas SQL más complejas y por tanto de las más sensibles a la
// migración de dialecto.

import { test, before } from "node:test";
import { get } from "../lib/http.mjs";
import { listFingerprint } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { USERS } from "../config.mjs";

const SUITE = "tasks";

before(async () => {
  await waitForReady();
});

test("GET /tarea?usuario=<gestor> -> tareas del usuario (contrato)", async () => {
  const res = await get(`/tarea?usuario=${USERS.gestor.identifier}`);
  matchSnapshot(SUITE, "tarea_gestor", listFingerprint(res));
});

test("GET /tarea sin usuario -> 400", async () => {
  const res = await get("/tarea");
  matchSnapshot(SUITE, "tarea_missing_usuario", { status: res.status });
});

test("GET /tarea?usuario=<inexistente> -> 404", async () => {
  const res = await get("/tarea?usuario=0000000000");
  matchSnapshot(SUITE, "tarea_unknown_usuario", { status: res.status });
});
