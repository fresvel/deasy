import * as store from "./chatStore.js";
import { logChatInfo } from "./chat_logging.js";

// Carga participantes + unread y ensambla el summary de una conversación.
async function summaryFor(row, personId, unread = null) {
  const participantsMap = await store.loadParticipants([row.id]);
  const unreadCount = unread === null ? await store.unreadCount(row.id, personId) : unread;
  return store.mapConversation(row, participantsMap.get(String(row.id)) || [], unreadCount);
}

const normalizeIds = (ids) =>
  Array.from(new Set((ids || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)));

export default class ChatConversationService {
  async resolveUnreadCount(conversationId, personId) {
    return store.unreadCount(conversationId, personId);
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
    const rows = await store.listConversationsForParticipant(personId, safeLimit);
    const participantsMap = await store.loadParticipants(rows.map((r) => r.id));
    const summaries = await Promise.all(
      rows.map(async (row) => {
        const unread = await store.unreadCount(row.id, personId);
        return store.mapConversation(row, participantsMap.get(String(row.id)) || [], unread);
      })
    );
    return summaries;
  }

  async getForParticipant(conversationId, personId) {
    if (!store.isValidId(conversationId)) {
      const error = new Error("conversationId inválido.");
      error.status = 400;
      throw error;
    }
    const row = await store.findConversationForParticipant(conversationId, personId);
    if (!row) {
      const error = new Error("Conversación no encontrada o no autorizada.");
      error.status = 404;
      throw error;
    }
    return summaryFor(row, personId);
  }

  async createConversation({ type, title = null, participantIds = [], createdBy, processId = null }) {
    const normalizedParticipantIds = normalizeIds(participantIds);
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

    const now = new Date();
    const id = await store.insertConversation({
      type,
      title: title?.trim() || null,
      process_id: processId ? Number(processId) : null,
      created_by: Number(createdBy),
    });
    await store.insertParticipants(
      id,
      normalizedParticipantIds.map((personId) => ({
        person_id: personId,
        role: personId === Number(createdBy) ? "owner" : "member",
        joined_at: now,
        left_at: null,
      }))
    );

    logChatInfo("chat.conversation.created", {
      conversation_id: String(id),
      type,
      process_id: Number(processId || 0) || null,
      person_id: Number(createdBy),
    });

    const row = await store.findConversationById(id);
    return summaryFor(row, Number(createdBy), 0);
  }

  async getProcessThread(processId, personId) {
    const safeProcessId = Number(processId);
    if (!Number.isFinite(safeProcessId) || safeProcessId <= 0) {
      const error = new Error("processId inválido.");
      error.status = 400;
      throw error;
    }
    const row = await store.findProcessThreadForParticipant(safeProcessId, personId);
    if (!row) {
      const error = new Error("Thread del proceso no encontrado o no autorizado.");
      error.status = 404;
      throw error;
    }
    return summaryFor(row, personId);
  }

  async getByStableKeyForParticipant(stableKey, personId) {
    const row = await store.findConversationByStableKey(String(stableKey), personId);
    if (!row) return null;
    return summaryFor(row, personId);
  }

