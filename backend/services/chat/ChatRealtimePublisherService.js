import realtimeGateway from "../realtime/RealtimeGateway.js";
import { logChatInfo } from "./chat_logging.js";

/**
 * Publica eventos de chat en tiempo real a través del gateway de WebSockets
 * (Socket.IO). Sustituye al antiguo broker EMQX: los topics MQTT se mapean a
 * rooms de Socket.IO (conversation:{id}, user:{id}, process:{id}).
 *
 * Se conserva la firma pública `publishMessageCreated(payload)` y su retorno
 * `{ published, publications }` para no tocar a quienes lo consumen
 * (controllers/chat/chat_controller.js).
 */
export default class ChatRealtimePublisherService {
  constructor(gateway = realtimeGateway) {
    this.gateway = gateway;
    this.enabled = String(process.env.CHAT_REALTIME_ENABLED || "true").trim().toLowerCase() !== "false";
  }

  async publishMessageCreated(payload) {
    if (!this.enabled) {
      return { published: false, reason: "disabled_by_env" };
    }

    if (!this.gateway?.isReady?.()) {
      return { published: false, reason: "gateway_not_ready" };
    }

    const conversationId = payload?.conversation?.id;
    const messageId = payload?.message?.id;
    if (!conversationId || !messageId) {
      return { published: false, reason: "missing_message_context" };
    }

    const publications = [];
    const envelope = {
      event: "chat.message.created",
      conversation: payload.conversation,
      message: payload.message,
      recipient_person_ids: payload.recipient_person_ids || []
    };

    // Hilo de la conversación.
    this.gateway.emitToConversation(conversationId, "chat.message.created", envelope);
    publications.push({ room: `conversation:${conversationId}`, event: "chat.message.created" });

    // Notificación dirigida a cada destinatario (room user:{personId}).
    const uniqueRecipientIds = Array.from(
      new Set(
        (payload.recipient_person_ids || [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );

    for (const recipientPersonId of uniqueRecipientIds) {
      this.gateway.emitToUser(recipientPersonId, "chat.notification.created", {
        event: "chat.notification.created",
        conversation_id: conversationId,
        message_id: messageId,
        recipient_person_id: recipientPersonId,
        title: payload?.conversation?.title || "Chat del proceso",
        body: payload?.message?.content || "Nuevo mensaje"
      });
      publications.push({ room: `user:${recipientPersonId}`, event: "chat.notification.created" });
    }

    // Thread del proceso, si la conversación está ligada a uno.
    const processId = Number(
      payload?.conversation?.scope?.process_id
      || payload?.conversation?.process_id
      || 0
    );
    if (processId > 0) {
      this.gateway.emitToProcess(processId, "chat.message.created", envelope);
      publications.push({ room: `process:${processId}`, event: "chat.message.created" });
    }

    logChatInfo("chat.realtime.published", {
      conversation_id: conversationId,
      message_id: messageId,
      publications_count: publications.length
    });

    return {
      published: true,
      publications
    };
  }
}
