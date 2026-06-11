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
  updateTemplateArtifactStage,
  createTemplateArtifactVersion,
  getTemplateArtifactSyncStatus,
  resyncTemplateArtifactWorkflows,
  listSqlRows,
  createSqlRow,
  updateSqlRow,
  deleteSqlRow
} from "../controllers/admin/sql_admin_controller.js";
import { requireAnyRole, requireSqlAdminPermission } from "../middlewares/rbac.js";
import { MANAGEMENT_ROLES } from "../config/rbacPolicy.js";

const router = new Router();
const draftArtifactUpload = multer({ storage: multer.memoryStorage() });

router.get("/meta", requireAnyRole(MANAGEMENT_ROLES), getSqlMeta);
router.get("/stats/operation", requireAnyRole(MANAGEMENT_ROLES), getOperationStats);
router.post("/template_seeds/sync", requireSqlAdminPermission({ resource: "templates", action: "update" }), syncTemplateSeeds);
router.get("/template_seeds/:id/preview", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateSeedPreview);
router.get("/template_seeds/:id/download", requireSqlAdminPermission({ resource: "templates", action: "read" }), downloadTemplateSeedArchive);
router.get("/template_artifacts/:id/download", requireSqlAdminPermission({ resource: "templates", action: "read" }), downloadTemplateArtifactArchive);
router.get("/template_artifacts/:id/schema", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateArtifactSchema);
router.patch("/template_artifacts/:id/stage", requireSqlAdminPermission({ resource: "templates", action: "update" }), updateTemplateArtifactStage);
router.post("/template_artifacts/:id/version", requireSqlAdminPermission({ resource: "templates", action: "create" }), createTemplateArtifactVersion);
router.get("/template_artifacts/:id/sync-status", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateArtifactSyncStatus);
router.post("/template_artifacts/:id/resync", requireSqlAdminPermission({ resource: "templates", action: "update" }), resyncTemplateArtifactWorkflows);
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
router.get("/:table", requireSqlAdminPermission(), listSqlRows);
router.post("/:table", requireSqlAdminPermission(), createSqlRow);
router.put("/:table", requireSqlAdminPermission(), updateSqlRow);
router.delete("/:table", requireSqlAdminPermission(), deleteSqlRow);

export default router;
