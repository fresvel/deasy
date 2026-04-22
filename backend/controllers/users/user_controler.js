import path from "path";
import os from "os";
import fs from "fs-extra";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { pipeline } from "stream/promises";
import whatsappBot from "../../services/whatsapp/WhatsAppBot.js";
import UserRepository from "../../services/auth/UserRepository.js";
import { getMariaDBPool } from "../../config/mariadb.js";
import { hydrateTaskFromDefinition } from "../../services/admin/TaskGenerationService.js";
import { sendEmailVerification } from "../../services/mail/sendEmailVerification.js";
import { generateUniqueToken } from "../../utils/tokenGenerator.js";
import {
  ensureBucketExists,
  minioClient,
  uploadFileToMinio,
  statMinioObject,
  getMinioObjectStream
} from "../../services/storage/minio_service.js";
import { transitionDocumentVersionState } from "../../services/documents/DocumentStateService.js";
import { resetDocumentWorkflowForTaskItem } from "../../services/documents/DocumentWorkflowResetService.js";
import SqlAdminService from "../../services/admin/SqlAdminService.js";


const userRepository = new UserRepository();
const sqlAdminService = new SqlAdminService();
const MINIO_SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || "deasy-spool";
const MINIO_DOCUMENTS_BUCKET = process.env.MINIO_DOCUMENTS_BUCKET || "deasy-documents";
const MINIO_DOCUMENTS_PREFIX = String(process.env.MINIO_DOCUMENTS_PREFIX || "Unidades").replace(/^\/+|\/+$/g, "");
const MINIO_TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";
const TEMPLATE_DOWNLOAD_EXCLUDED_FORMATS = new Set(["latex", "jinja2"]);

const sanitizeStorageSegment = (value, fallback = "na") =>
  String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;

const buildDocumentVersionFolder = (sequenceValue) => {
  const sequence = Math.max(1, Number(sequenceValue || 1));
  return `v${String(sequence).padStart(4, "0")}`;
};

const buildCanonicalDocumentVersionBasePath = (target) => {
  const year =
    Number(target.term_year) ||
    Number(String(target.term_start_date || "").slice(0, 4)) ||
    new Date().getFullYear();
  const versionFolder = buildDocumentVersionFolder(target.document_version_sequence);
  return [
    String(target.scope_unit_id),
    "PROCESOS",
    String(target.process_id),
    "ANIOS",
    String(year),
    "TIPOS_PERIODO",
    String(target.term_type_id),
    "PERIODOS",
    String(target.term_id),
    "TAREAS",
    String(target.task_id),
    "Documentos",
    String(target.document_id),
    versionFolder
  ].join("/");
};

const buildWorkingObjectPathForUpload = ({ basePath, originalName, extension }) => {
  const safeOriginalName = sanitizeStorageSegment(originalName, `archivo.${extension || "bin"}`);
  const safeExtension = sanitizeStorageSegment(extension || "bin", "bin").toLowerCase();
  return [
    basePath,
    "working",
    safeExtension,
    `${Date.now()}-${randomUUID()}-${safeOriginalName}`
  ].join("/");
};

const resolveStoredDocumentObject = (storedPath) => {
  const normalizedPath = String(storedPath || "").trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return null;
  }
  if (normalizedPath.startsWith(`${MINIO_DOCUMENTS_PREFIX}/`)) {
    return {
      bucket: MINIO_DOCUMENTS_BUCKET,
      objectName: normalizedPath,
      relativePath: normalizedPath.slice(MINIO_DOCUMENTS_PREFIX.length + 1)
    };
  }
  return {
    bucket: MINIO_DOCUMENTS_BUCKET,
    objectName: `${MINIO_DOCUMENTS_PREFIX}/${normalizedPath}`,
    relativePath: normalizedPath
  };
};

const parseAvailableFormats = (value) => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const listMinioObjects = (bucket, prefix, recursive = true) =>
  new Promise((resolve, reject) => {
    const entries = [];
    const stream = minioClient.listObjectsV2(bucket, String(prefix || "").replace(/^\/+/, ""), recursive);
    stream.on("data", (item) => {
      if (item?.name) {
        entries.push(item.name);
      }
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(entries));
  });

const collectDeliverableTemplateResources = async (availableFormats) => {
  const resources = [];
  for (const [mode, modeEntries] of Object.entries(availableFormats || {})) {
    if (!modeEntries || typeof modeEntries !== "object" || Array.isArray(modeEntries)) {
      continue;
    }
    for (const [format, formatEntry] of Object.entries(modeEntries)) {
      const normalizedFormat = String(format || "").trim().toLowerCase();
      if (!normalizedFormat || TEMPLATE_DOWNLOAD_EXCLUDED_FORMATS.has(normalizedFormat)) {
        continue;
      }
      const entryPrefix = String(formatEntry?.entry_object_key || "").trim().replace(/^\/+/, "");
      if (!entryPrefix) {
        continue;
      }
      const objectNames = await listMinioObjects(MINIO_TEMPLATES_BUCKET, entryPrefix, true);
      for (const objectName of objectNames) {
        const cleanObjectName = String(objectName || "").trim();
        if (!cleanObjectName || cleanObjectName.endsWith("/")) {
          continue;
        }
        const relativeName = cleanObjectName.startsWith(entryPrefix)
          ? cleanObjectName.slice(entryPrefix.length).replace(/^\/+/, "")
          : path.basename(cleanObjectName);
        if (!relativeName || path.basename(relativeName).startsWith(".")) {
          continue;
        }
        resources.push({
          mode,
          format: normalizedFormat,
          objectName: cleanObjectName,
          archiveName: path.posix.join(mode, normalizedFormat, relativeName.replace(/\\/g, "/"))
        });
      }
    }
  }
  return resources;
};

const writeMinioObjectToFile = async (bucket, objectName, destinationPath) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  await fs.ensureDir(path.dirname(destinationPath));
  await pipeline(stream, fs.createWriteStream(destinationPath));
};

const createZipArchive = async (cwd, outputPath) =>
  new Promise((resolve, reject) => {
    const zipProcess = spawn("zip", ["-rq", outputPath, "."], { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    zipProcess.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });
    zipProcess.on("error", reject);
    zipProcess.on("close", (code) => {
      if (code === 0) {
        resolve(true);
        return;
      }
      reject(new Error(stderr.trim() || "No se pudo generar el ZIP de la plantilla."));
    });
  });

const getNumericUserId = (req) => {
  const userIdRaw = req.params?.id ?? req.query?.user_id ?? req.query?.userId ?? req.body?.user_id ?? req.body?.userId;
  const userId = Number(userIdRaw);
  return Number.isNaN(userId) ? null : userId;
};

const getActiveUserPositions = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       up.id AS position_id,
       up.title AS position_title,
       u.id AS unit_id,
       u.name AS unit_name,
       u.label AS unit_label,
       u.unit_type_id,
       c.id AS cargo_id,
       c.name AS cargo_name
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     INNER JOIN units u ON u.id = up.unit_id
     INNER JOIN cargos c ON c.id = up.cargo_id
     WHERE pa.person_id = ?
       AND pa.is_current = 1
       AND up.is_active = 1
       AND u.is_active = 1
       AND c.is_active = 1
     ORDER BY u.name, c.name, up.slot_no, up.id`,
    [userId]
  );
  return rows;
};

const getAuthenticatedUserId = (req) => {
  const userId = Number(req.user?.uid);
  return Number.isNaN(userId) ? null : userId;
};

const getOrgChildrenMap = async (pool) => {
  const [rows] = await pool.query(
    `SELECT ur.parent_unit_id, ur.child_unit_id
     FROM unit_relations ur
     INNER JOIN relation_unit_types rt
       ON rt.id = ur.relation_type_id
      AND rt.code = 'org'`
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.parent_unit_id)) {
      map.set(row.parent_unit_id, []);
    }
    map.get(row.parent_unit_id).push(row.child_unit_id);
  });
  return map;
};

const createUnitSubtreeResolver = (childrenByUnit) => {
  const cache = new Map();
  return (unitId) => {
    if (!unitId) {
      return new Set();
    }
    const normalizedUnitId = Number(unitId);
    if (cache.has(normalizedUnitId)) {
      return cache.get(normalizedUnitId);
    }
    const visited = new Set([normalizedUnitId]);
    const stack = [normalizedUnitId];
    while (stack.length) {
      const current = stack.pop();
      const children = childrenByUnit.get(current) || [];
      children.forEach((childId) => {
        const normalizedChildId = Number(childId);
        if (!visited.has(normalizedChildId)) {
          visited.add(normalizedChildId);
          stack.push(normalizedChildId);
        }
      });
    }
    cache.set(normalizedUnitId, visited);
    return visited;
  };
};

const doesPositionMatchRule = (position, rule, getUnitSubtree) => {
  if (rule.position_id) {
    return Number(position.position_id) === Number(rule.position_id);
  }
  if (rule.recipient_policy === "exact_position") {
    return false;
  }
  if (rule.cargo_id && Number(position.cargo_id) !== Number(rule.cargo_id)) {
    return false;
  }
  switch (rule.unit_scope_type) {
    case "all_units":
      return true;
    case "unit_type":
      return rule.unit_type_id && Number(position.unit_type_id) === Number(rule.unit_type_id);
    case "unit_subtree":
      return rule.unit_id && getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
    case "unit_exact":
    default:
      if (!rule.unit_id) {
        return false;
      }
      if (Number(position.unit_id) === Number(rule.unit_id)) {
        return true;
      }
      if (Number(rule.include_descendants) === 1) {
        return getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
      }
      return false;
  }
};

const getDefinitionContext = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       pdv.id,
       pdv.process_id,
       pdv.series_id,
       pdv.variation_key,
       pdv.definition_version,
       pdv.name,
       pdv.description,
       pdv.has_document,
       pdv.status,
       pdv.effective_from,
       pdv.effective_to,
       p.name AS process_name,
       p.slug AS process_slug,
       pds.code AS series_code,
       pds.source_type AS series_source_type,
       CASE
         WHEN pds.source_type = 'unit_type' THEN ut.name
         WHEN pds.source_type = 'cargo' THEN c.name
         ELSE NULL
       END AS series_source_name
     FROM process_definition_versions pdv
     INNER JOIN processes p ON p.id = pdv.process_id
     LEFT JOIN process_definition_series pds ON pds.id = pdv.series_id
     LEFT JOIN unit_types ut ON ut.id = pds.unit_type_id
     LEFT JOIN cargos c ON c.id = pds.cargo_id
     WHERE pdv.id = ?
     LIMIT 1`,
    [definitionId]
  );
  return rows[0] || null;
};

