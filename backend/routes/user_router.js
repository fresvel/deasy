import { Router } from "express";
import { createUser } from "../controllers/users/user_controler.js";
import { loginUser } from "../controllers/users/login_user.js";
import { verifyCedulaEc, verifyWhatsappEc } from "../controllers/users/validation_controller.js";
import { validatePassword } from "../middlewares/val_password.js";

const router=new Router();

router.post('/', validatePassword, createUser)

router.post('/login', loginUser)

router.get('/validate/cedula/:cedula', verifyCedulaEc);
router.get('/validate/whatsapp/:phone', verifyWhatsappEc);

export default router