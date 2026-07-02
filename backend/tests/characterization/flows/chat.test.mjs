// Characterization: chat / notificaciones (respaldado por MongoDB).
// CRÍTICO para la migración: estas colecciones se consolidan en Postgres, así
// que fijar su contrato actual es la garantía de que la consolidación no cambia
// lo que ve el cliente. Respuestas con sobre { data: [...] }.

import { test, before } from "node:test";
import { get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape, listFingerprint } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "chat";

before(async () => {
  await waitForReady();
});

test("GET /chat/conversations (usuario) -> { data:[...] } (contrato)", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/chat/conversations", { token });
  matchSnapshot(SUITE, "conversations_usuario", listFingerprint(res, { pick: "data" }));
});

test("GET /chat/notifications (usuario) -> { data:[...] } (contrato)", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/chat/notifications", { token });
  matchSnapshot(SUITE, "notifications_usuario", listFingerprint(res, { pick: "data" }));
});

test("GET /chat/conversations sin token -> 401", async () => {
  const res = await get("/chat/conversations");
  matchSnapshot(SUITE, "conversations_no_token", snapshotShape(res));
});
