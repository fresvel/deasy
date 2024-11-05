import { Router } from "express";
import { createUser } from "../controllers/create_user.js";
import { loginUser } from "../controllers/login_user.js";
import { validateCreateuser } from "../middlewares/val_createuser.js";

const router=new Router();

router.post('/register', validateCreateuser, createUser)
router.post('/login', loginUser)

export default router