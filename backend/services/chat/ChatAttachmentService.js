import path from "node:path";
import {
  ensureBucketExists,
  getMinioObjectStream,
  statMinioObject,
  uploadFileToMinio,
} from "../storage/minio_service.js";
import * as store from "./chatStore.js";
import { logChatInfo } from "./chat_logging.js";

const MINIO_CHAT_BUCKET = process.env.MINIO_CHAT_BUCKET || "deasy-chat";
const MINIO_CHAT_PREFIX = String(process.env.MINIO_CHAT_PREFIX || "Chat").replace(/^\/+|\/+$/g, "");

const sanitizeFileName = (value = "adjunto") =>
  String(value || "adjunto")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "adjunto";

const buildAttachmentObjectName = ({ conversationId, personId, originalName }) => {
  const sanitizedName = sanitizeFileName(originalName);
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${MINIO_CHAT_PREFIX}/conversations/${conversationId}/${monthKey}/${personId}-${uniqueSuffix}-${sanitizedName}`;
};

export default class ChatAttachmentService {
  async resolveConversationForParticipant(conversationId, personId) {
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
    return conversation;
  }

  async uploadAttachments(conversationId, personId, files = []) {
    const conversation = await this.resolveConversationForParticipant(conversationId, personId);
    const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!normalizedFiles.length) {
      const error = new Error("Debes adjuntar al menos un archivo.");
      error.status = 400;
      throw error;
    }

    await ensureBucketExists(MINIO_CHAT_BUCKET);

    const attachments = [];
    for (const file of normalizedFiles) {
      const objectName = buildAttachmentObjectName({
        conversationId: String(conversation.id),
        personId,
        originalName: file.originalname,
      });

      await uploadFileToMinio(MINIO_CHAT_BUCKET, objectName, file.path, {
        "Content-Type": file.mimetype || "application/octet-stream",
        "Original-Name": String(file.originalname || path.basename(objectName)),
      });

      attachments.push({
        path: objectName,
        filename: String(file.originalname || path.basename(objectName)),
        mime: file.mimetype || "application/octet-stream",
        size: Number(file.size || 0),
      });
    }

    logChatInfo("chat.attachments.uploaded", {
      conversation_id: String(conversation.id),
      person_id: Number(personId),
      attachments_count: attachments.length,
    });

    return attachments;
  }

  async downloadAttachment(conversationId, messageId, attachmentIndex, personId) {
    await this.resolveConversationForParticipant(conversationId, personId);
    if (!store.isValidId(messageId)) {
      const error = new Error("messageId inválido.");
      error.status = 400;
      throw error;
    }

    const message = await store.findMessageForConversation(Number(messageId), Number(conversationId));
    if (!message) {
      const error = new Error("Mensaje no encontrado.");
      error.status = 404;
      throw error;
    }

    const attachmentsMap = await store.loadAttachments([message.id]);
    const messageAttachments = attachmentsMap.get(String(message.id)) || [];
    const safeIndex = Number(attachmentIndex);
    if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= messageAttachments.length) {
      const error = new Error("Adjunto no encontrado.");
      error.status = 404;
      throw error;
    }

    const attachment = messageAttachments[safeIndex];
    const stat = await statMinioObject(MINIO_CHAT_BUCKET, attachment.path);
    const stream = await getMinioObjectStream(MINIO_CHAT_BUCKET, attachment.path);

    return {
      attachment,
      stream,
      contentType:
        stat?.metaData?.["content-type"] ||
        stat?.metaData?.["Content-Type"] ||
        attachment.mime ||
        "application/octet-stream",
      contentLength: stat?.size || attachment.size || undefined,
    };
  }
}
