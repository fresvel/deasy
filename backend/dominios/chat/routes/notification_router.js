import { Router } from "express";
import { authMiddleware } from "../../../middlewares/auth.js";
import { listNotifications, markNotificationsRead } from "../controllers/chat_controller.js";

const router = new Router();

router.use(authMiddleware);

router.get("/", listNotifications);
router.post("/read", markNotificationsRead);

export default router;
