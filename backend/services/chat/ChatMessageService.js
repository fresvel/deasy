import mongoose from "mongoose";
import { ChatConversation } from "../../models/chat/conversation_model.js";
import { ChatMessage } from "../../models/chat/message_model.js";
import { logChatInfo } from "./chat_logging.js";

const toMessageSummary = (message) => ({
  id: message._id.toString(),
  conversation_id: message.conversation_id.toString(),
  sender_person_id: Number(message.sender_person_id),
  content: message.content,
  content_type: message.content_type,
  attachments: Array.isArray(message.attachments) ? message.attachments : [],
  reply_to_message_id: message.reply_to_message_id ? message.reply_to_message_id.toString() : null,
  created_at: message.created_at,
  edited_at: message.edited_at,
  deleted_at: message.deleted_at,
  read_by: Array.isArray(message.read_by) ? message.read_by.map(Number) : [],
  delivery_state: message.delivery_state
});

const getActiveParticipantIds = (conversation) =>
  Array.isArray(conversation?.participants)
    ? conversation.participants
        .filter((participant) => participant && participant.left_at === null)
        .map((participant) => Number(participant.person_id))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

export default class ChatMessageService {
  async listForConversation(conversationId, personId, { limit = 30, before = null } = {}) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      participants: {
        $elemMatch: {
          person_id: Number(personId),
          left_at: null
        }
      }
    }).select("_id");

    if (!conversation) {
      const error = new Error("Conversación no encontrada o no autorizada.");
      error.status = 404;
      throw error;
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const query = {
      conversation_id: conversation._id
    };

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        query.created_at = { $lt: beforeDate };
      }
    }

    const messages = await ChatMessage.find(query)
      .sort({ created_at: -1 })
      .limit(safeLimit);

    return messages.reverse().map(toMessageSummary);
  }

  async createMessage(conversationId, personId, payload = {}) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      participants: {
        $elemMatch: {
          person_id: Number(personId),
          left_at: null
        }
      }
    });

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

    const message = await ChatMessage.create({
      conversation_id: conversation._id,
      sender_person_id: Number(personId),
      content,
      content_type: attachments.length ? "attachment" : (payload.content_type || "text"),
      attachments,
      reply_to_message_id: payload.reply_to_message_id || null,
      read_by: [Number(personId)],
      delivery_state: "stored"
    });

    conversation.last_message_id = message._id;
    conversation.last_message_at = message.created_at;
    conversation.mobile_summary = content || (attachments[0]?.filename ?? "Adjunto");
    await conversation.save();

    const activeParticipantIds = getActiveParticipantIds(conversation);
    const recipientPersonIds = activeParticipantIds.filter((participantId) => participantId !== Number(personId));

    logChatInfo("chat.message.created", {
      conversation_id: conversation._id.toString(),
      message_id: message._id.toString(),
      process_id: Number(conversation.process_id || conversation.scope?.process_id || 0) || null,
      person_id: Number(personId),
      attachments_count: attachments.length
    });

    return {
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        type: conversation.type,
        scope: conversation.scope || null,
        last_message_id: message._id.toString(),
        last_message_at: message.created_at,
        mobile_summary: conversation.mobile_summary
      },
      message: toMessageSummary(message),
      recipient_person_ids: recipientPersonIds
    };
  }

  async markConversationRead(conversationId, personId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      participants: {
        $elemMatch: {
          person_id: Number(personId),
          left_at: null
        }
      }
    }).select("_id");

    if (!conversation) {
      const error = new Error("Conversación no encontrada o no autorizada.");
      error.status = 404;
      throw error;
    }

    await ChatMessage.updateMany(
      {
        conversation_id: conversation._id,
        sender_person_id: { $ne: Number(personId) },
        read_by: { $ne: Number(personId) }
      },
      {
        $addToSet: {
          read_by: Number(personId)
        }
      }
    );

    const unreadCount = await ChatMessage.countDocuments({
      conversation_id: conversation._id,
      sender_person_id: { $ne: Number(personId) },
      read_by: { $ne: Number(personId) }
    });

    logChatInfo("chat.conversation.read", {
      conversation_id: conversation._id.toString(),
      person_id: Number(personId),
      unread_count: unreadCount
    });

    return {
      conversation_id: conversation._id.toString(),
      unread_count: unreadCount,
      read_at: new Date()
    };
  }
}