const getActiveDefinitionRules = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       ptr.id,
       ptr.unit_scope_type,
       ptr.unit_id,
       ptr.unit_type_id,
       ptr.include_descendants,
       ptr.cargo_id,
       ptr.position_id,
       ptr.recipient_policy,
       ptr.priority,
       ptr.is_active,
       ptr.effective_from,
       ptr.effective_to,
       u.name AS unit_name,
       ut.name AS unit_type_name,
       c.name AS cargo_name,
       up.title AS position_title
     FROM process_target_rules ptr
     LEFT JOIN units u ON u.id = ptr.unit_id
     LEFT JOIN unit_types ut ON ut.id = ptr.unit_type_id
     LEFT JOIN cargos c ON c.id = ptr.cargo_id
     LEFT JOIN unit_positions up ON up.id = ptr.position_id
     WHERE ptr.process_definition_id = ?
       AND ptr.is_active = 1
       AND (ptr.effective_from IS NULL OR ptr.effective_from <= CURDATE())
       AND (ptr.effective_to IS NULL OR ptr.effective_to >= CURDATE())
     ORDER BY ptr.priority ASC, ptr.id ASC`,
    [definitionId]
  );
  return rows;
};

const buildRuleDisplayLabel = (rule) => {
  if (rule.position_title) {
    return `Puesto exacto: ${rule.position_title}`;
  }
  const parts = [];
  if (rule.unit_scope_type === "all_units") {
    parts.push("Todas las unidades");
  } else if (rule.unit_scope_type === "unit_type" && rule.unit_type_name) {
    parts.push(`Tipo: ${rule.unit_type_name}`);
  } else if ((rule.unit_scope_type === "unit_exact" || rule.unit_scope_type === "unit_subtree") && rule.unit_name) {
    parts.push(rule.unit_scope_type === "unit_subtree" ? `Unidad y jerarquía: ${rule.unit_name}` : `Unidad: ${rule.unit_name}`);
  }
  if (rule.cargo_name) {
    parts.push(`Cargo: ${rule.cargo_name}`);
  }
  return parts.join(" | ") || `Regla #${rule.id}`;
};

const getActiveDefinitionTriggers = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       pdt.id,
       pdt.trigger_mode,
       pdt.term_type_id,
       pdt.is_active,
       tt.code AS term_type_code,
       tt.name AS term_type_name
     FROM process_definition_triggers pdt
     LEFT JOIN term_types tt ON tt.id = pdt.term_type_id
     WHERE pdt.process_definition_id = ?
       AND pdt.is_active = 1
     ORDER BY pdt.trigger_mode ASC, pdt.id ASC`,
    [definitionId]
  );
  return rows;
};

const getDefinitionTemplates = async (pool, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       pdt.id,
       pdt.usage_role,
       pdt.creates_task,
       pdt.is_required,
       pdt.sort_order,
       tar.id AS template_artifact_id,
       tar.display_name AS template_artifact_name,
       tar.artifact_origin,
       tar.artifact_stage,
       COUNT(DISTINCT sft.id) AS signature_flow_count
     FROM process_definition_templates pdt
     INNER JOIN template_artifacts tar ON tar.id = pdt.template_artifact_id
     LEFT JOIN signature_flow_templates sft
       ON sft.process_definition_template_id = pdt.id
      AND sft.is_active = 1
     WHERE pdt.process_definition_id = ?
     GROUP BY
       pdt.id,
       pdt.usage_role,
       pdt.creates_task,
       pdt.is_required,
       pdt.sort_order,
       tar.id,
       tar.display_name,
       tar.artifact_origin,
       tar.artifact_stage
     ORDER BY pdt.sort_order ASC, pdt.id ASC`,
    [definitionId]
  );
  return rows;
};

const getAvailableTerms = async (pool) => {
  const [rows] = await pool.query(
    `SELECT
       t.id,
       t.name,
       t.start_date,
       t.end_date,
       tt.id AS term_type_id,
       tt.code AS term_type_code,
       tt.name AS term_type_name
     FROM terms t
     INNER JOIN term_types tt ON tt.id = t.term_type_id
     WHERE t.is_active = 1
     ORDER BY t.start_date DESC, t.id DESC
     LIMIT 40`
  );
  return rows;
};

const getUserOwnedTemplateArtifacts = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT
       id,
       display_name,
       description,
       artifact_stage,
       available_formats,
       created_at
     FROM template_artifacts
     WHERE owner_person_id = ?
       AND artifact_origin = 'general'
       AND is_active = 1
     ORDER BY created_at DESC, id DESC
     LIMIT 12`,
    [userId]
  );
  return rows;
};

const getUserAccessibleTasksForDefinition = async (pool, userId, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       t.id,
       t.term_id,
       t.launch_mode,
       t.created_by_user_id,
       t.parent_task_id,
       t.responsible_position_id,
       t.description,
       t.start_date,
       t.end_date,
       t.status,
       t.created_at,
       trm.name AS term_name,
       tt.code AS term_type_code,
       tt.name AS term_type_name,
       rp.title AS responsible_position_title
     FROM tasks t
     INNER JOIN terms trm ON trm.id = t.term_id
     INNER JOIN term_types tt ON tt.id = trm.term_type_id
     LEFT JOIN unit_positions rp ON rp.id = t.responsible_position_id
     WHERE t.process_definition_id = ?
       AND (
         t.created_by_user_id = ?
         OR EXISTS (
           SELECT 1
           FROM task_assignments ta
           LEFT JOIN position_assignments pa
             ON pa.position_id = ta.position_id
            AND pa.is_current = 1
            AND pa.person_id = ?
           WHERE ta.task_id = t.id
             AND (
               ta.assigned_person_id = ?
               OR (ta.assigned_person_id IS NULL AND pa.person_id = ?)
             )
         )
         OR EXISTS (
           SELECT 1
           FROM task_items ti
           INNER JOIN documents d ON d.task_item_id = ti.id
           INNER JOIN document_versions dv ON dv.document_id = d.id
           INNER JOIN (
             SELECT document_id, MAX(version) AS max_version
             FROM document_versions
             GROUP BY document_id
           ) latest_dv
             ON latest_dv.document_id = dv.document_id
            AND latest_dv.max_version = dv.version
           INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
           INNER JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
           WHERE ti.task_id = t.id
             AND fr.assigned_person_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM task_items ti
           INNER JOIN documents d ON d.task_item_id = ti.id
           INNER JOIN document_versions dv ON dv.document_id = d.id
           INNER JOIN (
             SELECT document_id, MAX(version) AS max_version
             FROM document_versions
             GROUP BY document_id
           ) latest_dv
             ON latest_dv.document_id = dv.document_id
            AND latest_dv.max_version = dv.version
           INNER JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
           INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
           WHERE ti.task_id = t.id
             AND sr.assigned_person_id = ?
         )
       )
     ORDER BY t.start_date DESC, t.id DESC`,
    [definitionId, userId, userId, userId, userId, userId, userId]
  );
  return rows;
};

