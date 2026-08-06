import { Router } from 'express';
import { verifyEmail } from "../controllers/users/verify_email.js";

const router = Router();

router.post("/verify", verifyEmail);


export default router;
