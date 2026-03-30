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
import multer from "multer";
import os from "os";
import {
  deleteMyCertificate,
  downloadMyCertificate,
  listMyCertificates,
  setMyDefaultCertificate,
  uploadMyCertificate
} from "../controllers/users/user_certificate_controller.js";

const router=new Router();
const uploadCertificate = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isP12 =
      file.mimetype === "application/x-pkcs12" ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.toLowerCase().endsWith(".p12");
    if (file.fieldname === "certificate" && isP12) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten certificados .p12"));
  }
});

router.post('/', validatePassword, createUser)
router.get('/', getUsers)

router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.post('/refresh-token', refreshToken)

router.get('/:id/menu', getUserMenu);
router.get('/:id/process-definitions/:definitionId/panel', getUserProcessDefinitionPanel);
router.post('/:id/process-definitions/:definitionId/tasks', createUserProcessTask);

//perfil 
router.get('/me', authMiddleware, getMyProfile);
router.patch('/me', authMiddleware, updateMyProfile);
router.get('/me/certificates', authMiddleware, listMyCertificates);
router.post('/me/certificates', authMiddleware, uploadCertificate.single('certificate'), uploadMyCertificate);
router.put('/me/certificates/:certificateId/default', authMiddleware, setMyDefaultCertificate);
router.get('/me/certificates/:certificateId/download', authMiddleware, downloadMyCertificate);
router.delete('/me/certificates/:certificateId', authMiddleware, deleteMyCertificate);

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
