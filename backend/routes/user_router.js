import { Router } from "express";
import { createUser, getUsers, getUserMenu } from "../controllers/users/user_controler.js";
import { loginUser } from "../controllers/users/login_user.js";
import { logoutUser } from "../controllers/users/logout_user.js";
import { updateUserPhoto } from "../controllers/users/user_controler.js";
import { verifyCedulaEc, verifyWhatsappEc } from "../controllers/users/validation_controller.js";
import { validatePassword } from "../middlewares/val_password.js";
import { uploadProfilePhoto } from "../middlewares/uploadProfilePhoto.js";

const router=new Router();

router.post('/', validatePassword, createUser)
router.get('/', getUsers)

router.post('/login', loginUser)
router.post('/logout', logoutUser)

router.get('/:id/menu', getUserMenu);

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
