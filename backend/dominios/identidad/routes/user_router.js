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
  listDeliverableHandovers,
  uploadDeliverableAttachment,
  deleteDeliverableAttachment,
  downloadDeliverableAttachment,
  createGeneralTask,
  listAddableDeliverables,
  searchTaskRecipients,
  listFlowCatalog,
  listMySends,
  listMyReceived
} from "../controllers/user_controler.js";
import { loginUser } from "../controllers/login_user.js";
import { recuperarCorreo } from "../controllers/recuperar_correo_controller.js";
import { pedirVerificacionDeTelefono } from "../controllers/telefono_verificacion_controller.js";
import { verificarMiCorreo, reenviarMiCodigo, cambiarMiCorreo, cambiarMiTelefono } from "../controllers/verificacion_registro_controller.js";
import { logoutUser } from "../controllers/logout_user.js";
import { refreshToken } from "../controllers/refresh_token.js";
import { getUserPhoto, updateUserPhoto } from "../controllers/user_photo_controller.js";
import { descargarEscaneoDocumento, subirEscaneoDocumento } from "../controllers/documento_escaneo_controller.js";
import { verifyCedulaEc, verifyWhatsappEc } from "../controllers/validation_controller.js";
import { validatePassword } from "../../../middlewares/val_password.js";
import { uploadProfilePhoto } from "../../../middlewares/uploadProfilePhoto.js";
import { uploadEscaneoDocumento } from "../../../middlewares/uploadEscaneoDocumento.js";
import { handleUploadError } from "../../../middlewares/uploadError.js";
import { badRequest } from "../../../errors/HttpError.js";
import { authMiddleware } from "../../../middlewares/auth.js";
import {
  loadAccessContext,
  requirePersonAccess,
  requirePermissions,
  requireRouteUserAccess
} from "../../../middlewares/rbac.js";
import multer from "multer";
import os from "node:os";
import {
  deleteMyCertificate,
  downloadMyCertificate,
  listMyCertificates,
  setMyDefaultCertificate,
  uploadMyCertificate
} from "../controllers/user_certificate_controller.js";
import { limitaIntentos, limitaYCuenta } from "../../../middlewares/limitaIntentos.js";

const router=new Router();

// 400 explicito en los tres `fileFilter` de este router: rechazar un fichero es culpa del cliente,
// no del servidor. Los recoge `handleUploadError`, montado al final; antes nadie los recogia y
// Express contestaba su pagina HTML con el stack trace completo.
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
    cb(badRequest("Solo se permiten certificados .p12"));
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
    cb(badRequest("Solo se permiten archivos PDF, Word o Excel"));
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
    cb(badRequest("Formato de anexo no permitido."));
  }
});

router.post('/', limitaYCuenta('registro'), validatePassword, createUser)
router.get('/', authMiddleware, loadAccessContext, requirePermissions("people.read"), getUsers)

// PÚBLICA, como el login: la usa quien no puede entrar. Pide la contraseña, así que no es un
// oráculo de existencia — ver `RecuperarCorreoService`.
router.post('/recuperar-correo', limitaYCuenta('recuperar_correo'), recuperarCorreo)

// Pedir una llave para verificar UN telefono propio. Devuelve ya compuestos el enlace de
// Telegram y el de WhatsApp: la pantalla no tiene que saber armarlos.
// ── El registro en tres pasos (C8) ────────────────────────────────────────────────────────────
//
// ⚠️ SIEMPRE SOBRE `me`. La ruta anterior (`POST /email/verify`) aceptaba `{ user_id, code }` SIN
// SESION: cualquiera podia probar codigos contra la cuenta de cualquiera, y de paso averiguar que
// identificadores existen. Atarlo a la sesion no sustituye al limitador de intentos --eso es C9--
// pero reduce el blanco de "cualquiera" a "el mio".
router.post('/me/verificacion/correo', authMiddleware, verificarMiCorreo)
router.post('/me/verificacion/correo/reenviar', authMiddleware, reenviarMiCodigo)

// ⚠️ CORREGIR EL DATO QUE SE ESTA VERIFICANDO. Sin estas dos, una errata en el registro es una
// cuenta MUERTA: el guard exige verificar algo que no se puede recibir, el perfil esta detras de esa
// misma puerta, y el correo y el telefono quedan OCUPADOS --asi que tampoco se puede volver a
// registrar. Cambiar el dato mientras se verifica no debilita nada: lo que se exige es PROBAR lo que
// se declare, no acertar a la primera.
router.put('/me/verificacion/correo', authMiddleware, cambiarMiCorreo)
router.put('/me/verificacion/telefono', authMiddleware, cambiarMiTelefono)

