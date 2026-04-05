import mongoose from "mongoose";
import { ChatConversation } from "../../models/chat/conversation_model.js";
import { ChatMessage } from "../../models/chat/message_model.js";
import { logChatInfo } from "./chat_logging.js";

const toParticipantSummary = (participant) => ({
  person_id: Number(participant.person_id),
  role: participant.role || "member",
  joined_at: participant.joined_at,
  left_at: participant.left_at
});

const toConversationSummary = (conversation, unreadCount = 0) => ({
  id: conversation._id.toString(),
  type: conversation.type,
  title: conversation.title,
  process_id: conversation.process_id,
  scope: conversation.scope || null,
  participants: Array.isArray(conversation.participants)
    ? conversation.participants.map(toParticipantSummary)
    : [],
  created_by: conversation.created_by,
  created_at: conversation.created_at,
  updated_at: conversation.updated_at,
  last_message_id: conversation.last_message_id ? conversation.last_message_id.toString() : null,
  last_message_at: conversation.last_message_at,
  archived_at: conversation.archived_at,
  mobile_summary: conversation.mobile_summary,
  unread_count: Number(unreadCount || 0)
});

export default class ChatConversationService {
  async resolveUnreadCount(conversationId, personId) {
    if (!personId) return 0;
    return ChatMessage.countDocuments({
      conversation_id: conversationId,
      sender_person_id: { $ne: Number(personId) },
      read_by: { $ne: Number(personId) }
    });
  }

  buildProcessThreadTitle({ processName = null, scopeUnitLabel = null } = {}) {
    const normalizedProcessName = String(processName || "").trim();
    const normalizedScopeUnitLabel = String(scopeUnitLabel || "").trim();
    if (normalizedProcessName && normalizedScopeUnitLabel) {
      return `${normalizedProcessName} · ${normalizedScopeUnitLabel}`;
    }
    return normalizedProcessName || normalizedScopeUnitLabel || "Chat del proceso";
  }

