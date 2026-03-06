import { Router } from "express";
import {
  createUser,
  getUsers,
  getUserMenu,
  getUserProcessDefinitionPanel,
  createUserProcessTask,
  getMyProfile,
  updateMyProfile
} from "../controllers/users/user_controler.js";
import { loginUser } from "../controllers/users/login_user.js";
import { logoutUser } from "../controllers/users/logout_user.js";
import { refreshToken } from "../controllers/users/refresh_token.js";
import { updateUserPhoto } from "../controllers/users/user_controler.js";
import { verifyCedulaEc, verifyWhatsappEc } from "../controllers/users/validation_controller.js";
import { validatePassword } from "../middlewares/val_password.js";
import { uploadProfilePhoto } from "../middlewares/uploadProfilePhoto.js";
import { authMiddleware } from "../middlewares/auth.js";

const router=new Router();

router.post('/', validatePassword, createUser)
router.get('/', getUsers)

router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.post('/refresh-token', refreshToken)

router.get('/:id/menu', getUserMenu);
router.get('/:id/process-definitions/:definitionId/panel', getUserProcessDefinitionPanel);
router.post('/:id/process-definitions/:definitionId/tasks', createUserProcessTask);

router.get('/me', authMiddleware, getMyProfile);
router.patch('/me', authMiddleware, updateMyProfile);

router.put(
  '/:cedula/photo',
  (req, res, next) => {
    uploadProfilePhoto.single('photo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "No se pudo subir la foto." });
      }
      next();
    });
  },
  updateUserPhoto
);

router.get('/validate/cedula/:cedula', verifyCedulaEc);
router.get('/validate/whatsapp/:phone', verifyWhatsappEc);

export default router