const getTaskItemsForTaskIds = async (pool, taskIds) => {
  if (!taskIds.length) {
    return [];
  }
  const placeholders = taskIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.process_definition_template_id,
       ti.template_artifact_id,
       tar.template_seed_id,
       ti.template_usage_role,
       ti.sort_order,
       ti.responsible_position_id,
       ti.assigned_person_id,
       ti.status,
       tar.display_name AS template_artifact_name,
       rp.title AS responsible_position_title,
       d.id AS document_id,
       d.status AS document_status,
       dv.id AS document_version_id,
       dv.version AS document_version,
       dv.working_file_path,
       dv.final_file_path,
       COALESCE(sig.total_signature_count, 0) AS total_signature_count,
       COALESCE(sig.pending_signature_count, 0) AS pending_signature_count
     FROM task_items ti
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN unit_positions rp ON rp.id = ti.responsible_position_id
     LEFT JOIN documents d ON d.task_item_id = ti.id
     LEFT JOIN (
       SELECT dv1.*
       FROM document_versions dv1
       INNER JOIN (
         SELECT document_id, MAX(version) AS max_version
         FROM document_versions
         GROUP BY document_id
       ) latest
         ON latest.document_id = dv1.document_id
        AND latest.max_version = dv1.version
     ) dv ON dv.document_id = d.id
     LEFT JOIN (
       SELECT
         sfi.document_version_id,
         COUNT(sr.id) AS total_signature_count,
         SUM(CASE WHEN sr.responded_at IS NULL THEN 1 ELSE 0 END) AS pending_signature_count
       FROM signature_flow_instances sfi
       INNER JOIN document_versions dv2 ON dv2.id = sfi.document_version_id
       LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
       WHERE LOWER(COALESCE(dv2.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado',
         'firmado parcial',
         'firmado completo'
       )
       GROUP BY sfi.document_version_id
     ) sig ON sig.document_version_id = dv.id
     WHERE ti.task_id IN (${placeholders})
     ORDER BY ti.task_id ASC, ti.sort_order ASC, ti.id ASC`,
    taskIds
  );
  return rows;
};

const getAccessibleTaskItemDocumentForUser = async (pool, userId, definitionId, taskItemId) => {
  const [rows] = await pool.query(
    `SELECT
       ti.id AS task_item_id,
       t.id AS task_id,
       t.term_id,
       ti.template_usage_role,
       tar.display_name AS template_artifact_name,
       pdv.process_id,
       trm.term_type_id,
       trm.start_date AS term_start_date,
       YEAR(trm.start_date) AS term_year,
       COALESCE(task_pos.unit_id, responsible_pos.unit_id, owner_pos.unit_id) AS scope_unit_id,
       d.id AS document_id,
       dv.id AS document_version_id,
       dv.status AS document_version_status,
       dv.version AS document_version,
       dv.working_file_path,
       dv.final_file_path,
       (
         SELECT COUNT(*)
         FROM document_versions dv_seq
         WHERE dv_seq.document_id = d.id
           AND dv_seq.id <= dv.id
       ) AS document_version_sequence
     FROM task_items ti
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     INNER JOIN terms trm ON trm.id = t.term_id
     INNER JOIN documents d ON d.task_item_id = ti.id
     INNER JOIN document_versions dv ON dv.document_id = d.id
     INNER JOIN (
       SELECT document_id, MAX(version) AS max_version
       FROM document_versions
       GROUP BY document_id
     ) latest
       ON latest.document_id = dv.document_id
      AND latest.max_version = dv.version
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN unit_positions task_pos ON task_pos.id = t.responsible_position_id
     LEFT JOIN unit_positions responsible_pos ON responsible_pos.id = ti.responsible_position_id
     LEFT JOIN persons owner_person ON owner_person.id = d.owner_person_id
     LEFT JOIN position_assignments owner_pa
       ON owner_pa.person_id = owner_person.id
      AND owner_pa.is_current = 1
     LEFT JOIN unit_positions owner_pos ON owner_pos.id = owner_pa.position_id
     WHERE ti.id = ?
       AND t.process_definition_id = ?
       AND (
         t.created_by_user_id = ?
         OR EXISTS (
           SELECT 1
           FROM task_assignments ta
           LEFT JOIN position_assignments pa
             ON pa.position_id = ta.position_id
            AND pa.is_current = 1
            AND pa.person_id = ?
           WHERE ta.task_id = t.id
             AND (
               ta.assigned_person_id = ?
               OR (ta.assigned_person_id IS NULL AND pa.person_id = ?)
             )
         )
         OR EXISTS (
           SELECT 1
           FROM document_fill_flows dff
           INNER JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
           WHERE dff.document_version_id = dv.id
             AND fr.assigned_person_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM signature_flow_instances sfi
           INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
           WHERE sfi.document_version_id = dv.id
             AND sr.assigned_person_id = ?
         )
       )
     LIMIT 1`,
    [taskItemId, definitionId, userId, userId, userId, userId, userId, userId]
  );
  return rows?.[0] || null;
};

const getUserPendingSignaturesForDefinition = async (pool, userId, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       sr.id,
       sr.requested_at,
       sr.responded_at,
       srs.name AS status_name,
       sfs.step_order,
       st.name AS signature_type_name,
       tar.display_name AS template_artifact_name,
       d.id AS document_id,
       dv.id AS document_version_id,
       dv.version AS document_version
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN documents d ON d.id = dv.document_id
     INNER JOIN task_items ti ON ti.id = d.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     INNER JOIN process_definition_templates pdt ON pdt.id = ti.process_definition_template_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     LEFT JOIN signature_types st ON st.id = sfs.step_type_id
     WHERE sr.assigned_person_id = ?
       AND t.process_definition_id = ?
       AND LOWER(COALESCE(dv.status, '')) IN (
         'listo para firma',
         'pendiente de firma',
         'firmado',
         'firmado parcial',
         'firmado completo'
       )
     ORDER BY sr.responded_at IS NOT NULL ASC, sr.requested_at DESC, sr.id DESC
     LIMIT 12`,
    [userId, definitionId]
  );
  return rows;
};

const getSignatureWorkflowRequestsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       sfi.document_version_id,
       sr.id,
       sr.assigned_person_id,
       sr.requested_at,
       sr.responded_at,
       srs.code AS request_status_code,
       srs.name AS status_name,
       sfs.step_order,
       st.name AS signature_type_name,
       c.name AS cargo_name,
       tar.display_name AS template_artifact_name,
       d.id AS document_id,
       dv.id AS document_version_id,
       dv.version AS document_version,
       TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS assigned_person_name
     FROM signature_flow_instances sfi
     INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
     INNER JOIN documents d ON d.id = dv.document_id
     INNER JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
     LEFT JOIN persons p ON p.id = sr.assigned_person_id
     LEFT JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     LEFT JOIN signature_types st ON st.id = sfs.step_type_id
     LEFT JOIN cargos c ON c.id = sfs.required_cargo_id
     WHERE sfi.document_version_id IN (${placeholders})
     ORDER BY sfi.document_version_id ASC, sfs.step_order ASC, sr.id ASC`,
    documentVersionIds
  );
  return rows;
};

const getUserPendingFillRequestsForDefinition = async (pool, userId, definitionId) => {
  const [rows] = await pool.query(
    `SELECT
       fr.id,
       fr.requested_at,
       fr.responded_at,
       fr.status AS status_name,
       ffs.step_order,
       tar.display_name AS template_artifact_name,
       d.id AS document_id,
       dv.id AS document_version_id,
       dv.version AS document_version
     FROM fill_requests fr
     INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
     INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
     INNER JOIN document_versions dv ON dv.id = dff.document_version_id
     INNER JOIN documents d ON d.id = dv.document_id
     INNER JOIN task_items ti ON ti.id = d.task_item_id
     INNER JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     WHERE fr.assigned_person_id = ?
       AND t.process_definition_id = ?
       AND LOWER(COALESCE(dv.status, '')) IN (
         'pendiente de llenado',
         'en llenado',
         'en revisión de llenado',
         'observado'
       )
     ORDER BY fr.responded_at IS NOT NULL ASC, fr.requested_at DESC, fr.id DESC
     LIMIT 12`,
    [userId, definitionId]
  );
  return rows;
};

const getFillWorkflowStepsForDocumentVersions = async (pool, documentVersionIds) => {
  if (!documentVersionIds.length) {
    return [];
  }
  const placeholders = documentVersionIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT
       dff.document_version_id,
       dff.status AS fill_flow_status,
       dff.current_step_order,
       ffs.id AS fill_flow_step_id,
       ffs.step_order,
       ffs.resolver_type,
       ffs.selection_mode,
       ffs.is_required,
       ffs.can_reject,
       fr.id AS fill_request_id,
       fr.assigned_person_id,
       fr.is_manual,
       fr.status AS request_status,
       fr.requested_at,
       fr.responded_at,
       fr.response_note,
       TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS assigned_person_name,
       c.name AS cargo_name,
       up.title AS position_title,
       u.name AS unit_name,
       ut.name AS unit_type_name
     FROM document_fill_flows dff
     INNER JOIN fill_flow_steps ffs ON ffs.fill_flow_template_id = dff.fill_flow_template_id
     LEFT JOIN fill_requests fr
       ON fr.document_fill_flow_id = dff.id
      AND fr.fill_flow_step_id = ffs.id
     LEFT JOIN persons p ON p.id = COALESCE(fr.assigned_person_id, ffs.assigned_person_id)
     LEFT JOIN cargos c ON c.id = ffs.cargo_id
     LEFT JOIN unit_positions up ON up.id = ffs.position_id
     LEFT JOIN units u ON u.id = ffs.unit_id
     LEFT JOIN unit_types ut ON ut.id = ffs.unit_type_id
     WHERE dff.document_version_id IN (${placeholders})
     ORDER BY dff.document_version_id ASC, ffs.step_order ASC, fr.id ASC`,
    documentVersionIds
  );
  return rows;
};

