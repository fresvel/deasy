// Characterization: procesos / unidades (definiciones).
// GETs de lectura estables. Fijamos huella estructural (contrato de columnas)
// porque son listas que salen de SQL directo — el objetivo es detectar si la
// migración a Postgres cambia qué campos se devuelven.

import { test, before } from "node:test";
import { get } from "../lib/http.mjs";
import { listFingerprint } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "processes";

before(async () => {
  await waitForReady();
});

// Nota: /program lista UNIDADES (pese al nombre) y hoy NO exige auth.
// Fijamos también esa ausencia de auth: si la migración la cambia, se nota.
test("GET /program -> lista de unidades (contrato de columnas)", async () => {
  const res = await get("/program");
  matchSnapshot(SUITE, "program_list", listFingerprint(res));
});

test("GET /program?is_active=1 -> filtro activo", async () => {
  const res = await get("/program?is_active=1");
  matchSnapshot(SUITE, "program_list_active", listFingerprint(res));
});
