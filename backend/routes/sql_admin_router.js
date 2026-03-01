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

const router = new Router();
const draftArtifactUpload = multer({ storage: multer.memoryStorage() });

router.get("/meta", getSqlMeta);
router.post("/template_artifacts/sync", syncTemplateArtifacts);
router.post("/template_seeds/sync", syncTemplateSeeds);
router.get("/template_seeds/:id/preview", getTemplateSeedPreview);
router.post(
  "/template_artifacts/draft",
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
  draftArtifactUpload.fields([
    { name: "pdf_file", maxCount: 1 },
    { name: "docx_file", maxCount: 1 },
    { name: "xlsx_file", maxCount: 1 },
    { name: "pptx_file", maxCount: 1 }
  ]),
  updateTemplateArtifactDraft
);
router.get("/:table", listSqlRows);
router.post("/:table", createSqlRow);
router.put("/:table", updateSqlRow);
router.delete("/:table", deleteSqlRow);

export default router;