const buildFillStepDisplayLabel = (step) => {
  const resolverType = String(step.resolver_type || "").trim();
  if (step.assigned_person_name) {
    return step.assigned_person_name;
  }
  switch (resolverType) {
    case "document_owner":
      return "Propietario del documento";
    case "task_assignee":
      return "Responsable de la tarea";
    case "specific_person":
      return "Persona específica";
    case "position":
      return step.position_title || "Puesto definido";
    case "cargo_in_scope":
      if (step.cargo_name && step.unit_name) {
        return `${step.cargo_name} · ${step.unit_name}`;
      }
      if (step.cargo_name && step.unit_type_name) {
        return `${step.cargo_name} · ${step.unit_type_name}`;
      }
      return step.cargo_name || "Cargo según alcance";
    case "manual_pick":
      return "Selección manual";
    default:
      return "Responsable no resuelto";
  }
};

const isPendingLikeFillStatus = (value) =>
  ["pending", "in_progress"].includes(String(value || "").trim().toLowerCase());

const isPendingLikeSignatureStatus = (value) =>
  ["pendiente", "pending", "en_progreso", "in_progress"].includes(String(value || "").trim().toLowerCase());

const canCurrentUserResetWorkflow = ({ userId, fillWorkflow, signatureRequests }) => {
  const normalizedUserId = Number(userId || 0);
  if (!normalizedUserId) return false;

  const currentFillStepOrder = Number(fillWorkflow?.current_step_order || 0);
  if (currentFillStepOrder > 0) {
    const canResetFromFill = (fillWorkflow?.steps || []).some((step) =>
      Number(step?.step_order || 0) === currentFillStepOrder
      && Number(step?.assigned_person_id || 0) === normalizedUserId
      && isPendingLikeFillStatus(step?.request_status)
      && !step?.responded_at
    );
    if (canResetFromFill) {
      return true;
    }
  }

  const pendingSignatureRequests = (Array.isArray(signatureRequests) ? signatureRequests : [])
    .filter((request) => isPendingLikeSignatureStatus(request?.request_status_code || request?.status_name || request?.status))
    .filter((request) => !request?.responded_at)
    .sort((a, b) => Number(a?.step_order || 0) - Number(b?.step_order || 0));

  const currentSignatureStepOrder = Number(pendingSignatureRequests[0]?.step_order || 0);
  if (!currentSignatureStepOrder) {
    return false;
  }

  return pendingSignatureRequests.some((request) =>
    Number(request?.step_order || 0) === currentSignatureStepOrder
    && Number(request?.assigned_person_id || 0) === normalizedUserId
  );
};

const getUserOperationalProcessRows = async (pool, userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       p.id AS process_id,
       p.name AS process_name,
       p.slug AS process_slug,
       pdv.id AS process_definition_id,
       pdv.variation_key,
       pdv.definition_version
     FROM process_definition_versions pdv
     INNER JOIN processes p ON p.id = pdv.process_id
     WHERE pdv.status = 'active'
       AND pdv.effective_from <= CURDATE()
       AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
       AND p.is_active = 1
       AND (
         EXISTS (
           SELECT 1
           FROM tasks t
           INNER JOIN task_items ti ON ti.task_id = t.id
           INNER JOIN documents d ON d.task_item_id = ti.id
           INNER JOIN document_versions dv ON dv.document_id = d.id
           INNER JOIN (
             SELECT document_id, MAX(version) AS max_version
             FROM document_versions
             GROUP BY document_id
           ) latest_dv
             ON latest_dv.document_id = dv.document_id
            AND latest_dv.max_version = dv.version
           INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
           INNER JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
           WHERE t.process_definition_id = pdv.id
             AND fr.assigned_person_id = ?
         )
         OR EXISTS (
           SELECT 1
           FROM tasks t
           INNER JOIN task_items ti ON ti.task_id = t.id
           INNER JOIN documents d ON d.task_item_id = ti.id
           INNER JOIN document_versions dv ON dv.document_id = d.id
           INNER JOIN (
             SELECT document_id, MAX(version) AS max_version
             FROM document_versions
             GROUP BY document_id
           ) latest_dv
             ON latest_dv.document_id = dv.document_id
            AND latest_dv.max_version = dv.version
           INNER JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
           INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
           WHERE t.process_definition_id = pdv.id
             AND sr.assigned_person_id = ?
         )
       )
     ORDER BY p.name ASC, pdv.id ASC`,
    [userId, userId]
  );
  return rows;
};

const getCustomTermType = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id, code, name
     FROM term_types
     WHERE code = 'CUS'
     LIMIT 1`
  );
  return rows[0] || null;
};

