import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import {
  createConversation,
  createConversationMessage,
  createOrGetProcessThread,
  getConversation,
  getProcessThread,
  listConversationMessages,
  listConversations,
  listNotifications,
  markConversationRead,
  markNotificationsRead
} from "../controllers/chat/chat_controller.js";

const router = new Router();

router.use(authMiddleware);

router.get("/conversations", listConversations);
router.post("/conversations", createConversation);
router.get("/conversations/:id", getConversation);
router.get("/conversations/:id/messages", listConversationMessages);
router.post("/conversations/:id/messages", createConversationMessage);
router.post("/conversations/:id/read", markConversationRead);

router.get("/processes/:processId/thread", getProcessThread);
router.post("/processes/:processId/thread", createOrGetProcessThread);

router.get("/notifications", listNotifications);
router.post("/notifications/read", markNotificationsRead);

export default router;