  async getByStableKey(stableKey) {
    const row = await store.findConversationByStableKey(String(stableKey));
    return row || null;
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
    scopeUnitLabel = null,
  }) {
    const normalizedParticipantIds = normalizeIds(participantIds);
    if (!normalizedParticipantIds.length) {
      const error = new Error("No se pudieron resolver participantes para el thread del proceso.");
      error.status = 400;
      throw error;
    }
    const adminIdSet = new Set(normalizeIds(adminIds));
    adminIdSet.add(Number(createdBy));

    const now = new Date();
    const id = await store.insertConversation({
      type: "process_thread",
      title: this.buildProcessThreadTitle({ processName, scopeUnitLabel }),
      process_id: Number(processId),
      scope_process_id: Number(processId),
      scope_unit_id: Number(scopeUnitId),
      stable_key: String(stableKey),
      scope_current_definition_id: currentDefinitionId ? Number(currentDefinitionId) : null,
      scope_origin_definition_id: originDefinitionId ? Number(originDefinitionId) : null,
      created_by: Number(createdBy),
    });
    await store.insertParticipants(
      id,
      normalizedParticipantIds.map((personId) => ({
        person_id: personId,
        role: adminIdSet.has(personId) ? "admin" : "member",
        joined_at: now,
        left_at: null,
      }))
    );

    logChatInfo("chat.process_thread.created", {
      conversation_id: String(id),
      process_id: Number(processId),
      scope_unit_id: Number(scopeUnitId),
      person_id: Number(createdBy),
    });

    const row = await store.findConversationById(id);
    return summaryFor(row, Number(createdBy), 0);
  }

  buildUnitThreadTitle(unitLabel = null) {
    const normalizedUnitLabel = String(unitLabel || "").trim();
    return normalizedUnitLabel ? `Unidad · ${normalizedUnitLabel}` : "Chat de unidad";
  }

  async createUnitThread({ unitId, stableKey, participantIds = [], adminIds = [], createdBy, unitLabel = null }) {
    const normalizedParticipantIds = normalizeIds(participantIds);
    if (!normalizedParticipantIds.length) {
      const error = new Error("No se pudieron resolver miembros para el chat de la unidad.");
      error.status = 400;
      throw error;
    }
    const adminIdSet = new Set(normalizeIds(adminIds));

    const now = new Date();
    const id = await store.insertConversation({
      type: "unit",
      title: this.buildUnitThreadTitle(unitLabel),
      scope_unit_id: Number(unitId),
      stable_key: String(stableKey),
      created_by: Number(createdBy),
    });
    await store.insertParticipants(
      id,
      normalizedParticipantIds.map((personId) => ({
        person_id: personId,
        role: adminIdSet.has(personId) ? "admin" : "member",
        joined_at: now,
        left_at: null,
      }))
    );

    logChatInfo("chat.unit_thread.created", {
      conversation_id: String(id),
      scope_unit_id: Number(unitId),
      person_id: Number(createdBy),
    });

    const row = await store.findConversationById(id);
    return summaryFor(row, Number(createdBy), 0);
  }

  async syncUnitThread(conversationId, { participantIds = [], adminIds = [], unitLabel = null } = {}) {
    const row = await store.findConversationById(conversationId);
    if (!row) {
      const error = new Error("Chat de la unidad no encontrado.");
      error.status = 404;
      throw error;
    }
    const normalizedParticipantIds = normalizeIds(participantIds);
    const adminIdSet = new Set(normalizeIds(adminIds));

    const existingMap = await store.loadParticipants([row.id]);
    const existingByPersonId = new Map(
      (existingMap.get(String(row.id)) || []).map((p) => [Number(p.person_id), p])
    );

    const now = new Date();
    await store.replaceParticipants(
      row.id,
      normalizedParticipantIds.map((personId) => ({
        person_id: personId,
        role: adminIdSet.has(personId) ? "admin" : "member",
        joined_at: existingByPersonId.get(personId)?.joined_at || now,
        left_at: null,
      }))
    );
    await store.updateConversation(row.id, { title: this.buildUnitThreadTitle(unitLabel) });

    logChatInfo("chat.unit_thread.synced", {
      conversation_id: String(row.id),
      scope_unit_id: num(row.scope_unit_id),
      participants_count: normalizedParticipantIds.length,
    });

    const updated = await store.findConversationById(row.id);
    return summaryFor(updated, Number(existingByPersonId.keys().next().value || 0), 0);
  }

  async syncProcessThread(conversationId, {
    participantIds = [],
    adminIds = [],
    currentDefinitionId = null,
    processName = null,
    scopeUnitLabel = null,
  } = {}) {
    const row = await store.findConversationById(conversationId);
    if (!row) {
      const error = new Error("Conversación de proceso no encontrada.");
      error.status = 404;
      throw error;
    }
    const normalizedParticipantIds = normalizeIds(participantIds);
    const adminIdSet = new Set(normalizeIds(adminIds));

    const existingMap = await store.loadParticipants([row.id]);
    const existingByPersonId = new Map(
      (existingMap.get(String(row.id)) || []).map((p) => [Number(p.person_id), p])
    );

    const now = new Date();
    await store.replaceParticipants(
      row.id,
      normalizedParticipantIds.map((personId) => {
        const existing = existingByPersonId.get(personId);
        return {
          person_id: personId,
          role: adminIdSet.has(personId) ? "admin" : existing?.role || "member",
          joined_at: existing?.joined_at || now,
          left_at: null,
        };
      })
    );
    await store.updateConversation(row.id, {
      title: this.buildProcessThreadTitle({ processName, scopeUnitLabel }),
      scope_current_definition_id: currentDefinitionId
        ? Number(currentDefinitionId)
        : row.scope_current_definition_id ?? null,
    });

    logChatInfo("chat.process_thread.synced", {
      conversation_id: String(row.id),
      process_id: num(row.process_id) || num(row.scope_process_id),
      current_definition_id: Number(currentDefinitionId || row.scope_current_definition_id || 0) || null,
    });

    const updated = await store.findConversationById(row.id);
    return summaryFor(updated, 0, 0);
  }
}

const num = (v) => (v === null || v === undefined ? null : Number(v));