const buildUserProcessDefinitionPanel = async (pool, userId, definitionId) => {
  const definition = await getDefinitionContext(pool, definitionId);
  if (!definition || definition.status !== "active") {
    return null;
  }

  const positions = await getActiveUserPositions(pool, userId);
  if (!positions.length) {
    return null;
  }
  const rules = await getActiveDefinitionRules(pool, definitionId);
  const childrenByUnit = await getOrgChildrenMap(pool);
  const getUnitSubtree = createUnitSubtreeResolver(childrenByUnit);
  const matchingRules = rules.filter((rule) => positions.some((position) => doesPositionMatchRule(position, rule, getUnitSubtree)));
  const tasks = await getUserAccessibleTasksForDefinition(pool, userId, definitionId);
  const fillRequests = await getUserPendingFillRequestsForDefinition(pool, userId, definitionId);
  const signatures = await getUserPendingSignaturesForDefinition(pool, userId, definitionId);
  const hasOperationalAccess = Boolean(matchingRules.length || tasks.length || fillRequests.length || signatures.length);
  if (!hasOperationalAccess) {
    return null;
  }

  const triggers = await getActiveDefinitionTriggers(pool, definitionId);
  const templates = await getDefinitionTemplates(pool, definitionId);
  const terms = await getAvailableTerms(pool);
  const userPackages = await getUserOwnedTemplateArtifacts(pool, userId);
  const taskIds = tasks.map((task) => task.id);
  const taskItems = await getTaskItemsForTaskIds(pool, taskIds);
  const taskItemsByTask = new Map();
  taskItems.forEach((item) => {
    if (!taskItemsByTask.has(item.task_id)) {
      taskItemsByTask.set(item.task_id, []);
    }
    taskItemsByTask.get(item.task_id).push(item);
  });

  const fillWorkflowSteps = await getFillWorkflowStepsForDocumentVersions(
    pool,
    taskItems
      .map((item) => Number(item.document_version_id || 0))
      .filter((id) => id > 0)
  );
  const documentVersionIds = taskItems
    .map((item) => Number(item.document_version_id || 0))
    .filter((id) => id > 0);
  const signatureWorkflowRequests = await getSignatureWorkflowRequestsForDocumentVersions(pool, documentVersionIds);
  const fillRequestsByDocumentVersion = new Map();
  fillRequests.forEach((request) => {
    const key = Number(request.document_version_id);
    if (!fillRequestsByDocumentVersion.has(key)) {
      fillRequestsByDocumentVersion.set(key, []);
    }
    fillRequestsByDocumentVersion.get(key).push(request);
  });
  const userSignaturesByDocumentVersion = new Map();
  signatures.forEach((request) => {
    const key = Number(request.document_version_id);
    if (!userSignaturesByDocumentVersion.has(key)) {
      userSignaturesByDocumentVersion.set(key, []);
    }
    userSignaturesByDocumentVersion.get(key).push(request);
  });
  const signatureWorkflowRequestsByDocumentVersion = new Map();
  signatureWorkflowRequests.forEach((request) => {
    const key = Number(request.document_version_id);
    if (!signatureWorkflowRequestsByDocumentVersion.has(key)) {
      signatureWorkflowRequestsByDocumentVersion.set(key, []);
    }
    signatureWorkflowRequestsByDocumentVersion.get(key).push(request);
  });
  const fillWorkflowByDocumentVersion = new Map();
  fillWorkflowSteps.forEach((step) => {
    const key = Number(step.document_version_id);
    if (!fillWorkflowByDocumentVersion.has(key)) {
      fillWorkflowByDocumentVersion.set(key, {
        status: step.fill_flow_status,
        current_step_order: step.current_step_order ? Number(step.current_step_order) : null,
        steps: []
      });
    }
    fillWorkflowByDocumentVersion.get(key).steps.push({
      id: Number(step.fill_flow_step_id),
      step_order: Number(step.step_order),
      resolver_type: step.resolver_type,
      selection_mode: step.selection_mode,
      is_required: Boolean(step.is_required),
      can_reject: Boolean(step.can_reject),
      request_id: step.fill_request_id ? Number(step.fill_request_id) : null,
      assigned_person_id: step.assigned_person_id ? Number(step.assigned_person_id) : null,
      is_manual: Boolean(step.is_manual),
      request_status: step.request_status || "pending",
      requested_at: step.requested_at || null,
      responded_at: step.responded_at || null,
      response_note: step.response_note || null,
      assigned_person_name: step.assigned_person_name || null,
      display_label: buildFillStepDisplayLabel(step),
      cargo_name: step.cargo_name || null,
      position_title: step.position_title || null,
      unit_name: step.unit_name || null,
      unit_type_name: step.unit_type_name || null
    });
  });

  const getCurrentSignatureStepOrder = (requests = []) => {
    const pendingLike = (Array.isArray(requests) ? requests : [])
      .filter((request) => {
        const code = String(request?.request_status_code || request?.status_name || request?.status || "").trim().toLowerCase();
        return ["pendiente", "pending", "en_progreso", "in_progress"].includes(code) && !request?.responded_at;
      })
      .sort((a, b) => Number(a?.step_order || 0) - Number(b?.step_order || 0));

    return pendingLike.length ? (Number(pendingLike[0]?.step_order || 0) || null) : null;
  };

  const documents = taskItems
    .filter((item) => item.document_id)
    .map((item) => {
      const documentVersionId = Number(item.document_version_id || 0);
      const relatedFillRequests = fillRequestsByDocumentVersion.get(documentVersionId) || [];
      const relatedSignatureRequests = signatureWorkflowRequestsByDocumentVersion.get(documentVersionId) || [];
      const relatedUserSignatures = userSignaturesByDocumentVersion.get(documentVersionId) || [];
      const currentSignatureStepOrder = getCurrentSignatureStepOrder(relatedSignatureRequests);
      const fillWorkflow = fillWorkflowByDocumentVersion.get(documentVersionId) || {
        status: null,
        current_step_order: null,
        steps: []
      };
      const canManageFill = Boolean(item.document_id || relatedFillRequests.length || fillWorkflow.steps.length);
      const canSign = relatedUserSignatures.some((request) => !request.responded_at);
      const canUploadDeliverable = ["primary", "attachment"].includes(String(item.template_usage_role || ""));
      const canResetWorkflow = canCurrentUserResetWorkflow({
        userId,
        fillWorkflow,
        signatureRequests: relatedSignatureRequests,
      });
      return {
        document_id: item.document_id,
        task_id: item.task_id,
        task_item_id: item.id,
        template_artifact_id: item.template_artifact_id,
        template_artifact_name: item.template_artifact_name,
        template_usage_role: item.template_usage_role,
        document_status: item.document_status,
        document_version_id: item.document_version_id,
        document_version: item.document_version,
        working_file_path: item.working_file_path,
        final_file_path: item.final_file_path,
        pending_signature_count: item.pending_signature_count,
        total_signature_count: item.total_signature_count,
        pending_fill_count: relatedFillRequests.filter((request) => !request.responded_at).length,
        total_fill_count: relatedFillRequests.length,
        workflow: {
          fill_requests: relatedFillRequests,
          fill_flow: fillWorkflow,
          fill_steps: fillWorkflow.steps,
          signature_requests: relatedSignatureRequests,
          current_fill_step_order: fillWorkflow.current_step_order || relatedFillRequests[0]?.step_order || null,
          current_signature_step_order: currentSignatureStepOrder
        },
        actions: {
          can_upload_deliverable: canUploadDeliverable,
          can_download_template: Boolean(item.template_artifact_id),
          can_manage_fill: canManageFill,
          can_review_signature_flow: Boolean(Number(item.total_signature_count || 0) > 0 || relatedSignatureRequests.length),
          can_sign: canSign,
          can_reset_workflow: canResetWorkflow,
          can_open_process_chat: true,
          implemented: {
            upload_deliverable: false,
            download_template: false,
            manage_fill: false,
            review_signature_flow: false,
            sign: true,
            reset_workflow: true,
            process_chat: true
          }
        }
      };
    });
  const documentsByTaskItemId = new Map(
    documents
      .filter((document) => document.task_item_id)
      .map((document) => [Number(document.task_item_id), document])
  );
  const enrichedTasks = tasks.map((task) => {
    const items = (taskItemsByTask.get(task.id) || []).map((item) => {
      const relatedDocument = documentsByTaskItemId.get(Number(item.id)) || null;
      const documentVersionId = Number(item.document_version_id || relatedDocument?.document_version_id || 0);
      const relatedFillRequests = documentVersionId ? (fillRequestsByDocumentVersion.get(documentVersionId) || []) : [];
      const relatedSignatureRequests = documentVersionId ? (signatureWorkflowRequestsByDocumentVersion.get(documentVersionId) || []) : [];
      const relatedUserSignatures = documentVersionId ? (userSignaturesByDocumentVersion.get(documentVersionId) || []) : [];
      const currentSignatureStepOrder = getCurrentSignatureStepOrder(relatedSignatureRequests);
      const fillWorkflow = documentVersionId
        ? (fillWorkflowByDocumentVersion.get(documentVersionId) || { status: null, current_step_order: null, steps: [] })
        : { status: null, current_step_order: null, steps: [] };
      const canManageFill = Boolean(item.document_id || relatedFillRequests.length || fillWorkflow.steps.length);
      const canSign = relatedUserSignatures.some((request) => !request.responded_at);
      const canUploadDeliverable = ["primary", "attachment"].includes(String(item.template_usage_role || ""));
      const canResetWorkflow = canCurrentUserResetWorkflow({
        userId,
        fillWorkflow,
        signatureRequests: relatedSignatureRequests,
      });
      const actions = relatedDocument?.actions || {
        can_upload_deliverable: canUploadDeliverable,
        can_download_template: Boolean(item.template_artifact_id),
        can_manage_fill: canManageFill,
        can_review_signature_flow: Boolean(Number(item.total_signature_count || 0) > 0 || relatedSignatureRequests.length),
        can_sign: canSign,
        can_reset_workflow: canResetWorkflow,
        can_open_process_chat: true,
        implemented: {
          upload_deliverable: false,
          download_template: false,
          manage_fill: false,
          review_signature_flow: false,
          sign: true,
          reset_workflow: true,
          process_chat: true
        }
      };
      return {
        ...item,
        pending_fill_count: relatedDocument?.pending_fill_count ?? relatedFillRequests.filter((request) => !request.responded_at).length,
        total_fill_count: relatedDocument?.total_fill_count ?? relatedFillRequests.length,
        workflow: relatedDocument?.workflow || {
          fill_requests: relatedFillRequests,
          fill_flow: fillWorkflow,
          fill_steps: fillWorkflow.steps,
          signature_requests: relatedSignatureRequests,
          current_fill_step_order: fillWorkflow.current_step_order || relatedFillRequests[0]?.step_order || null,
          current_signature_step_order: currentSignatureStepOrder
        },
        actions,
        document: relatedDocument
      };
    });
    const pendingItems = items.filter((item) => item.status !== "completada" && item.status !== "cancelada").length;
    return {
      ...task,
      is_current_user_creator: Number(task.created_by_user_id) === Number(userId),
      task_item_count: items.length,
      pending_task_items: pendingItems,
      items
    };
  });

  const canLaunchManual = triggers.some((trigger) => trigger.trigger_mode === "manual_only");
  const canLaunchCustom = triggers.some((trigger) => trigger.trigger_mode === "manual_custom_term");

  return {
    definition: {
      ...definition,
      rules_count: rules.length,
      matching_rules_count: matchingRules.length,
      templates_count: templates.length,
      triggers_count: triggers.length,
      chat_context: {
        process_id: Number(definition.process_id),
        accessible_scope_unit_ids: Array.from(
          new Set(
            taskItems
              .map((item) => Number(item.scope_unit_id || 0))
              .filter((value) => Number.isFinite(value) && value > 0)
          )
        )
      }
    },
    summary: {
      tasks_total: enrichedTasks.length,
      tasks_pending: enrichedTasks.filter((task) => task.status !== "completada" && task.status !== "cancelada").length,
      task_items_pending: taskItems.filter((item) => item.status !== "completada" && item.status !== "cancelada").length,
      documents_total: documents.length,
      fill_requests_pending: fillRequests.filter((request) => !request.responded_at).length,
      signatures_pending: signatures.filter((signature) => !signature.responded_at).length,
      user_packages_total: userPackages.length
    },
    permissions: {
      can_launch_manual: canLaunchManual || canLaunchCustom,
      can_launch_custom_term: canLaunchCustom,
      can_use_existing_term: canLaunchManual || canLaunchCustom,
      has_document: Number(definition.has_document) === 1
    },
    tasks: enrichedTasks,
    documents,
    fill_requests: fillRequests,
    signatures,
    dependencies: {
      rules: matchingRules.map((rule) => ({
        ...rule,
        display_label: buildRuleDisplayLabel(rule)
      })),
      triggers,
      templates
    },
    user_packages: userPackages,
    available_terms: terms
  };
};

