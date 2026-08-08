import * as store from "./chatStore.js";
import { logChatInfo } from "./chat_logging.js";

export default class ChatNotificationService {
  buildMessageNotificationTitle(conversation) {
    const title = String(conversation?.title || "").trim();
    return title ? `Nuevo mensaje en ${title}` : "Nuevo mensaje en el chat";
  }

  buildMessageNotificationBody(message) {
    const content = String(message?.content || "").trim();
    if (content) return content.slice(0, 180);
    return "Se ha enviado un nuevo mensaje.";
  }

  async listForRecipient(personId, { limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const rows = await store.listNotifications(personId, safeLimit);
    return rows.map((row) => store.mapNotification(row));
  }

  async createForMessage({ conversation, message, recipientPersonIds = [] } = {}) {
    const normalizedRecipientIds = Array.from(
      new Set(recipientPersonIds.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0))
    );

    if (!conversation?.id || !message?.id || !normalizedRecipientIds.length) {
      return [];
    }

    const created = [];
    for (const recipientPersonId of normalizedRecipientIds) {
      const row = await store.insertNotification({
        recipient_person_id: recipientPersonId,
        type: "chat.message.created",
        title: this.buildMessageNotificationTitle(conversation),
        body: this.buildMessageNotificationBody(message),
        entity_type: "conversation",
        entity_id: String(conversation.id),
        conversation_id: Number(conversation.id),
        message_id: Number(message.id),
        channel: "in_app",
        read_at: null,
      });
      created.push(row);
    }

    logChatInfo("chat.notification.created", {
      conversation_id: String(conversation.id),
      message_id: String(message.id),
      notifications_count: created.length,
    });

    return created.map((row) => store.mapNotification(row));
  }

  async markRead(personId, ids = []) {
    const validIds = ids.filter((id) => store.isValidId(id)).map((id) => Number(id));
    if (!validIds.length) {
      const error = new Error("No se recibieron notificaciones válidas para actualizar.");
      error.status = 400;
      throw error;
    }
    const rows = await store.markNotificationsRead(personId, validIds, new Date());
    return rows.map((row) => store.mapNotification(row));
  }

  async markConversationRead(personId, conversationId) {
    if (!store.isValidId(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }
    const rows = await store.markConversationNotificationsRead(personId, Number(conversationId), new Date());

    logChatInfo("chat.notification.read", {
      conversation_id: String(conversationId),
      person_id: Number(personId),
      notifications_count: rows.length,
    });

    return rows.map((row) => store.mapNotification(row));
  }
}
