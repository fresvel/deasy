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
import { get, post } from "../lib/http.mjs";
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

// --- Flujo de MARCAR LEÍDO (mutación) — va DESPUÉS de los tests que dependen
//     del estado no-leído (unread=1, notif sin leer). Determinista porque los
//     tests de un mismo archivo corren en orden y el setup recrea el estado. ---

test("POST /chat/conversations/:id/read (usuario) -> marca la conversación leída", async () => {
  const token = await tokenFor("usuario");
  const list = await get("/chat/conversations", { token });
  const conversationId = list.body?.data?.[0]?.id;
  if (!conversationId) throw new Error("no hay conversación: ¿corriste el setup?");
  const res = await post(`/chat/conversations/${conversationId}/read`, { token });
  matchSnapshot(SUITE, "mark_conversation_read", snapshotShape(res, CHAT_OPTS));
});

test("GET /chat/conversations (usuario) tras marcar leído -> unread_count 0", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/chat/conversations", { token });
  matchSnapshot(SUITE, "conversations_usuario_after_read", snapshotShape(res, CHAT_OPTS));
});

test("POST /chat/notifications/read (usuario) -> notificación marcada leída", async () => {
  const token = await tokenFor("usuario");
  const list = await get("/chat/notifications", { token });
  const notificationId = list.body?.data?.[0]?.id;
  if (!notificationId) throw new Error("no hay notificación: ¿corriste el setup?");
  const res = await post("/chat/notifications/read", {
    token,
    body: { notification_ids: [notificationId] },
  });
  matchSnapshot(SUITE, "mark_notifications_read", snapshotShape(res, CHAT_OPTS));
});

// --- Process thread (el tipo más complejo: scope + stable_key + participantes
//     derivados del contexto del proceso). Va AL FINAL porque crea una nueva
//     conversación; idempotente por stable_key (setup limpia entre corridas). ---

test("GET /chat/processes/:id/thread antes de crear -> 404 con contexto", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/chat/processes/1/thread?scope_unit_id=16", { token });
  matchSnapshot(SUITE, "process_thread_missing", snapshotShape(res, CHAT_OPTS));
});

test("POST /chat/processes/:id/thread -> crea el process_thread con scope", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/chat/processes/1/thread?scope_unit_id=16", { token, body: {} });
  matchSnapshot(SUITE, "process_thread_created", snapshotShape(res, CHAT_OPTS));
});
