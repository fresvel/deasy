import mongoose from "mongoose";
import { ChatNotification } from "../../models/chat/notification_model.js";

const toNotificationSummary = (notification) => ({
  id: notification._id.toString(),
  recipient_person_id: Number(notification.recipient_person_id),
  type: notification.type,
  title: notification.title,
  body: notification.body,
  entity_type: notification.entity_type,
  entity_id: notification.entity_id,
  conversation_id: notification.conversation_id ? notification.conversation_id.toString() : null,
  message_id: notification.message_id ? notification.message_id.toString() : null,
  channel: notification.channel,
  created_at: notification.created_at,
  read_at: notification.read_at
});

export default class ChatNotificationService {
  buildMessageNotificationTitle(conversation) {
    const title = String(conversation?.title || "").trim();
    return title ? `Nuevo mensaje en ${title}` : "Nuevo mensaje en el chat";
  }

  buildMessageNotificationBody(message) {
    const content = String(message?.content || "").trim();
    if (content) {
      return content.slice(0, 180);
    }
    return "Se ha enviado un nuevo mensaje.";
  }

  async listForRecipient(personId, { limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const notifications = await ChatNotification.find({
      recipient_person_id: Number(personId)
    })
      .sort({ created_at: -1 })
      .limit(safeLimit);

    return notifications.map(toNotificationSummary);
  }

  async createForMessage({ conversation, message, recipientPersonIds = [] } = {}) {
    const normalizedRecipientIds = Array.from(
      new Set(
        recipientPersonIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );

    if (!conversation?.id || !message?.id || !normalizedRecipientIds.length) {
      return [];
    }

    const createdNotifications = await ChatNotification.insertMany(
      normalizedRecipientIds.map((recipientPersonId) => ({
        recipient_person_id: recipientPersonId,
        type: "chat.message.created",
        title: this.buildMessageNotificationTitle(conversation),
        body: this.buildMessageNotificationBody(message),
        entity_type: "conversation",
        entity_id: String(conversation.id),
        conversation_id: new mongoose.Types.ObjectId(conversation.id),
        message_id: new mongoose.Types.ObjectId(message.id),
        channel: "in_app",
        read_at: null
      }))
    );

    return createdNotifications.map(toNotificationSummary);
  }

  async markRead(personId, ids = []) {
    const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!objectIds.length) {
      const error = new Error("No se recibieron notificaciones válidas para actualizar.");
      error.status = 400;
      throw error;
    }

    const readAt = new Date();
    await ChatNotification.updateMany(
      {
        _id: { $in: objectIds },
        recipient_person_id: Number(personId),
        read_at: null
      },
      {
        $set: { read_at: readAt }
      }
    );

    const notifications = await ChatNotification.find({
      _id: { $in: objectIds },
      recipient_person_id: Number(personId)
    }).sort({ created_at: -1 });

    return notifications.map(toNotificationSummary);
  }

  async markConversationRead(personId, conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }

    const readAt = new Date();
    await ChatNotification.updateMany(
      {
        recipient_person_id: Number(personId),
        conversation_id: new mongoose.Types.ObjectId(conversationId),
        read_at: null
      },
      {
        $set: { read_at: readAt }
      }
    );

    const notifications = await ChatNotification.find({
      recipient_person_id: Number(personId),
      conversation_id: new mongoose.Types.ObjectId(conversationId)
    }).sort({ created_at: -1 });

    return notifications.map(toNotificationSummary);
  }
}
