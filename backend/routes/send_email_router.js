import { Router } from 'express';
import { sendVerificationEmail } from '../controllers/mail/mailer_controler.js';

const router = Router();

router.post('/send-code', sendVerificationEmail);

export default router;
