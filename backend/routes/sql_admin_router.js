import { Router } from "express";
import multer from "multer";
import {
  getSqlMeta,
  getOperationStats,
  syncTemplateSeeds,
  getTemplateSeedPreview,
  downloadTemplateArtifactArchive,
  downloadTemplateSeedArchive,
  downloadTemplateArtifactSource,
  applyTemplateArtifactSource,
  createTemplateArtifactDraft,
  updateTemplateArtifactDraft,
  getTemplateArtifactSchema,
  setTemplateArtifactActive,
  createTemplateArtifactVersion,
  publishTemplateArtifact,
  retireTemplateArtifact,
  getTemplateVersions,
  getConfigActivationDiff,
  useTemplateVersionInConfig,
  startGuidedTemplateUpdate,
  finishGuidedTemplateUpdate,
  getProcessTargetScope,
  listResolvableCargos,
  reconcileTaskItemAssignments,
  handoverTaskItem,
  listTaskItemHandovers,
  listStuckTaskItems,
  getProcessDefinitionSeriesScope,
  getUnitGraph,
  createUnitWithParent,
  getUnitDetail,
  getUnitProcesses,
  getUnitAttachableProcesses,
  getProcessGraph,
  getProcessDetail,
  createProcessWithParent,
  setProcessParent,
  addUnitPosition,
  updateUnitPosition,
  removeUnitPosition,
  assignUnitPosition,
  unassignUnitPosition,
  listSqlRows,
  createSqlRow,
  updateSqlRow,
  deleteSqlRow
} from "../controllers/admin/sql_admin_controller.js";
import { requireAnyRole, requireSqlAdminPermission } from "../middlewares/rbac.js";
import { handleUploadError } from "../middlewares/uploadError.js";
import { badRequest } from "../errors/HttpError.js";
import { describeRejectedDraftArtifactFile } from "../services/admin/templates/artifacts.js";
import { MANAGEMENT_ROLES } from "../config/rbacPolicy.js";

const router = new Router();
// memoryStorage sin límites deja que una subida grande agote la RAM del proceso.
// 30 MB por fichero es el mismo tope que usa `uploadDeliverable` en user_router.
//
// Y `fileFilter`, que ANTES NO EXISTÍA (§0.4 S3). Sin él la extensión que escribe el cliente
// decidía el nombre del objeto en MinIO: medido, un `payload.sh` por el campo `pdf_file` daba 200 y
// acababa en `template/pdf/payload.sh` — y el ZIP de descarga le pone modo 0755. La política vive en
// `services/admin/templates/artifacts.js` porque es del dominio de plantillas y así tiene test
// unitario; aquí sólo queda el enganche, que es transporte.
//
// `badRequest(...)` y NO `new Error(...)`: es la lección del defecto 1.1 (`040a9d0`).
// `describeUploadError` convierte cualquier error SIN `statusCode` en un 500 genérico y se traga el
// motivo — correcto para un fallo del servidor, mentira para un fichero con el tipo equivocado.
const draftArtifactUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    const motivo = describeRejectedDraftArtifactFile(file);
    return motivo ? cb(badRequest(motivo)) : cb(null, true);
  }
});

