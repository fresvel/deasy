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
  listStuckTaskItems,
  getImmediateBoss,
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
import { MANAGEMENT_ROLES } from "../config/rbacPolicy.js";

const router = new Router();
// memoryStorage sin límites deja que una subida grande agote la RAM del proceso.
// 30 MB por fichero es el mismo tope que usa `uploadDeliverable` en user_router.
const draftArtifactUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 4 }
});

router.get("/meta", requireAnyRole(MANAGEMENT_ROLES), getSqlMeta);
router.get("/stats/operation", requireAnyRole(MANAGEMENT_ROLES), getOperationStats);
router.post("/template_seeds/sync", requireSqlAdminPermission({ resource: "templates", action: "update" }), syncTemplateSeeds);
router.get("/template_seeds/:id/preview", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateSeedPreview);
router.get("/template_seeds/:id/download", requireSqlAdminPermission({ resource: "templates", action: "read" }), downloadTemplateSeedArchive);
router.get("/template_artifacts/:id/download", requireSqlAdminPermission({ resource: "templates", action: "read" }), downloadTemplateArtifactArchive);
router.get("/template_artifacts/:id/schema", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateArtifactSchema);
router.patch("/template_artifacts/:id/active", requireSqlAdminPermission({ resource: "templates", action: "update" }), setTemplateArtifactActive);
router.post("/template_artifacts/:id/version", requireSqlAdminPermission({ resource: "templates", action: "create" }), createTemplateArtifactVersion);
router.patch("/template_artifacts/:id/publish", requireSqlAdminPermission({ resource: "templates", action: "update" }), publishTemplateArtifact);
router.patch("/template_artifacts/:id/retire", requireSqlAdminPermission({ resource: "templates", action: "update" }), retireTemplateArtifact);
router.get("/template_artifacts/versions", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateVersions);
router.post("/template_artifacts/use-in-config", requireSqlAdminPermission({ resource: "templates", action: "update" }), useTemplateVersionInConfig);
router.post("/template_artifacts/guided-update", requireSqlAdminPermission({ resource: "templates", action: "update" }), startGuidedTemplateUpdate);
router.post("/template_artifacts/guided-update/finish", requireSqlAdminPermission({ resource: "templates", action: "update" }), finishGuidedTemplateUpdate);
router.get("/process_definitions/:id/activation-diff", requireSqlAdminPermission({ resource: "templates", action: "read" }), getConfigActivationDiff);
router.get("/process_definitions/:id/target-scope", requireSqlAdminPermission({ resource: "templates", action: "read" }), getProcessTargetScope);
router.get("/process_definitions/:id/resolvable-cargos", requireSqlAdminPermission({ resource: "templates", action: "read" }), listResolvableCargos);
router.post("/task-items/reconcile-assignments", requireAnyRole(["AdminSistema"]), reconcileTaskItemAssignments);
router.get("/task-items/stuck", requireSqlAdminPermission({ resource: "templates", action: "read" }), listStuckTaskItems);
router.post("/task-items/:id/handover", requireSqlAdminPermission({ resource: "templates", action: "update" }), handoverTaskItem);
router.get("/positions/:id/immediate-boss", requireSqlAdminPermission({ resource: "templates", action: "read" }), getImmediateBoss);
router.get("/process_definitions/:id/series-scope", requireSqlAdminPermission({ resource: "templates", action: "read" }), getProcessDefinitionSeriesScope);
// Edición de código LaTeX: descarga/re-subida del contrato. SOLO AdminSistema (es código ejecutable).
router.get("/template_artifacts/:id/source", requireAnyRole(["AdminSistema"]), downloadTemplateArtifactSource);
router.post(
  "/template_artifacts/:id/source",
  requireAnyRole(["AdminSistema"]),
  draftArtifactUpload.single("source"),
  applyTemplateArtifactSource
);
router.post(
  "/template_artifacts/draft",
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
  "/template_artifacts/draft/:id",
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

export default router;
