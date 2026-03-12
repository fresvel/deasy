import { Router } from "express";
import {
  requestPasswordReset,
  verifyResetCode,
  resetPassword
} from "../controllers/users/reset_password.js";

const router = Router();

router.post("/request", requestPasswordReset);
router.post("/verify", verifyResetCode);
router.post("/reset", resetPassword);

export default router;