router.get("/meta", requireAnyRole(MANAGEMENT_ROLES), getSqlMeta);
router.get("/stats/operation", requireAnyRole(MANAGEMENT_ROLES), getOperationStats);
// Las tres rutas del CATALOGO DE GENERADORES. Llevaban `/template_seeds/` hasta el frente 23 (F3.1):
// el segmento es el nombre de la tabla —el CRUD generico sirve `/admin/sql/:table` con el mismo
// nombre—, asi que renombrar la tabla y dejar la ruta vieja habria dejado el nombre muerto en el
// espacio de URLs y dos nombres para la misma cosa.
router.post("/generadores_de_documento/sync", requireSqlAdminPermission({ resource: "templates", action: "update" }), syncTemplateSeeds);
router.get("/generadores_de_documento/:id/preview", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateSeedPreview);
router.get("/generadores_de_documento/:id/download", requireSqlAdminPermission({ resource: "templates", action: "read" }), downloadTemplateSeedArchive);
router.get("/ediciones/:id/download", requireSqlAdminPermission({ resource: "templates", action: "read" }), downloadTemplateArtifactArchive);
router.get("/ediciones/:id/schema", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateArtifactSchema);
router.patch("/ediciones/:id/active", requireSqlAdminPermission({ resource: "templates", action: "update" }), setTemplateArtifactActive);
router.post("/ediciones/:id/version", requireSqlAdminPermission({ resource: "templates", action: "create" }), createTemplateArtifactVersion);
router.patch("/ediciones/:id/publish", requireSqlAdminPermission({ resource: "templates", action: "update" }), publishTemplateArtifact);
router.patch("/ediciones/:id/retire", requireSqlAdminPermission({ resource: "templates", action: "update" }), retireTemplateArtifact);
router.get("/ediciones/versions", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateVersions);
router.post("/ediciones/use-in-config", requireSqlAdminPermission({ resource: "templates", action: "update" }), useTemplateVersionInConfig);
router.post("/ediciones/guided-update", requireSqlAdminPermission({ resource: "templates", action: "update" }), startGuidedTemplateUpdate);
router.post("/ediciones/guided-update/finish", requireSqlAdminPermission({ resource: "templates", action: "update" }), finishGuidedTemplateUpdate);
router.get("/process_definitions/:id/activation-diff", requireSqlAdminPermission({ resource: "templates", action: "read" }), getConfigActivationDiff);
router.get("/process_definitions/:id/target-scope", requireSqlAdminPermission({ resource: "templates", action: "read" }), getProcessTargetScope);
router.get("/process_definitions/:id/resolvable-cargos", requireSqlAdminPermission({ resource: "templates", action: "read" }), listResolvableCargos);
router.post("/task-items/reconcile-assignments", requireAnyRole(["AdminSistema"]), reconcileTaskItemAssignments);
router.get("/task-items/stuck", requireSqlAdminPermission({ resource: "templates", action: "read" }), listStuckTaskItems);
router.post("/task-items/:id/handover", requireSqlAdminPermission({ resource: "templates", action: "update" }), handoverTaskItem);
// Leer el historial pide `read`, no `update`: consultar por qué cambió un responsable no debería
// exigir permiso para cambiarlo. Mismo criterio que `/task-items/stuck`, justo arriba.
router.get("/task-items/:id/handovers", requireSqlAdminPermission({ resource: "templates", action: "read" }), listTaskItemHandovers);
router.get("/process_definitions/:id/series-scope", requireSqlAdminPermission({ resource: "templates", action: "read" }), getProcessDefinitionSeriesScope);
// Edición de código LaTeX: descarga/re-subida del contrato. SOLO AdminSistema (es código ejecutable).
router.get("/ediciones/:id/source", requireAnyRole(["AdminSistema"]), downloadTemplateArtifactSource);
router.post(
  "/ediciones/:id/source",
  requireAnyRole(["AdminSistema"]),
  draftArtifactUpload.single("source"),
  applyTemplateArtifactSource
);
router.post(
  "/ediciones/draft",
  requireSqlAdminPermission({ resource: "templates", action: "create" }),
  draftArtifactUpload.fields([
    { name: "pdf_file", maxCount: 1 },
    { name: "docx_file", maxCount: 1 },
    { name: "xlsx_file", maxCount: 1 },
    { name: "pptx_file", maxCount: 1 }
  ]),
  createTemplateArtifactDraft
);
router.put(
  "/ediciones/draft/:id",
  requireSqlAdminPermission({ resource: "templates", action: "update" }),
  draftArtifactUpload.fields([
    { name: "pdf_file", maxCount: 1 },
    { name: "docx_file", maxCount: 1 },
    { name: "xlsx_file", maxCount: 1 },
    { name: "pptx_file", maxCount: 1 }
  ]),
  updateTemplateArtifactDraft
);
router.get("/processes/graph", requireSqlAdminPermission({ table: "processes", action: "read" }), getProcessGraph);
router.post("/processes/with-parent", requireSqlAdminPermission({ table: "processes", action: "create" }), createProcessWithParent);
router.get("/processes/:id/detail", requireSqlAdminPermission({ table: "processes", action: "read" }), getProcessDetail);
router.patch("/processes/:id/parent", requireSqlAdminPermission({ table: "processes", action: "update" }), setProcessParent);
router.get("/units/graph", requireSqlAdminPermission({ resource: "units", action: "read" }), getUnitGraph);
router.post("/units/with-parent", requireSqlAdminPermission({ resource: "units", action: "create" }), createUnitWithParent);
router.get("/units/:id/detail", requireSqlAdminPermission({ resource: "units", action: "read" }), getUnitDetail);
router.get("/units/:id/processes", requireSqlAdminPermission({ resource: "units", action: "read" }), getUnitProcesses);
router.get("/units/:id/attachable-processes", requireSqlAdminPermission({ resource: "units", action: "read" }), getUnitAttachableProcesses);
router.post("/units/:id/positions", requireSqlAdminPermission({ resource: "people", action: "create" }), addUnitPosition);
router.put("/units/positions/:positionId", requireSqlAdminPermission({ resource: "people", action: "update" }), updateUnitPosition);
router.delete("/units/positions/:positionId", requireSqlAdminPermission({ resource: "people", action: "delete" }), removeUnitPosition);
router.post("/units/positions/:positionId/assign", requireSqlAdminPermission({ resource: "people", action: "update" }), assignUnitPosition);
router.post("/units/positions/:positionId/unassign", requireSqlAdminPermission({ resource: "people", action: "update" }), unassignUnitPosition);
router.get("/:table", requireSqlAdminPermission(), listSqlRows);
router.post("/:table", requireSqlAdminPermission(), createSqlRow);
router.put("/:table", requireSqlAdminPermission(), updateSqlRow);
router.delete("/:table", requireSqlAdminPermission(), deleteSqlRow);

// AL FINAL y DESPUÉS de las rutas: Express reconoce los manejadores de error por su aridad de
// cuatro argumentos, así que esto no intercepta ninguna petición normal.
//
// Este router NO lo tenía montado, y ya le hacía falta antes del `fileFilter`: los límites de multer
// (`LIMIT_FILE_SIZE` de 30 MB, `LIMIT_FILE_COUNT`) sí se disparaban, nadie los recogía, y Express
// contestaba su página HTML con el stack trace completo — rutas absolutas del contenedor incluidas.
// Es el mismo defecto 1.1 que `040a9d0` cerró en `user_router` y `dossier_router`.
router.use(handleUploadError);

export default router;
