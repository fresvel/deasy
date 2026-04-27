import path from "path";
import fs from "fs-extra";
import ChatConversationService from "../../services/chat/ChatConversationService.js";
import ChatAuthorizationService from "../../services/chat/ChatAuthorizationService.js";
import ChatAttachmentService from "../../services/chat/ChatAttachmentService.js";
import ChatIdentityService from "../../services/chat/ChatIdentityService.js";
import ChatMessageService from "../../services/chat/ChatMessageService.js";
import ChatNotificationService from "../../services/chat/ChatNotificationService.js";
import ChatRealtimePublisherService from "../../services/chat/ChatRealtimePublisherService.js";
import { logChatError } from "../../services/chat/chat_logging.js";

const identityService = new ChatIdentityService();
const attachmentService = new ChatAttachmentService();
const conversationService = new ChatConversationService();
const authorizationService = new ChatAuthorizationService();
const messageService = new ChatMessageService();
const notificationService = new ChatNotificationService();
const realtimePublisherService = new ChatRealtimePublisherService();

const handleControllerError = (res, error, fallbackMessage) => {
  const status = Number(error?.status || 500);
  if (status >= 500) {
    logChatError("chat.controller.error", {
      status,
      message: error?.message || fallbackMessage
    });
  }
  return res.status(status).json({
    message: error?.message || fallbackMessage
  });
};

export const listConversations = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const conversations = await conversationService.listForParticipant(personId, {
      limit: req.query?.limit
    });
    return res.json({ data: conversations });
  } catch (error) {
    return handleControllerError(res, error, "No se pudieron cargar las conversaciones.");
  }
};

export const getConversation = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const conversation = await conversationService.getForParticipant(req.params.id, personId);
    return res.json({ data: conversation });
  } catch (error) {
    return handleControllerError(res, error, "No se pudo cargar la conversación.");
  }
};

export const createConversation = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const requestedParticipants = Array.isArray(req.body?.participant_ids) ? req.body.participant_ids : [];
    const conversation = await conversationService.createConversation({
      type: req.body?.type,
      title: req.body?.title,
      participantIds: [personId, ...requestedParticipants],
      processId: req.body?.process_id,
      createdBy: personId
    });
    return res.status(201).json({ data: conversation });
  } catch (error) {
    return handleControllerError(res, error, "No se pudo crear la conversación.");
  }
};

export const listConversationMessages = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const messages = await messageService.listForConversation(req.params.id, personId, {
      limit: req.query?.limit,
      before: req.query?.before
    });
    return res.json({ data: messages });
  } catch (error) {
    return handleControllerError(res, error, "No se pudieron cargar los mensajes.");
  }
};

export const createConversationMessage = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const result = await messageService.createMessage(req.params.id, personId, req.body || {});
    const notifications = await notificationService.createForMessage({
      conversation: result.conversation,
      message: result.message,
      recipientPersonIds: result.recipient_person_ids || []
    });
    let realtime = { published: false, reason: "not_attempted" };
    try {
      realtime = await realtimePublisherService.publishMessageCreated(result);
    } catch (realtimeError) {
      console.error("Chat realtime publish failed", {
        conversationId: result?.conversation?.id || null,
        messageId: result?.message?.id || null,
        error: realtimeError?.message || realtimeError
      });
      realtime = {
        published: false,
        reason: "publish_failed",
        error: realtimeError?.message || "No se pudo publicar en EMQX."
      };
    }
    return res.status(201).json({
      data: result,
      notifications,
      realtime
    });
  } catch (error) {
    return handleControllerError(res, error, "No se pudo enviar el mensaje.");
  }
};

export const markConversationRead = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const result = await messageService.markConversationRead(req.params.id, personId);
    const notifications = await notificationService.markConversationRead(personId, req.params.id);
    return res.json({
      data: result,
      notifications
    });
  } catch (error) {
    return handleControllerError(res, error, "No se pudo marcar la conversación como leída.");
  }
};

export const uploadConversationAttachments = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const attachments = await attachmentService.uploadAttachments(req.params.id, personId, files);
    return res.status(201).json({ data: attachments });
  } catch (error) {
    return handleControllerError(res, error, "No se pudieron cargar los adjuntos del chat.");
  } finally {
    await Promise.all(files.map((file) => fs.remove(file.path).catch(() => {})));
  }
};

