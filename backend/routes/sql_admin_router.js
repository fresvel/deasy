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
import { MANAGEMENT_ROLES } from "../config/rbacPolicy.js";

const router = new Router();
const draftArtifactUpload = multer({ storage: multer.memoryStorage() });

router.get("/meta", requireAnyRole(MANAGEMENT_ROLES), getSqlMeta);
router.post("/template_artifacts/sync", requireSqlAdminPermission({ resource: "templates", action: "update" }), syncTemplateArtifacts);
router.post("/template_seeds/sync", requireSqlAdminPermission({ resource: "templates", action: "update" }), syncTemplateSeeds);
router.get("/template_seeds/:id/preview", requireSqlAdminPermission({ resource: "templates", action: "read" }), getTemplateSeedPreview);
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
