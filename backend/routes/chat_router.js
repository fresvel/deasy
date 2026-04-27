import { Router } from "express";
import multer from "multer";
import os from "os";
import { authMiddleware } from "../middlewares/auth.js";
import {
  createConversation,
  createConversationMessage,
  createOrGetProcessThread,
  downloadConversationAttachment,
  getConversation,
  getProcessThread,
  listConversationMessages,
  listConversations,
  listNotifications,
  markConversationRead,
  markNotificationsRead,
  uploadConversationAttachments
} from "../controllers/chat/chat_controller.js";

const router = new Router();
const uploadChatAttachment = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 5
  }
});

router.use(authMiddleware);

router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id", getConversation);
router.get("/conversations/:id/messages", listConversationMessages);
router.post("/conversations/:id/messages", createConversationMessage);
router.post("/conversations/:id/read", markConversationRead);
router.post("/conversations/:id/attachments", uploadChatAttachment.array("files", 5), uploadConversationAttachments);
router.get("/conversations/:id/messages/:messageId/attachments/:attachmentIndex", downloadConversationAttachment);

router.get("/processes/:processId/thread", getProcessThread);
router.post("/processes/:processId/thread", createOrGetProcessThread);

router.get("/notifications", listNotifications);
router.post("/notifications/read", markNotificationsRead);

export default router;
