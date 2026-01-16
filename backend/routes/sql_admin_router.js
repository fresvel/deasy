import { Router } from "express";
import {
  getSqlMeta,
  listSqlRows,
  createSqlRow,
  updateSqlRow,
  deleteSqlRow
} from "../controllers/admin/sql_admin_controller.js";

const router = new Router();

router.get("/meta", getSqlMeta);
router.get("/:table", listSqlRows);
router.post("/:table", createSqlRow);
router.put("/:table", updateSqlRow);
router.delete("/:table", deleteSqlRow);

export default router;