export const createUser = async (req, res) => {
  console.log("Creando usuario");
  try {
    const token = await generateUniqueToken(); // ← aquí, dentro del try

    const userPayload = {
      cedula: req.body.cedula,
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name ?? req.body.nombre,
      last_name: req.body.last_name ?? req.body.apellido,
      whatsapp: req.body.whatsapp,
      direccion: req.body.direccion,
      pais: req.body.pais,
      pais_residencia: req.body.pais_residencia,
      provincia_residencia: req.body.provincia_residencia,
      ciudad_residencia: req.body.ciudad_residencia,
      calle_primaria: req.body.calle_primaria,
      calle_secundaria: req.body.calle_secundaria,
      codigo_postal: req.body.codigo_postal,
      status: req.body.status,
      verify_email: req.body.verify?.email,
      verify_whatsapp: req.body.verify?.whatsapp,
      photo_url: req.body.photoUrl ?? req.body.photo_url ?? null,
      token
    };

    const createdUser = await userRepository.create(userPayload);
    console.log(`Usuario creado en MariaDB con id ${createdUser.id}`);

    try {
      await sendEmailVerification({
        userId: createdUser.id,
        email: createdUser.email
      });

      console.log("Correo de verificación enviado");
    } catch (error) {
      console.error("No se pudo enviar el correo de verificación:", error.message);
    }

    if (whatsappBot.isReady && createdUser.whatsapp) {
      try {
        const userName = `${createdUser.first_name ?? createdUser.nombre} ${createdUser.last_name ?? createdUser.apellido}`.trim();
        await whatsappBot.sendWelcomeMessage(createdUser.whatsapp, userName);
        console.log(`Mensaje de bienvenida enviado a ${createdUser.whatsapp}`);
      } catch (error) {
        console.log(`No se pudo enviar mensaje de WhatsApp: ${error.message}`);
      }
    }

    res.json({ result: "ok", user: userRepository.toPublicUser(createdUser) });
  } catch (error) {
    console.log("Error Creating User");
    console.error(error);

    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).send({
        message: "La cédula o el correo ya existen",
        error: error.message
      });
    }

    res.status(400).send({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  console.log("Buscando todos los usuarios");

  try {
    const term = req.query?.search ?? "";
    const limit = req.query?.limit ?? 20;
    const status = req.query?.status ?? null;
    const unitTypeId = req.query?.unit_type_id ?? null;
    const unitId = req.query?.unit_id ?? null;
    const cargoId = req.query?.cargo_id ?? null;
    const users = await userRepository.search(term, limit, status, {
      unitTypeId,
      unitId,
      cargoId
    });
    res.json(users.map((user) => userRepository.toPublicUser(user)));
  } catch (error) {
    console.log("Error Buscando Usuarios");
    console.error(error.message);
    res.status(500).send({ message: "Error en la petición" });
  }
};

export const updateUserPhoto = async (req, res) => {
  const { cedula } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).send({ message: "Debe adjuntar la foto en el campo 'photo'." });
  }

  try {
    const existingUser = await userRepository.findByCedulaOrEmail({ cedula });
    if (!existingUser) {
      await fs.remove(file.path).catch(() => { });
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
    const normalizedPath = relativePath.startsWith("uploads/") ? relativePath : `uploads/${relativePath}`;

    const updatedUser = await userRepository.updatePhotoByCedula(cedula, normalizedPath);

    const previousPath = existingUser.photo_url;
    if (previousPath && !previousPath.startsWith("data:")) {
      const absolutePrev = path.resolve(process.cwd(), previousPath.replace(/^\/+/, ""));
      if (await fs.pathExists(absolutePrev)) {
        await fs.remove(absolutePrev).catch(() => { });
      }
    }

    res.json({ result: "ok", user: updatedUser });
  } catch (error) {
    await fs.remove(file.path).catch(() => { });
    console.error("Error actualizando foto de usuario", error);
    res.status(500).send({ message: "Error al actualizar la foto", error: error.message });
  }
};

export const getUserMenu = async (req, res) => {
  try {
    const userIdRaw = req.params?.id ?? req.query?.user_id ?? req.query?.userId ?? req.body?.user_id ?? req.body?.userId;
    const userId = Number(userIdRaw);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el id del usuario." });
    }

    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }

    const [orgRelationRows] = await pool.query(
      "SELECT id FROM relation_unit_types WHERE code = 'org' LIMIT 1"
    );
    if (!orgRelationRows.length) {
      return res.status(500).json({
        message:
          "No existe relation_unit_types con code='org'. Debe implementarse para construir la jerarquia de unidades."
      });
    }

    const [positions] = await pool.query(
      `SELECT DISTINCT
         up.id AS position_id,
         u.id AS unit_id,
         u.name AS unit_name,
         u.label AS unit_label,
         u.unit_type_id,
         uol.group_unit_id AS group_unit_id,
         gu.name AS group_unit_name,
         gu.label AS group_unit_label,
         c.id AS cargo_id,
         c.name AS cargo_name
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       INNER JOIN units u ON u.id = up.unit_id
       INNER JOIN cargos c ON c.id = up.cargo_id
       LEFT JOIN unit_org_levels uol ON uol.unit_id = u.id
       LEFT JOIN units gu ON gu.id = uol.group_unit_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND up.is_active = 1
         AND u.is_active = 1
         AND c.is_active = 1
       ORDER BY u.name, c.name`,
      [userId]
    );

    if (!positions.length) {
      return res.json({ user_id: userId, units: [], consolidated: [] });
    }

    const unitsMap = new Map();
    const cargoMapByUnit = new Map();
    const consolidatedMap = new Map();
    const groupMap = new Map();

    const ensureUnitCargoMap = (unitId) => {
      if (!cargoMapByUnit.has(unitId)) {
        cargoMapByUnit.set(unitId, new Map());
      }
      return cargoMapByUnit.get(unitId);
    };

    positions.forEach((row) => {
      const groupUnitId = row.group_unit_id ?? row.unit_id;
      const groupUnitName = row.group_unit_name ?? row.unit_name;
      const groupUnitLabel = row.group_unit_label ?? row.unit_label ?? row.unit_name;

      if (!groupMap.has(groupUnitId)) {
        groupMap.set(groupUnitId, {
          id: groupUnitId,
          name: groupUnitName,
          label: groupUnitLabel,
          units: []
        });
      }

      if (!unitsMap.has(row.unit_id)) {
        unitsMap.set(row.unit_id, {
          id: row.unit_id,
          name: row.unit_name,
          label: row.unit_label ?? row.unit_name,
          group_id: groupUnitId
        });
      }

      const unitCargoMap = ensureUnitCargoMap(row.unit_id);
      if (!unitCargoMap.has(row.cargo_id)) {
        unitCargoMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          processes: []
        });
      }

      if (!consolidatedMap.has(row.cargo_id)) {
        consolidatedMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          processes: []
        });
      }
    });

    const [orgTreeRows] = await pool.query(
      `SELECT ur.parent_unit_id, ur.child_unit_id
       FROM unit_relations ur
       INNER JOIN relation_unit_types rt
         ON rt.id = ur.relation_type_id
        AND rt.code = 'org'`
    );

    const [processRuleRows] = await pool.query(
      `SELECT DISTINCT
         p.id AS process_id,
         p.name AS process_name,
         p.slug AS process_slug,
         pdv.id AS process_definition_id,
         pdv.variation_key,
         pdv.definition_version,
         ptr.id AS rule_id,
         ptr.unit_scope_type,
         ptr.unit_id,
         ptr.unit_type_id,
         ptr.include_descendants,
         ptr.cargo_id,
         ptr.position_id,
         ptr.recipient_policy
       FROM processes p
       INNER JOIN process_definition_versions pdv
         ON pdv.process_id = p.id
        AND pdv.status = 'active'
        AND pdv.effective_from <= CURDATE()
        AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
       INNER JOIN process_target_rules ptr
         ON ptr.process_definition_id = pdv.id
        AND ptr.is_active = 1
        AND (ptr.effective_from IS NULL OR ptr.effective_from <= CURDATE())
        AND (ptr.effective_to IS NULL OR ptr.effective_to >= CURDATE())
       WHERE p.is_active = 1
       ORDER BY p.name, ptr.priority, ptr.id`
    );
    const operationalProcessRows = await getUserOperationalProcessRows(pool, userId);

    const childrenByUnit = new Map();
    orgTreeRows.forEach((row) => {
      if (!childrenByUnit.has(row.parent_unit_id)) {
        childrenByUnit.set(row.parent_unit_id, []);
      }
      childrenByUnit.get(row.parent_unit_id).push(row.child_unit_id);
    });

    const subtreeCache = new Map();
    const getUnitSubtree = (unitId) => {
      if (!unitId) {
        return new Set();
      }
      if (subtreeCache.has(unitId)) {
        return subtreeCache.get(unitId);
      }
      const visited = new Set([unitId]);
      const stack = [unitId];
      while (stack.length) {
        const current = stack.pop();
        const children = childrenByUnit.get(current) || [];
        children.forEach((childId) => {
          if (!visited.has(childId)) {
            visited.add(childId);
            stack.push(childId);
          }
        });
      }
      subtreeCache.set(unitId, visited);
      return visited;
    };

    const positionMatchesRule = (position, rule) => {
      if (rule.position_id) {
        return Number(position.position_id) === Number(rule.position_id);
      }
      if (rule.recipient_policy === "exact_position") {
        return false;
      }
      if (rule.cargo_id && Number(position.cargo_id) !== Number(rule.cargo_id)) {
        return false;
      }
      switch (rule.unit_scope_type) {
        case "all_units":
          return true;
        case "unit_type":
          return rule.unit_type_id && Number(position.unit_type_id) === Number(rule.unit_type_id);
        case "unit_subtree":
          return rule.unit_id && getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
        case "unit_exact":
        default:
          if (!rule.unit_id) {
            return false;
          }
          if (Number(position.unit_id) === Number(rule.unit_id)) {
            return true;
          }
          if (Number(rule.include_descendants) === 1) {
            return getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
          }
          return false;
      }
    };

    const seenByUnitCargo = new Map();
    const seenByCargo = new Map();

    const addProcess = (cargo, process, seenSet) => {
      const uniqueKey = Number(process.process_definition_id || process.id);
      const existingIndex = cargo.processes.findIndex(
        (item) => Number(item.process_definition_id || item.id) === uniqueKey
      );

      if (existingIndex >= 0) {
        const existing = cargo.processes[existingIndex];
        if (existing.access_source !== "process" && process.access_source === "process") {
          cargo.processes[existingIndex] = {
            ...existing,
            ...process,
          };
        }
        seenSet.add(uniqueKey);
        return;
      }

      cargo.processes.push(process);
      seenSet.add(uniqueKey);
    };

    positions.forEach((position) => {
      const matchingRules = processRuleRows.filter((rule) => positionMatchesRule(position, rule));
      matchingRules.forEach((row) => {
        const process = {
          id: row.process_id,
          name: row.process_name,
          slug: row.process_slug,
          unit_id: position.unit_id,
          process_definition_id: row.process_definition_id,
          variation_key: row.variation_key,
          definition_version: row.definition_version,
          access_source: "process"
        };

        const unitCargoMap = cargoMapByUnit.get(position.unit_id);
        if (unitCargoMap?.has(position.cargo_id)) {
          const cargo = unitCargoMap.get(position.cargo_id);
          const key = `${position.unit_id}:${position.cargo_id}`;
          if (!seenByUnitCargo.has(key)) {
            seenByUnitCargo.set(key, new Set());
          }
          addProcess(cargo, process, seenByUnitCargo.get(key));
        }

        if (consolidatedMap.has(position.cargo_id)) {
          if (!seenByCargo.has(position.cargo_id)) {
            seenByCargo.set(position.cargo_id, new Set());
          }
          addProcess(consolidatedMap.get(position.cargo_id), process, seenByCargo.get(position.cargo_id));
        }
      });
    });

    positions.forEach((position) => {
      operationalProcessRows.forEach((row) => {
        const process = {
          id: row.process_id,
          name: row.process_name,
          slug: row.process_slug,
          unit_id: position.unit_id,
          process_definition_id: row.process_definition_id,
          variation_key: row.variation_key,
          definition_version: row.definition_version,
          access_source: "flow"
        };

        const unitCargoMap = cargoMapByUnit.get(position.unit_id);
        if (unitCargoMap?.has(position.cargo_id)) {
          const cargo = unitCargoMap.get(position.cargo_id);
          const key = `${position.unit_id}:${position.cargo_id}:operational`;
          if (!seenByUnitCargo.has(key)) {
            seenByUnitCargo.set(key, new Set());
          }
          addProcess(cargo, process, seenByUnitCargo.get(key));
        }

        if (consolidatedMap.has(position.cargo_id)) {
          const key = `${position.cargo_id}:operational`;
          if (!seenByCargo.has(key)) {
            seenByCargo.set(key, new Set());
          }
          addProcess(consolidatedMap.get(position.cargo_id), process, seenByCargo.get(key));
        }
      });
    });

    const sortCargos = (cargos) => {
      cargos.forEach((cargo) => {
        cargo.processes.sort((a, b) => a.name.localeCompare(b.name));
      });
      cargos.sort((a, b) => a.name.localeCompare(b.name));
      return cargos;
    };

    const units = Array.from(unitsMap.values())
      .map((unit) => {
        const cargoMap = cargoMapByUnit.get(unit.id);
        const cargos = cargoMap ? Array.from(cargoMap.values()) : [];
        return {
          ...unit,
          cargos: sortCargos(cargos)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    units.forEach((unit) => {
      const group = groupMap.get(unit.group_id);
      if (group) {
        group.units.push(unit);
      }
    });

    const unitGroups = Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        units: group.units.sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const consolidated = sortCargos(Array.from(consolidatedMap.values()));

    res.json({ user_id: userId, units, unit_groups: unitGroups, consolidated });
  } catch (error) {
    console.error("Error construyendo el menu del usuario:", error);
    res.status(500).json({ message: "Error al obtener el menú del usuario", error: error.message });
  }
};

export const getUserProcessDefinitionPanel = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    const definitionId = Number(req.params?.definitionId);
    if (!userId || Number.isNaN(userId) || !definitionId || Number.isNaN(definitionId)) {
      return res.status(400).json({ message: "Se requieren el usuario y la definicion del proceso." });
    }

    const pool = getMariaDBPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion MariaDB no disponible" });
    }

    const panel = await buildUserProcessDefinitionPanel(pool, userId, definitionId);
    if (!panel) {
      return res.status(404).json({
        message: "La definicion no esta activa o el usuario no tiene acceso operativo a ella."
      });
    }

    res.json(panel);
  } catch (error) {
    console.error("Error obteniendo panel operativo de la definicion:", error);
    res.status(500).json({
      message: "Error al obtener el panel operativo de la definicion",
      error: error.message
    });
  }
};

