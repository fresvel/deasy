import { Router } from "express";
import { createUser } from "../controllers/users/user_controler.js";
import { loginUser } from "../controllers/users/login_user.js";
import { validatePassword } from "../middlewares/val_password.js";

const router=new Router();

router.post('/', validatePassword, createUser)

router.post('/login', loginUser)

export default router