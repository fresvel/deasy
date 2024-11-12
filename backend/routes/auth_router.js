import { Router } from "express";
import { createUser } from "../controllers/procesos/externos/create_account.js";
import { loginUser } from "../controllers/procesos/externos/login_user.js";
import { validateCreateuser } from "../middlewares/val_createuser.js";

const router=new Router();

router.post('/register', validateCreateuser, createUser)
router.post('/login', loginUser)

export default router