router.post(
  '/me/telefonos/:id/verificacion',
  authMiddleware,
  // Autenticada: el sujeto es la PERSONA, no su IP. Cambiar de red no da intentos nuevos.
  limitaYCuenta('emitir_llave_telefono'),
  loadAccessContext,
  pedirVerificacionDeTelefono
)

// ⚠️ DELANTE DE bcrypt, y ese orden es el punto: la comprobacion de contraseña es cara A PROPOSITO,
// asi que quien dispara contra el acceso no esta solo probando claves, esta gastando nuestro
// procesador. Contar despues no lo evita.
//
// El sujeto es el PAR correo+ip: por IP sola se caeria toda la facultad tras el NAT al quinto
// despiste de cualquiera; por cuenta sola, cualquiera bloquearia una cuenta ajena fallando adrede.
router.post('/login', limitaIntentos('login'), loginUser)
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
  '/:id/addable-catalogo_documental',
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
// Historial de relevos del entregable (defecto 1.10). Mismos middlewares y mismo permiso que los
// anexos de la línea de arriba: quien puede LEER el entregable puede leer por qué cambió de manos.
router.get(
  '/:id/process-definitions/:definitionId/task-items/:taskItemId/handovers',
  authMiddleware,
  loadAccessContext,
  requireRouteUserAccess({ resource: "documents", action: "read", elevatedRoles: ["AdminSistema", "GestorEjecucionProcesos", "GestorDocumental"] }),
  listDeliverableHandovers
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
router.get('/:personId/photo', authMiddleware, loadAccessContext, getUserPhoto);

router.put(
  '/:personId/photo',
  authMiddleware,
  loadAccessContext,
  requirePersonAccess({ resource: "account", action: "update", elevatedRoles: ["AdminSistema", "GestorTalentoHumano"] }),
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

// El PDF del documento de identidad escaneado.
//
// ⚠️ MAS RESTRINGIDO QUE LA FOTO, y a proposito: el avatar lo ve cualquier companero con sesion
// porque sale en listados, chat y firmas; un documento de identidad escaneado NO. Las DOS
// operaciones —leer y subir— exigen ser el dueno o tener rol elevado.
router.get(
  '/:personId/documento/escaneo',
  authMiddleware,
  loadAccessContext,
  requirePersonAccess({ resource: "account", action: "read", elevatedRoles: ["AdminSistema", "GestorTalentoHumano"] }),
  descargarEscaneoDocumento
);

router.put(
  '/:personId/documento/escaneo',
  authMiddleware,
  loadAccessContext,
  requirePersonAccess({ resource: "account", action: "update", elevatedRoles: ["AdminSistema", "GestorTalentoHumano"] }),
  (req, res, next) => {
    uploadEscaneoDocumento.single('escaneo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || "No se pudo subir el escaneo." });
      }
      next();
    });
  },
  subirEscaneoDocumento
);

// ESTA SI lleva `:cedula`, y es la unica que debe: no identifica a una persona, valida UN NUMERO
// de cedula contra el registro civil. El parametro es el dato, no una llave.
// ⚠️ EL FRENO VA DELANTE, y aqui no es una precaucion generica: detras hay una llamada a
// `webservices.ec`, un servicio EXTERNO DE PAGO. Sin esto, cualquiera con un bucle agota la cuota o
// hace que nos bloqueen -- y el daño NO se ve en nuestra maquina, que es lo que lo hacia facil de no
// notar. Se cuenta SIEMPRE (`limitaYCuenta`): aqui no hay «acierto» que premiar, la llamada ya costo.
// Y si la base no contesta, estas dos CIERRAN: sin poder contar, no se llama.
router.get('/validate/cedula/:cedula', limitaYCuenta('validar_cedula'), verifyCedulaEc);
router.get('/validate/whatsapp/:phone', limitaYCuenta('validar_whatsapp'), verifyWhatsappEc);

// Va al final a proposito: recoge lo que multer rechaza en CUALQUIERA de las rutas de arriba.
// La foto de perfil NO pasa por aqui: `PUT /:personId/photo` envuelve su propio multer y ya
// responde JSON por su cuenta.
router.use(handleUploadError);

export default router
