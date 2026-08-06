import { Router } from "express";
import {
  createUser,
  getUsers,
  getUserMenu,
  getUserProcessDefinitionPanel,
  getUserDocumentCenter,
  getUserGlobalSignatureCenter,
  createUserProcessTask,
  listTaskItemObservations,
  addTaskItemObservation,
  resolveTaskItemObservation,
  getMyProfile,
  updateMyProfile,
  uploadDeliverablePdf,
  downloadDeliverableTemplate,
  downloadDeliverableFile,
  resetDeliverableWorkflow,
  listDeliverableAttachments,
  uploadDeliverableAttachment,
  deleteDeliverableAttachment,
  downloadDeliverableAttachment,
  createGeneralTask,
  listAddableDeliverables,
  searchTaskRecipients,
  listFlowCatalog,
  listMySends,
  listMyReceived
} from "../controllers/users/user_controler.js";
import { loginUser } from "../controllers/users/login_user.js";
import { logoutUser } from "../controllers/users/logout_user.js";
import { refreshToken } from "../controllers/users/refresh_token.js";
import { updateUserPhoto } from "../controllers/users/user_controler.js";
import { getUserPhoto } from "../controllers/users/user_photo_controller.js";
import { verifyCedulaEc, verifyWhatsappEc } from "../controllers/users/validation_controller.js";
import { validatePassword } from "../middlewares/val_password.js";
import { uploadProfilePhoto } from "../middlewares/uploadProfilePhoto.js";
import { authMiddleware } from "../middlewares/auth.js";
import {
  loadAccessContext,
  requireCedulaAccess,
  requirePermissions,
  requireRouteUserAccess
} from "../middlewares/rbac.js";
import multer from "multer";
import os from "node:os";
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

const uploadDeliverable = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const lowerName = file.originalname.toLowerCase();
    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.ms-excel"
    ]);
    const allowedExtensions = [".pdf", ".docx", ".xlsx", ".doc", ".xls"];
    const isAllowed =
      allowedMimeTypes.has(file.mimetype) ||
      allowedExtensions.some((extension) => lowerName.endsWith(extension));
    if (file.fieldname === "file" && isAllowed) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten archivos PDF, Word o Excel"));
  }
});

// Anexos heterogéneos: acepta documentos, imágenes y comprimidos como evidencias/soportes.
const uploadAttachment = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const lowerName = file.originalname.toLowerCase();
    const allowedExtensions = [
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
      ".csv", ".txt", ".zip", ".rar", ".7z"
    ];
    if (file.fieldname === "file" && allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
      return cb(null, true);
    }
    cb(new Error("Formato de anexo no permitido."));
  }
});

router.post('/', validatePassword, createUser)
router.get('/', authMiddleware, loadAccessContext, requirePermissions("people.read"), getUsers)

router.post('/login', loginUser)
router.post('/logout', logoutUser)
router.post('/refresh-token', refreshToken)

router.get(
  '/:id/menu',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "account", action: "read" }),
  getUserMenu
);
router.get(
  '/:id/process-definitions/:definitionId/panel',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "read" }),
  getUserProcessDefinitionPanel
);
router.get(
  '/:id/document-center',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read" }),
  getUserDocumentCenter
);
router.get(
  '/:id/signature-center',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "signature_flows", action: "read" }),
  getUserGlobalSignatureCenter
);
router.post(
  '/:id/process-definitions/:definitionId/tasks',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "create" }),
  createUserProcessTask
);
router.post(
  '/:id/general-tasks',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "create" }),
  createGeneralTask
);
router.get(
  '/:id/addable-deliverables',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "create" }),
  listAddableDeliverables
);
router.get(
  '/:id/task-recipients',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "create" }),
  searchTaskRecipients
);
router.get(
  '/:id/flow-catalog',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "create" }),
  listFlowCatalog
);
router.get(
  '/:id/my-sends',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "read" }),
  listMySends
);
router.get(
  '/:id/my-received',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "process_execution", action: "read" }),
  listMyReceived
);
router.post(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/upload-file',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "update", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  uploadDeliverable.single('file'),
  uploadDeliverablePdf
);
router.get(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/observations',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  listTaskItemObservations
);
router.post(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/observations',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "update", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  addTaskItemObservation
);
router.post(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/observations/:observationId/resolve',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "update", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  resolveTaskItemObservation
);
router.get(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/attachments',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  listDeliverableAttachments
);
router.post(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/attachments',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "update", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  uploadAttachment.single('file'),
  uploadDeliverableAttachment
);
router.get(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/attachments/:attachmentId/download',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  downloadDeliverableAttachment
);
router.delete(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/attachments/:attachmentId',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "update", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  deleteDeliverableAttachment
);
router.get(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/template-download',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read" }),
  downloadDeliverableTemplate
);
router.get(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/file',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read" }),
  downloadDeliverableFile
);
router.post(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/reset-workflow',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "update", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  resetDeliverableWorkflow
);

//perfil 
router.get('/me', authMiddleware, loadAccessContext, getMyProfile);
router.patch('/me', authMiddleware, loadAccessContext, requirePermissions("account.update"), updateMyProfile);
router.get('/me/certificates', authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), listMyCertificates);
router.post('/me/certificates', authMiddleware, loadAccessContext, requirePermissions("signature_flows.update"), uploadCertificate.single('certificate'), uploadMyCertificate);
router.put('/me/certificates/:certificateId/default', authMiddleware, loadAccessContext, requirePermissions("signature_flows.update"), setMyDefaultCertificate);
router.get('/me/certificates/:certificateId/download', authMiddleware, loadAccessContext, requirePermissions("signature_flows.read"), downloadMyCertificate);
router.delete('/me/certificates/:certificateId', authMiddleware, loadAccessContext, requirePermissions("signature_flows.update"), deleteMyCertificate);

// Lectura autenticada de la foto. Basta con tener sesion activa: los avatares se
// muestran entre companeros, lo que se corta es el acceso anonimo por /uploads.
router.get('/:cedula/photo', authMiddleware, loadAccessContext, getUserPhoto);

router.put(
  '/:cedula/photo',
  authMiddleware,
  loadAccessContext,
  requireCedulaAccess({ resource: "account", action: "update", elevatedRoles: ["AdminSistema", "GestorTalentoHumano"] }),
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