export const createUserProcessTask = async (req, res) => {
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  if (!userId || Number.isNaN(userId) || !definitionId || Number.isNaN(definitionId)) {
    return res.status(400).json({ message: "Se requieren el usuario y la definicion del proceso." });
  }

  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }

  const accessPanel = await buildUserProcessDefinitionPanel(pool, userId, definitionId);
  if (!accessPanel) {
    return res.status(404).json({
      message: "La definicion no esta activa o el usuario no tiene acceso operativo a ella."
    });
  }

  const canLaunchManual = accessPanel.permissions?.can_launch_manual;
  const canLaunchCustomTerm = accessPanel.permissions?.can_launch_custom_term;
  if (!canLaunchManual) {
    return res.status(400).json({
      message: "Esta definicion no permite lanzar tareas manuales."
    });
  }

  const termId = req.body?.term_id ? Number(req.body.term_id) : null;
  const customTerm = req.body?.custom_term ?? null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let term = null;
    if (termId && !Number.isNaN(termId)) {
      const [rows] = await connection.query(
        `SELECT
           t.id,
           t.name,
           t.start_date,
           t.end_date,
           tt.code AS term_type_code
         FROM terms t
         INNER JOIN term_types tt ON tt.id = t.term_type_id
         WHERE t.id = ?
         LIMIT 1`,
        [termId]
      );
      term = rows[0] || null;
      if (!term) {
        throw new Error("El periodo seleccionado no existe.");
      }
      if (!canLaunchCustomTerm && !canLaunchManual) {
        throw new Error("La definicion no permite lanzar tareas manuales.");
      }
      if (!canLaunchManual && term.term_type_code !== "CUS") {
        throw new Error("Esta definicion solo permite tareas manuales con periodos personalizados.");
      }
    } else if (customTerm) {
      if (!canLaunchCustomTerm) {
        throw new Error("Esta definicion no permite crear periodos personalizados.");
      }
      const customType = await getCustomTermType(connection);
      if (!customType) {
        throw new Error("No existe el tipo de periodo Custom.");
      }

      const customName = String(customTerm.name || "").trim();
      const startDate = String(customTerm.start_date || "").trim();
      const endDate = String(customTerm.end_date || "").trim();
      if (!customName || !startDate || !endDate) {
        throw new Error("Debes completar nombre, fecha inicial y fecha final del periodo personalizado.");
      }

      const [insertResult] = await connection.query(
        `INSERT INTO terms (name, term_type_id, start_date, end_date, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [customName, customType.id, startDate, endDate]
      );
      term = {
        id: insertResult.insertId,
        name: customName,
        start_date: startDate,
        end_date: endDate,
        term_type_code: customType.code
      };
    } else {
      throw new Error("Debes seleccionar un periodo o crear uno personalizado.");
    }

    const [result] = await connection.query(
      `INSERT INTO tasks (
         process_definition_id,
         term_id,
         launch_mode,
         created_by_user_id,
         parent_task_id,
         responsible_position_id,
         description,
         start_date,
         end_date,
         status
       ) VALUES (?, ?, 'manual', ?, NULL, NULL, ?, ?, ?, 'pendiente')`,
      [
        definitionId,
        term.id,
        userId,
        req.body?.description ? String(req.body.description) : null,
        term.start_date,
        term.end_date || null
      ]
    );

    const hydrated = await hydrateTaskFromDefinition({
      connection,
      taskId: result.insertId,
      processDefinitionId: definitionId,
      termId: term.id
    });

    await connection.commit();

    res.json({
      result: "ok",
      task_id: result.insertId,
      term_id: term.id,
      hydration: hydrated
    });
  } catch (error) {
    await connection.rollback();
    let message = error.message;
    if (error?.code === "ER_DUP_ENTRY") {
      const details = String(error?.sqlMessage || error?.message || "");
      if (details.includes("uq_tasks_manual_term_user")) {
        message = "Ya existe una tarea manual de esta definicion para ese periodo creada por este usuario.";
      } else if (details.includes("terms.name")) {
        message = "Ya existe un periodo con ese nombre. Usa otro nombre para el periodo personalizado.";
      }
    }
    console.error("Error creando tarea manual de definicion:", error);
    res.status(400).json({ message });
  } finally {
    connection.release();
  }
};

export const uploadDeliverablePdf = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para subir el entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la definición y el entregable." });
  }
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "Debes seleccionar un archivo del entregable." });
  }

  const pool = getMariaDBPool();
  if (!pool) {
    await fs.remove(uploadedFile.path).catch(() => {});
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }

  const connection = await pool.getConnection();
  try {
    const target = await getAccessibleTaskItemDocumentForUser(connection, authenticatedUserId, definitionId, taskItemId);
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }

    const normalizedRole = String(target.template_usage_role || "").trim().toLowerCase();
    if (!["primary", "attachment"].includes(normalizedRole)) {
      return res.status(400).json({
        message: "Este entregable no requiere carga manual de archivos."
      });
    }

    if (!target.scope_unit_id || !target.process_id || !target.term_id || !target.term_type_id || !target.task_id || !target.document_id) {
      return res.status(400).json({
        message: "No se pudo determinar la ruta documental canónica para este entregable."
      });
    }

    const originalName = String(uploadedFile.originalname || "entregable.pdf");
    const extension = path.extname(originalName).replace(/^\./, "").toLowerCase() || "pdf";
    const relativeObjectPath = buildWorkingObjectPathForUpload({
      basePath: buildCanonicalDocumentVersionBasePath(target),
      originalName,
      extension
    });
    const minioObjectName = `${MINIO_DOCUMENTS_PREFIX}/${relativeObjectPath}`;

    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    await uploadFileToMinio(MINIO_DOCUMENTS_BUCKET, minioObjectName, uploadedFile.path, {
      "Content-Type": uploadedFile.mimetype || "application/octet-stream",
      "Original-Name": originalName
    });

    await connection.beginTransaction();
    await connection.query(
      `UPDATE document_versions
       SET working_file_path = ?
       WHERE id = ?`,
      [relativeObjectPath, Number(target.document_version_id)]
    );

    const currentStatus = String(target.document_version_status || "").trim();
    if (currentStatus === "Borrador" || currentStatus === "Pendiente de llenado" || currentStatus === "Observado") {
      await transitionDocumentVersionState(connection, Number(target.document_version_id), "En llenado");
    }

    await connection.commit();

    return res.json({
      message: "El archivo del entregable se cargó correctamente.",
      task_item_id: Number(target.task_item_id),
      document_id: Number(target.document_id),
      document_version_id: Number(target.document_version_id),
      working_file_path: relativeObjectPath,
      file_extension: extension,
      template_artifact_name: target.template_artifact_name || `Entregable #${target.task_item_id}`
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Error al subir el archivo del entregable:", error);
    return res.status(500).json({
      message: "No se pudo cargar el archivo del entregable.",
      error: error.message
    });
  } finally {
    connection.release();
    await fs.remove(uploadedFile.path).catch(() => {});
  }
};