  async listForParticipant(personId, { limit = 20 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const conversations = await ChatConversation.find({
      participants: {
        $elemMatch: {
          person_id: Number(personId),
          left_at: null
        }
      }
    })
      .sort({ last_message_at: -1, updated_at: -1 })
      .limit(safeLimit);

    const summaries = await Promise.all(
      conversations.map(async (conversation) => {
        const unreadCount = await this.resolveUnreadCount(conversation._id, personId);
        return toConversationSummary(conversation, unreadCount);
      })
    );

    return summaries;
  }

  async getForParticipant(conversationId, personId) {
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

    const unreadCount = await this.resolveUnreadCount(conversation._id, personId);
    return toConversationSummary(conversation, unreadCount);
  }

  async createConversation({ type, title = null, participantIds = [], createdBy, processId = null }) {
    const normalizedParticipantIds = Array.from(
      new Set(
        participantIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );

    if (!normalizedParticipantIds.length) {
      const error = new Error("Debe existir al menos un participante.");
      error.status = 400;
      throw error;
    }

    if (!["direct", "group", "thread"].includes(type)) {
      const error = new Error("Tipo de conversación no válido.");
      error.status = 400;
      throw error;
    }

    if (type === "thread") {
      const error = new Error("Los threads ligados a proceso deben crearse por el endpoint canónico del proceso.");
      error.status = 400;
      throw error;
    }

    const conversation = await ChatConversation.create({
      type,
      title: title?.trim() || null,
      participants: normalizedParticipantIds.map((personId) => ({
        person_id: personId,
        role: personId === Number(createdBy) ? "owner" : "member",
        joined_at: new Date(),
        left_at: null
      })),
      process_id: processId ? Number(processId) : null,
      created_by: Number(createdBy),
      last_message_id: null,
      last_message_at: null,
      archived_at: null,
      mobile_summary: null
    });

    logChatInfo("chat.conversation.created", {
      conversation_id: conversation._id.toString(),
      type,
      process_id: Number(processId || 0) || null,
      person_id: Number(createdBy)
    });

    return toConversationSummary(conversation, 0);
  }

  async getProcessThread(processId, personId) {
    const safeProcessId = Number(processId);
    if (!Number.isFinite(safeProcessId) || safeProcessId <= 0) {
      const error = new Error("processId inválido.");
      error.status = 400;
      throw error;
    }

    const conversation = await ChatConversation.findOne({
      type: "thread",
      process_id: safeProcessId,
      participants: {
        $elemMatch: {
          person_id: Number(personId),
          left_at: null
        }
      }
    });

    if (!conversation) {
      const error = new Error("Thread del proceso no encontrado o no autorizado.");
      error.status = 404;
      throw error;
    }

    const unreadCount = await this.resolveUnreadCount(conversation._id, personId);
    return toConversationSummary(conversation, unreadCount);
  }

  async getByStableKeyForParticipant(stableKey, personId) {
    const conversation = await ChatConversation.findOne({
      "scope.stable_key": String(stableKey),
      participants: {
        $elemMatch: {
          person_id: Number(personId),
          left_at: null
        }
      }
    });

    if (!conversation) {
      return null;
    }

    const unreadCount = await this.resolveUnreadCount(conversation._id, personId);
    return toConversationSummary(conversation, unreadCount);
  }

  async getByStableKey(stableKey) {
    const conversation = await ChatConversation.findOne({
      "scope.stable_key": String(stableKey)
    });
    return conversation || null;
  }

  async createProcessThread({
    processId,
    scopeUnitId,
    stableKey,
    participantIds = [],
    adminIds = [],
    currentDefinitionId = null,
    originDefinitionId = null,
    createdBy,
    processName = null,
    scopeUnitLabel = null
  }) {
    const normalizedParticipantIds = Array.from(
      new Set(
        participantIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );

    if (!normalizedParticipantIds.length) {
      const error = new Error("No se pudieron resolver participantes para el thread del proceso.");
      error.status = 400;
      throw error;
    }

    const adminIdSet = new Set(
      adminIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    adminIdSet.add(Number(createdBy));

    const conversation = await ChatConversation.create({
      type: "process_thread",
      title: this.buildProcessThreadTitle({ processName, scopeUnitLabel }),
      participants: normalizedParticipantIds.map((personId) => ({
        person_id: personId,
        role: adminIdSet.has(personId) ? "admin" : "member",
        joined_at: new Date(),
        left_at: null
      })),
      process_id: Number(processId),
      scope: {
        process_id: Number(processId),
        scope_unit_id: Number(scopeUnitId),
        stable_key: String(stableKey),
        current_definition_id: currentDefinitionId ? Number(currentDefinitionId) : null,
        origin_definition_id: originDefinitionId ? Number(originDefinitionId) : null
      },
      created_by: Number(createdBy),
      last_message_id: null,
      last_message_at: null,
      archived_at: null,
      mobile_summary: null
    });

    logChatInfo("chat.process_thread.created", {
      conversation_id: conversation._id.toString(),
      process_id: Number(processId),
      scope_unit_id: Number(scopeUnitId),
      person_id: Number(createdBy)
    });

    return toConversationSummary(conversation, 0);
  }

  async syncProcessThread(conversationId, {
    participantIds = [],
    adminIds = [],
    currentDefinitionId = null,
    processName = null,
    scopeUnitLabel = null
  } = {}) {
    const conversation = await ChatConversation.findById(conversationId);
    if (!conversation) {
      const error = new Error("Conversación de proceso no encontrada.");
      error.status = 404;
      throw error;
    }

    const normalizedParticipantIds = Array.from(
      new Set(
        participantIds
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    );
    const adminIdSet = new Set(
      adminIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    );

    const existingByPersonId = new Map(
      (conversation.participants || []).map((participant) => [Number(participant.person_id), participant])
    );
    const nextParticipants = [];

    normalizedParticipantIds.forEach((personId) => {
      const existing = existingByPersonId.get(personId);
      nextParticipants.push({
        person_id: personId,
        role: adminIdSet.has(personId) ? "admin" : (existing?.role || "member"),
        joined_at: existing?.joined_at || new Date(),
        left_at: null
      });
    });

    conversation.participants = nextParticipants;
    conversation.title = this.buildProcessThreadTitle({ processName, scopeUnitLabel });
    conversation.scope = {
      ...conversation.scope,
      current_definition_id: currentDefinitionId ? Number(currentDefinitionId) : conversation.scope?.current_definition_id ?? null
    };
    await conversation.save();

    logChatInfo("chat.process_thread.synced", {
      conversation_id: conversation._id.toString(),
      process_id: Number(conversation.process_id || conversation.scope?.process_id || 0) || null,
      current_definition_id: Number(currentDefinitionId || conversation.scope?.current_definition_id || 0) || null
    });

    return toConversationSummary(conversation, 0);
  }
}
