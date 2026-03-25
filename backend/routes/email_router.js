import { Router } from 'express';
import { sendVerificationEmail,verifyEmail} from "../controllers/users/verify_email.js";

const router = Router();

router.post("/send-verification", sendVerificationEmail);
router.post("/verify", verifyEmail);


export default router;