export const downloadDeliverableTemplate = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar la plantilla." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la definición y el entregable." });
  }

  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         ti.id AS task_item_id,
         tar.template_seed_id,
         tar.display_name AS template_artifact_name,
         tar.available_formats
       FROM task_items ti
       INNER JOIN tasks t ON t.id = ti.task_id
       INNER JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
       WHERE ti.id = ?
         AND t.process_definition_id = ?
         AND (
           t.created_by_user_id = ?
           OR EXISTS (
             SELECT 1
             FROM task_assignments ta
             LEFT JOIN position_assignments pa
               ON pa.position_id = ta.position_id
              AND pa.is_current = 1
              AND pa.person_id = ?
             WHERE ta.task_id = t.id
               AND (
                 ta.assigned_person_id = ?
                 OR (ta.assigned_person_id IS NULL AND pa.person_id = ?)
               )
           )
         )
       LIMIT 1`,
      [taskItemId, definitionId, authenticatedUserId, authenticatedUserId, authenticatedUserId, authenticatedUserId]
    );
    const target = rows?.[0];
    if (!target) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const availableFormats = parseAvailableFormats(target.available_formats);
    const resources = await collectDeliverableTemplateResources(availableFormats);

    if (!resources.length) {
      return res.status(404).json({
        message: "El entregable no tiene recursos descargables publicados en MinIO para esta plantilla."
      });
    }

    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "deliverable-template-"));
    const zipPath = path.join(
      os.tmpdir(),
      `${sanitizeStorageSegment(target.template_artifact_name || "plantilla", "plantilla")}-${randomUUID()}.zip`
    );
    const downloadFileName = `${sanitizeStorageSegment(target.template_artifact_name || "plantilla", "plantilla")}.zip`;

    try {
      for (const resource of resources) {
        const destinationPath = path.join(workspace, resource.archiveName);
        await writeMinioObjectToFile(MINIO_TEMPLATES_BUCKET, resource.objectName, destinationPath);
      }
      await createZipArchive(workspace, zipPath);
      res.setHeader("Content-Type", "application/zip");
      return res.download(zipPath, downloadFileName, async () => {
        await fs.remove(zipPath).catch(() => {});
        await fs.remove(workspace).catch(() => {});
      });
    } catch (zipError) {
      await fs.remove(zipPath).catch(() => {});
      await fs.remove(workspace).catch(() => {});
      throw zipError;
    }
  } catch (error) {
    console.error("Error al descargar la plantilla del entregable:", error);
    return res.status(404).json({
      message: error.message || "No se pudo descargar la plantilla del entregable."
    });
  }
};

export const downloadDeliverableFile = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const requestedKind = String(req.query?.kind || "best").trim().toLowerCase();
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar el archivo del entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la definición y el entregable." });
  }

  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId);
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }

    const candidatePaths =
      requestedKind === "final"
        ? [target.final_file_path]
        : requestedKind === "working"
          ? [target.working_file_path]
          : [target.final_file_path, target.working_file_path];
    const normalizedCandidatePaths = candidatePaths
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (!normalizedCandidatePaths.length) {
      return res.status(404).json({ message: "El entregable todavía no tiene un archivo vinculado." });
    }

    let selectedObject = null;
    let selectedStat = null;
    let lastResolutionError = null;

    for (const storedPath of normalizedCandidatePaths) {
      const resolvedObject = resolveStoredDocumentObject(storedPath);
      if (!resolvedObject) {
        continue;
      }
      try {
        const stat = await statMinioObject(resolvedObject.bucket, resolvedObject.objectName);
        selectedObject = resolvedObject;
        selectedStat = stat;
        break;
      } catch (error) {
        lastResolutionError = error;
      }
    }

    if (!selectedObject || !selectedStat) {
      const message =
        lastResolutionError?.message || "No se encontró un archivo válido del entregable en almacenamiento.";
      return res.status(404).json({ message });
    }

    const stream = await getMinioObjectStream(selectedObject.bucket, selectedObject.objectName);
    const fileName = path.basename(selectedObject.objectName);
    const contentType =
      selectedStat?.metaData?.["content-type"]
      || selectedStat?.metaData?.["Content-Type"]
      || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", selectedStat.size);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.on("error", (streamError) => {
      console.error("Error transmitiendo el archivo del entregable:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ message: "No se pudo transmitir el archivo del entregable." });
      } else {
        res.destroy(streamError);
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error descargando el archivo del entregable:", error);
    return res.status(500).json({
      message: "No se pudo descargar el archivo del entregable.",
      error: error.message
    });
  }
};

export const resetDeliverableWorkflow = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);

  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para resetear el flujo del entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la definición y el entregable." });
  }

  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await resetDocumentWorkflowForTaskItem({
      connection,
      userId: authenticatedUserId,
      definitionId,
      taskItemId,
    });
    await connection.commit();

    return res.json({
      message: "El flujo del entregable se reseteó correctamente.",
      document_id: result.documentId,
      previous_document_version_id: result.previousDocumentVersionId,
      previous_document_version: result.previousDocumentVersion,
      new_document_version_id: result.newDocumentVersionId,
      new_document_version: result.newDocumentVersion,
      reset_by: result.resetBy,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    const statusCode = Number(error?.statusCode || 500);
    console.error("Error reseteando el flujo del entregable:", error);
    return res.status(statusCode).json({
      message: error?.message || "No se pudo resetear el flujo del entregable.",
    });
  } finally {
    connection.release();
  }
};

//update user data
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const payload = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      whatsapp: req.body.whatsapp,
      direccion: req.body.direccion,
      pais: req.body.pais
    };

    const updatedUser = await userRepository.update(userId, payload);

    res.json({
      result: "ok",
      user: updatedUser
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando perfil"
    });
  }
};

//get user by id
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    res.json({
      result: "ok",
      user: userRepository.toPublicUser(user)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo perfil"
    });
  }
};
