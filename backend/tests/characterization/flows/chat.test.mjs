// Characterization: chat / notificaciones.
//
// El setup crea una conversación de grupo (admin + usuario) con un mensaje, lo
// que materializa conversación + mensaje + notificación. Este golden fija ese
// comportamiento observable — es la RED DE SEGURIDAD para migrar el chat de
// MongoDB a PostgreSQL relacional: el mismo golden debe pasar antes (Mongo) y
// después (SQL).
//
// Se enmascaran los ids opacos (Mongo ObjectId hoy / enteros tras migrar) con
// maskIdKeys, pero se CONSERVAN los person_id (deterministas, del seed) y el
// contenido/título/tipo, que es lo que de verdad fija la conducta.

import { test, before } from "node:test";
import { get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "chat";
// Conserva las referencias a personas (deterministas) y enmascara ids opacos.
const CHAT_OPTS = {
  maskIdKeys: true,
  keep: ["person_id", "recipient_person_id", "sender_person_id", "created_by"],
};

before(async () => {
  await waitForReady();
});

test("GET /chat/conversations (admin, creador) -> conversación con mensaje", async () => {
  const token = await tokenFor("admin");
  const res = await get("/chat/conversations", { token });
  matchSnapshot(SUITE, "conversations_admin", snapshotShape(res, CHAT_OPTS));
});

test("GET /chat/conversations (usuario, participante) -> misma conversación", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/chat/conversations", { token });
  matchSnapshot(SUITE, "conversations_usuario", snapshotShape(res, CHAT_OPTS));
});

test("GET /chat/conversations/:id/messages -> el mensaje sembrado", async () => {
  const token = await tokenFor("admin");
  const list = await get("/chat/conversations", { token });
  const conversationId = list.body?.data?.[0]?.id;
  if (!conversationId) throw new Error("no hay conversación: ¿corriste el setup?");
  const res = await get(`/chat/conversations/${conversationId}/messages`, { token });
  matchSnapshot(SUITE, "messages_admin", snapshotShape(res, CHAT_OPTS));
});

test("GET /chat/notifications (usuario) -> notificación del mensaje", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/chat/notifications", { token });
  matchSnapshot(SUITE, "notifications_usuario", snapshotShape(res, CHAT_OPTS));
});

test("GET /chat/conversations sin token -> 401", async () => {
  const res = await get("/chat/conversations");
  matchSnapshot(SUITE, "conversations_no_token", snapshotShape(res));
});
