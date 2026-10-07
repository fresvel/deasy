import { Router } from "express";
import { createProgram } from "../dominios/organizacion/index.js";



import { createProceso } from "../controllers/admin/proceso_controler.js";
import {
  generateTasksForTermController,
  launchProcessDefinitionController,
  getTermLaunchStatusController,
  getDefinitionLaunchInfoController
} from "../controllers/admin/task_generation_controller.js";
import { codigoDeVinculacion, estadoDeCanales } from "../controllers/canales/canales_controller.js";
import {
  crearBorrador,
  estadoDelArchivo,
  guardarBorrador,
  historialDeDocumento,
  listarDocumentos,
  publicarDocumento,
  retirarDocumento,
  verDocumento
} from "../controllers/legal/legal_admin_controller.js";
import sqlAdminRouter from "./sql_admin_router.js";
import { authMiddleware } from "../middlewares/auth.js";
import { loadAccessContext, requirePermissions } from "../middlewares/rbac.js";

const router = new Router();

router.use(authMiddleware, loadAccessContext);

router.post("/program", requirePermissions("units.create"), createProgram)


router.post("/process", requirePermissions("process_definitions.create"), createProceso)
router.post("/terms/:termId/generate-tasks", requirePermissions("process_execution.create"), generateTasksForTermController)
router.get("/terms/:termId/launch-status", requirePermissions("process_execution.read"), getTermLaunchStatusController)
router.get("/process-definitions/:definitionId/launch-info", requirePermissions("process_execution.read"), getDefinitionLaunchInfoController)
router.post("/process-definitions/:definitionId/launch", requirePermissions("process_execution.create"), launchProcessDefinitionController)

// ── LOS CANALES DE MENSAJERIA ──────────────────────────────────────────────────────────────────
//
// ⚠️ SON DOS PERMISOS DISTINTOS Y NO UNA GRADACION CUALQUIERA. `read` enseña si el canal esta vivo;
// `manage` enseña el CODIGO DE VINCULACION, y quien lo escanea decide QUE CUENTA DE WHATSAPP ES el
// canal de la institucion. Es una toma de control de la identidad del canal, no «ver un dato»: quien
// vigila no tiene por que poder vincular.
router.get("/canales", requirePermissions("channels.read"), estadoDeCanales)
router.get("/canales/whatsapp/qr", requirePermissions("channels.manage"), codigoDeVinculacion)

// ── LOS TEXTOS LEGALES ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ DOS PERMISOS, Y LA FRONTERA ESTA EN «PUBLICAR». `update` redacta el borrador --se puede
// corregir mil veces, cada guardado deja una version de objeto en el bucket de borradores--.
// `manage` publica y retira: publicar copia el texto a un bucket con retencion COMPLIANCE y a
// partir de ahi NO LO BORRA NADIE, tampoco quien administra el sistema. Redactar y comprometer a
// la institucion durante diez años no pueden ser el mismo permiso.
//
// La lectura del archivo (`/legal/archivo/estado`) va con `read` porque no enseña ningun texto:
// dice si el bucket tiene bloqueo, en que modo y por cuantos dias.
router.get("/legal/documentos", requirePermissions("legal_documents.read"), listarDocumentos)
router.get("/legal/archivo/estado", requirePermissions("legal_documents.read"), estadoDelArchivo)
router.get("/legal/documentos/:id", requirePermissions("legal_documents.read"), verDocumento)
router.get("/legal/documentos/:id/historial", requirePermissions("legal_documents.read"), historialDeDocumento)
router.post("/legal/documentos", requirePermissions("legal_documents.update"), crearBorrador)
router.put("/legal/documentos/:id", requirePermissions("legal_documents.update"), guardarBorrador)
router.post("/legal/documentos/:id/publicar", requirePermissions("legal_documents.manage"), publicarDocumento)
router.post("/legal/documentos/:id/retirar", requirePermissions("legal_documents.manage"), retirarDocumento)

router.use("/sql", sqlAdminRouter);

export default router;
