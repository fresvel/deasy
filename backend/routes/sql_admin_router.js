import { Router } from "express";
import multer from "multer";
import {
  getSqlMeta,
  syncTemplateArtifacts,
  syncTemplateSeeds,
  getTemplateSeedPreview,
  createTemplateArtifactDraft,
  updateTemplateArtifactDraft,
  listSqlRows,
  createSqlRow,
  updateSqlRow,
  deleteSqlRow
} from "../controllers/admin/sql_admin_controller.js";
import { requireAnyRole, requireSqlAdminPermission } from "../middlewares/rbac.js";

const router = new Router();
const draftArtifactUpload = multer({ storage: multer.memoryStorage() });

router.get("/meta", requireAnyRole(["Admin", "Gestor", "Auditor"]), getSqlMeta);
router.post("/template_artifacts/sync", requireSqlAdminPermission({ resource: "processes", action: "update" }), syncTemplateArtifacts);
router.post("/template_seeds/sync", requireSqlAdminPermission({ resource: "processes", action: "update" }), syncTemplateSeeds);
router.get("/template_seeds/:id/preview", requireSqlAdminPermission({ resource: "processes", action: "read" }), getTemplateSeedPreview);
router.post(
  "/template_artifacts/draft",
  requireSqlAdminPermission({ resource: "processes", action: "create" }),
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
  requireSqlAdminPermission({ resource: "processes", action: "update" }),
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