export const downloadConversationAttachment = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const result = await attachmentService.downloadAttachment(
      req.params.id,
      req.params.messageId,
      req.params.attachmentIndex,
      personId
    );

    res.setHeader("Content-Type", result.contentType);
    if (result.contentLength) {
      res.setHeader("Content-Length", result.contentLength);
    }
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(result.attachment.filename || "adjunto")}"`
    );
    result.stream.on("error", (streamError) => {
      logChatError("chat.attachment.download_failed", {
        conversation_id: req.params.id,
        message_id: req.params.messageId,
        attachment_index: Number(req.params.attachmentIndex),
        error: streamError?.message || streamError
      });
      if (!res.headersSent) {
        res.status(500).json({ message: "No se pudo transmitir el adjunto del chat." });
      } else {
        res.destroy(streamError);
      }
    });
    result.stream.pipe(res);
  } catch (error) {
    return handleControllerError(res, error, "No se pudo descargar el adjunto del chat.");
  }
};

export const getProcessThread = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const context = await authorizationService.resolveProcessThreadContext({
      personId,
      processId: req.params.processId,
      scopeUnitId: req.query?.scope_unit_id
    });
    const conversation = await conversationService.getByStableKeyForParticipant(context.stableKey, personId);
    if (!conversation) {
      return res.status(404).json({
        message: "Thread del proceso no encontrado para el ámbito solicitado.",
        context: {
          process_id: context.processId,
          scope_unit_id: context.scopeUnitId,
          accessible_scope_unit_ids: context.accessibleScopeUnitIds
        }
      });
    }
    return res.json({ data: conversation });
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json({
      message: error?.message || "No se pudo cargar el thread del proceso.",
      details: error?.details || null
    });
  }
};

export const createOrGetProcessThread = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const context = await authorizationService.resolveProcessThreadContext({
      personId,
      processId: req.params.processId,
      scopeUnitId: req.body?.scope_unit_id ?? req.query?.scope_unit_id
    });

    const existingConversationRecord = await conversationService.getByStableKey(context.stableKey);
    if (existingConversationRecord) {
      const syncedConversation = await conversationService.syncProcessThread(existingConversationRecord._id, {
        participantIds: context.participantIds,
        adminIds: context.adminIds,
        currentDefinitionId: context.currentDefinitionId,
        processName: context.processName,
        scopeUnitLabel: context.scopeUnitLabel
      });
      return res.json({
        data: syncedConversation,
        meta: {
          created: false,
          synchronized: true,
          process_id: context.processId,
          scope_unit_id: context.scopeUnitId,
          accessible_scope_unit_ids: context.accessibleScopeUnitIds
        }
      });
    }

    const createdConversation = await conversationService.createProcessThread({
      processId: context.processId,
      scopeUnitId: context.scopeUnitId,
      stableKey: context.stableKey,
      participantIds: context.participantIds,
      adminIds: context.adminIds,
      currentDefinitionId: context.currentDefinitionId,
      originDefinitionId: context.originDefinitionId,
      createdBy: personId,
      processName: context.processName,
      scopeUnitLabel: context.scopeUnitLabel
    });

    return res.status(201).json({
      data: createdConversation,
      meta: {
        created: true,
        synchronized: false,
        process_id: context.processId,
        scope_unit_id: context.scopeUnitId,
        accessible_scope_unit_ids: context.accessibleScopeUnitIds
      }
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    return res.status(status).json({
      message: error?.message || "No se pudo crear o recuperar el thread del proceso.",
      details: error?.details || null
    });
  }
};

export const listNotifications = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const notifications = await notificationService.listForRecipient(personId, {
      limit: req.query?.limit
    });
    return res.json({ data: notifications });
  } catch (error) {
    return handleControllerError(res, error, "No se pudieron cargar las notificaciones.");
  }
};

export const markNotificationsRead = async (req, res) => {
  try {
    const { personId } = await identityService.resolveAuthenticatedPerson(req);
    const notifications = await notificationService.markRead(personId, req.body?.notification_ids || []);
    return res.json({ data: notifications });
  } catch (error) {
    return handleControllerError(res, error, "No se pudieron marcar las notificaciones como leídas.");
  }
};
