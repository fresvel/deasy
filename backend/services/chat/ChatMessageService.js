import * as store from "./chatStore.js";
import { logChatInfo } from "./chat_logging.js";

export default class ChatMessageService {
  async listForConversation(conversationId, personId, { limit = 30, before = null } = {}) {
    if (!store.isValidId(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }
    const conversation = await store.findConversationForParticipant(conversationId, personId);
    if (!conversation) {
      const error = new Error("Conversación no encontrada o no autorizada.");
      error.status = 404;
      throw error;
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const rows = await store.listMessages(conversation.id, safeLimit, before);
    return store.mapMessages(rows.reverse());
  }

  async createMessage(conversationId, personId, payload = {}) {
    if (!store.isValidId(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }
    const conversation = await store.findConversationForParticipant(conversationId, personId);
    if (!conversation) {
      const error = new Error("Conversación no encontrada o no autorizada.");
      error.status = 404;
      throw error;
    }

    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    const content = String(payload.content || "").trim();
    if (!content && !attachments.length) {
      const error = new Error("El mensaje no puede estar vacío.");
      error.status = 400;
      throw error;
    }

    const replyTo = store.isValidId(payload.reply_to_message_id) ? Number(payload.reply_to_message_id) : null;
    const messageRow = await store.insertMessage({
      conversation_id: conversation.id,
      sender_person_id: Number(personId),
      content,
      content_type: attachments.length ? "attachment" : payload.content_type || "text",
      reply_to_message_id: replyTo,
      delivery_state: "stored",
    });
    await store.insertMessageReads(messageRow.id, [Number(personId)]);
    if (attachments.length) await store.insertAttachments(messageRow.id, attachments);

    const mobileSummary = content || (attachments[0]?.filename ?? "Adjunto");
    await store.updateConversation(conversation.id, {
      last_message_id: messageRow.id,
      last_message_at: messageRow.created_at,
      mobile_summary: mobileSummary,
    });

    const participantsMap = await store.loadParticipants([conversation.id]);
    const recipientPersonIds = (participantsMap.get(String(conversation.id)) || [])
      .filter((p) => p.left_at === null || p.left_at === undefined)
      .map((p) => Number(p.person_id))
      .filter((id) => Number.isFinite(id) && id > 0 && id !== Number(personId));

    logChatInfo("chat.message.created", {
      conversation_id: String(conversation.id),
      message_id: String(messageRow.id),
      process_id: Number(conversation.process_id || conversation.scope_process_id || 0) || null,
      person_id: Number(personId),
      attachments_count: attachments.length,
    });

    const [message] = await store.mapMessages([messageRow]);
    return {
      conversation: {
        id: String(conversation.id),
        title: conversation.title,
        type: conversation.type,
        scope: store.buildScope(conversation),
        last_message_id: String(messageRow.id),
        last_message_at: messageRow.created_at,
        mobile_summary: mobileSummary,
      },
      message,
      recipient_person_ids: recipientPersonIds,
    };
  }

  async markConversationRead(conversationId, personId) {
    if (!store.isValidId(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }
    const conversation = await store.findConversationForParticipant(conversationId, personId);
    if (!conversation) {
      const error = new Error("Conversación no encontrada o no autorizada.");
      error.status = 404;
      throw error;
    }

    const unread = await store.markConversationReadForPerson(conversation.id, personId);

    logChatInfo("chat.conversation.read", {
      conversation_id: String(conversation.id),
      person_id: Number(personId),
      unread_count: unread,
    });

    return {
      conversation_id: String(conversation.id),
      unread_count: unread,
      read_at: new Date(),
    };
  }
}
