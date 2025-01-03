import { Router } from "express";
import { createUser } from "../controllers/users/user_controler.js";
import { loginUser } from "../controllers/users/login_user.js";
import { validateCreateuser } from "../middlewares/val_createuser.js";

const router=new Router();

router.post('/', validateCreateuser, createUser)

router.post('/login', loginUser)

export default router