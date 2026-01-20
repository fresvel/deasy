import { Router } from 'express';
import { sendVerificationEmail,verifyEmail} from "../controllers/mail/mailer_controler.js";

const router = Router();

router.post("/send-verification", sendVerificationEmail);
router.post("/verify", verifyEmail);


export default router;
