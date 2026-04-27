import { getMariaDBPool } from "../../config/mariadb.js";
import {
  hydrateTaskFromDefinition,
  ensureProcessRun,
  ensureDocumentsForTask,
  ensureDocumentForTaskItem,
  ensureFillFlowForDocumentVersion,
  ensureSignatureFlowForDocumentVersion,
  updateParentTaskStatusForTask
} from "./TaskGenerationService.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as Minio from "minio";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import {
  assertDocumentStatusValue,
  assertDocumentVersionStatusValue,
} from "../documents/DocumentStateService.js";
import {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromFillRequest,
  syncDocumentProgressFromSignatureRequest,
} from "../documents/DocumentProgressService.js";

const DEFAULT_LIMIT = 50;
const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$/;
const SEMANTIC_VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const ARTIFACT_STAGE_VALUES = new Set(["draft", "review", "approved", "published", "archived"]);
const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVICE_DIR, "..", "..", "..");
const TEMPLATE_DIST_ROOT = path.join(REPO_ROOT, "tools", "templates", "dist", "Plantillas");
const BACKEND_STORAGE_ROOT = path.join(REPO_ROOT, "backend", "storage");
const MINIO_TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";
const MINIO_TEMPLATES_PREFIX = (process.env.MINIO_TEMPLATES_PREFIX || "System").replace(/^\/+|\/+$/g, "");
const MINIO_TEMPLATES_SEEDS_PREFIX = (process.env.MINIO_TEMPLATES_SEEDS_PREFIX || "Seeds").replace(/^\/+|\/+$/g, "");
const TEMPLATE_USERS_PREFIX = (
  process.env.MINIO_TEMPLATES_USERS_PREFIX
  || process.env.MINIO_TEMPLATES_DRAFT_PREFIX
  || "Users"
).replace(/^\/+|\/+$/g, "");
const ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX = "artifact_sync_fill:";
const ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX = "artifact_sync_signature:";
const ARTIFACT_WORKFLOW_CONTRACT = [
  "workflows:",
  "  fill:",
  "    required: true",
  "    source: \"artifact\"",
  "    sync_mode: \"artifact_to_db\"",
  "    steps: []",
  "  signatures:",
  "    required: false",
  "    source: \"artifact\"",
  "    sync_mode: \"artifact_to_db\"",
  "    steps: []",
  "dependencies:",
  "  templates: []",
  "  data: []"
].join("\n");
const FILL_RESOLVER_TYPES = new Set([
  "task_assignee",
  "document_owner",
  "specific_person",
  "position",
  "cargo_in_scope",
  "manual_pick"
]);
const FILL_UNIT_SCOPE_TYPES = new Set(["unit_exact", "unit_subtree", "unit_type", "all_units"]);
const FILL_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);
const SIGNATURE_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);
const SIGNATURE_RESOLVER_TYPES = new Set([
  "task_assignee",
  "document_owner",
  "specific_person",
  "position",
  "cargo_in_scope",
  "manual_pick"
]);
const SIGNATURE_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  "context_exact",
  "context_subtree",
  "context_ancestor_type"
]);
const SIGNATURE_APPROVAL_MODES = new Set(["and", "or", "at_least"]);
const SIGNATURE_TYPE_CODE_ALIASES = new Map([
  ["electronic", "electronic"],
  ["firma_electronica", "electronic"],
  ["electronic_signature", "electronic"]
]);
const CARGO_CODE_ALIASES = new Map([
  ["coordinador_carrera", "coordinador"],
  ["director_escuela", "director"],
  ["director_docencia", "director"],
  ["responsable_aseguramiento_calidad", "responsable"],
  ["responsable_financiero", "responsable"],
  ["jefe_talento_humano", "jefe"]
]);
const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://localhost:9000");
const minioUseSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || minioUrl.protocol === "https:";
let minioClientInstance = null;

const walkFiles = (dirPath, collected = []) => {
  if (!fs.existsSync(dirPath)) {
    return collected;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collected);
      continue;
    }
    collected.push(fullPath);
  }
  return collected;
};

const getYamlScalar = (content, key) => {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) {
    return "";
  }
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
};

const parseYamlDocument = (content, { filePath = "meta.yaml" } = {}) => {
  try {
    const parsed = yaml.load(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    throw new Error(`No se pudo interpretar ${filePath}: ${error.message}`);
  }
};

const hasVisibleFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return false;
  }
  return walkFiles(dirPath).some((filePath) => path.basename(filePath) && !path.basename(filePath).startsWith("."));
};

const hashDirectory = (dirPath) => {
  const hash = crypto.createHash("sha256");
  const files = walkFiles(dirPath)
    .filter((filePath) => !path.basename(filePath).startsWith("."))
    .sort((left, right) => left.localeCompare(right));
  for (const filePath of files) {
    const relative = path.relative(dirPath, filePath).replace(/\\/g, "/");
    hash.update(relative);
    hash.update(fs.readFileSync(filePath));
  }
  return files.length ? hash.digest("hex") : null;
};

const slugify = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

const humanizeSlug = (value) => String(value || "")
  .split(/[-_/]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

const getMinioClient = () => {
  if (!minioClientInstance) {
    minioClientInstance = new Minio.Client({
      endPoint: minioUrl.hostname,
      port: Number(minioUrl.port || (minioUseSSL ? 443 : 80)),
      useSSL: minioUseSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "",
      secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || ""
    });
  }
  return minioClientInstance;
};

const listMinioObjects = (bucket, prefix, recursive = true) => new Promise((resolve, reject) => {
  const objects = [];
  const stream = getMinioClient().listObjectsV2(bucket, prefix, recursive);
  stream.on("data", (item) => {
    if (item?.name) {
      objects.push(item.name);
    }
  });
  stream.on("error", reject);
  stream.on("end", () => resolve(objects));
});

const getMinioObjectStream = (bucket, objectName) => new Promise((resolve, reject) => {
  getMinioClient().getObject(bucket, objectName, (error, dataStream) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(dataStream);
  });
});

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolve(Buffer.concat(chunks)));
});

const readMinioObjectAsText = async (bucket, objectName) => {
  const dataStream = await getMinioObjectStream(bucket, objectName);
  const buffer = await streamToBuffer(dataStream);
  return buffer.toString("utf8");
};

const copyMinioObjectToFile = async (bucket, objectName, targetFile) => {
  const dataStream = await getMinioObjectStream(bucket, objectName);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(targetFile);
    dataStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    dataStream.pipe(writeStream);
  });
};

const downloadMinioPrefixToDirectory = async (bucket, objectPrefix, targetDir) => {
  const normalizedPrefix = String(objectPrefix || "").replace(/^\/+/, "").replace(/\/?$/, "/");
  const objectNames = await listMinioObjects(bucket, normalizedPrefix, true);
  if (!objectNames.length) {
    throw new Error(`No se encontraron objetos en MinIO bajo ${normalizedPrefix}`);
  }
  for (const objectName of objectNames) {
    if (!objectName.startsWith(normalizedPrefix)) {
      continue;
    }
    const relativePath = objectName.slice(normalizedPrefix.length);
    if (!relativePath) {
      continue;
    }
    await copyMinioObjectToFile(bucket, objectName, path.join(targetDir, relativePath));
  }
};

const fPutObject = (bucket, objectName, filePath) => new Promise((resolve, reject) => {
  getMinioClient().fPutObject(bucket, objectName, filePath, {}, (error, etag) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(etag);
  });
});

const ensureMinioBucket = (bucket) => new Promise((resolve, reject) => {
  getMinioClient().bucketExists(bucket, (checkError, exists) => {
    if (checkError) {
      reject(checkError);
      return;
    }
    if (exists) {
      resolve(true);
      return;
    }
    getMinioClient().makeBucket(bucket, "", (makeError) => {
      if (makeError) {
        reject(makeError);
        return;
      }
      resolve(true);
    });
  });
});

const normalizeObjectName = (prefix, relativePath) => {
  const cleanPrefix = String(prefix || "").replace(/^\/+|\/+$/g, "");
  const cleanRelative = String(relativePath || "").replace(/^\/+|\/+$/g, "");
  if (!cleanPrefix) {
    return cleanRelative;
  }
  if (!cleanRelative) {
    return cleanPrefix;
  }
  return `${cleanPrefix}/${cleanRelative}`;
};

const uploadDirectoryToMinio = async (bucket, objectPrefix, sourceDir) => {
  await ensureMinioBucket(bucket);
  const files = walkFiles(sourceDir).filter((filePath) => !path.basename(filePath).startsWith("."));
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    const objectName = normalizeObjectName(objectPrefix, relativePath);
    await fPutObject(bucket, objectName, filePath);
  }
  return files.length;
};

const parseAvailableFormats = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
};

const normalizeNumericId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "si", "sí"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const normalizeSignatureStepAnchorRefs = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const normalizeFillSteps = (workflow = {}, { cargoCodeMap = new Map() } = {}) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step, index) => {
      const resolverType = String(step?.resolver?.type || "task_assignee");
      const unitScopeType = String(step?.resolver?.unit_scope_type || "unit_exact");
      const selectionMode = String(step?.resolver?.selection_mode || "auto_one");
      const rawCargoCode = String(step?.resolver?.cargo_code || "").trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      return {
        stepOrder: Number(step.order) || index + 1,
        resolverType: FILL_RESOLVER_TYPES.has(resolverType) ? resolverType : "manual_pick",
        assignedPersonId: normalizeNumericId(step?.resolver?.person_id),
        unitScopeType: FILL_UNIT_SCOPE_TYPES.has(unitScopeType) ? unitScopeType : "unit_exact",
        unitId: normalizeNumericId(step?.resolver?.unit_id),
        unitTypeId: normalizeNumericId(step?.resolver?.unit_type_id),
        cargoId: normalizeNumericId(step?.resolver?.cargo_id) || cargoCodeMap.get(normalizedCargoCode) || null,
        positionId: normalizeNumericId(step?.resolver?.position_id),
        selectionMode: FILL_SELECTION_MODES.has(selectionMode) ? selectionMode : "manual",
        isRequired: normalizeBooleanFlag(step?.required, true) ? 1 : 0,
        canReject: normalizeBooleanFlag(step?.can_reject, true) ? 1 : 0
      };
    })
    .sort((left, right) => left.stepOrder - right.stepOrder);
};

const normalizeSignatureSteps = (
  workflow = {},
  { cargoCodeMap = new Map(), signatureTypeCodeMap = new Map(), unitTypeNameMap = new Map() } = {}
) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step, index) => {
      const rawTypeCode = String(step.step_type_code || "electronic").trim().toLowerCase();
      const normalizedTypeCode = slugify(SIGNATURE_TYPE_CODE_ALIASES.get(rawTypeCode) || rawTypeCode);
      const rawCargoCode = String(
        step?.resolver?.cargo_code
        || step.required_cargo_code
        || ""
      ).trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      const normalizedSlot = String(step.slot || "").trim() || null;
      const stepCode = String(step.code || "").trim() || null;
      const stepName = String(step.name || "").trim() || null;
      const anchorRefs = normalizeSignatureStepAnchorRefs(step.anchor_refs);
      const resolverType = String(step?.resolver?.type || "cargo_in_scope").trim();
      const unitScopeType = String(step?.resolver?.unit_scope_type || "context_exact").trim();
      const selectionMode = String(step?.resolver?.selection_mode || step.selection_mode || "auto_all").trim();
      const approvalMode = String(step.approval_mode || "and").trim().toLowerCase();
      const rawUnitTypeName = String(step?.resolver?.unit_type_name || "").trim().toLowerCase();
      return {
        stepOrder: Number(step.order) || index + 1,
        code: stepCode,
        name: stepName,
        slot: normalizedSlot,
        stepTypeId: signatureTypeCodeMap.get(normalizedTypeCode) || null,
        resolverType: SIGNATURE_RESOLVER_TYPES.has(resolverType) ? resolverType : "cargo_in_scope",
        assignedPersonId: normalizeNumericId(step?.resolver?.person_id),
        unitScopeType: SIGNATURE_UNIT_SCOPE_TYPES.has(unitScopeType) ? unitScopeType : "context_exact",
        unitId: normalizeNumericId(step?.resolver?.unit_id),
        unitTypeId:
          normalizeNumericId(step?.resolver?.unit_type_id)
          || unitTypeNameMap.get(rawUnitTypeName)
          || null,
        positionId: normalizeNumericId(step?.resolver?.position_id),
        requiredCargoId:
          normalizeNumericId(step?.resolver?.cargo_id)
          || cargoCodeMap.get(normalizedCargoCode)
          || null,
        selectionMode: SIGNATURE_SELECTION_MODES.has(selectionMode) ? selectionMode : "auto_all",
        approvalMode: SIGNATURE_APPROVAL_MODES.has(approvalMode) ? approvalMode : "and",
        requiredSignersMin: normalizeNumericId(step.required_signers_min),
        requiredSignersMax: normalizeNumericId(step.required_signers_max),
        isRequired: normalizeBooleanFlag(step.required, true) ? 1 : 0,
        anchorRefs
      };
    })
    .filter((step) => step.stepTypeId)
    .filter((step) => step.resolverType !== "cargo_in_scope" || step.requiredCargoId)
    .sort((left, right) => left.stepOrder - right.stepOrder);
};

const collectSignatureWorkflowNormalizationIssues = (
  workflow = {},
  { cargoCodeMap = new Map(), signatureTypeCodeMap = new Map() } = {}
) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  const issues = [];
  for (const [index, step] of rawSteps.entries()) {
    if (!step || typeof step !== "object") {
      continue;
    }

    const stepOrder = Number(step.order) || index + 1;
    const stepCode = String(step.code || "").trim() || `step_${stepOrder}`;
    const rawTypeCode = String(step.step_type_code || "electronic").trim().toLowerCase();
    const normalizedTypeCode = slugify(SIGNATURE_TYPE_CODE_ALIASES.get(rawTypeCode) || rawTypeCode);
    if (!signatureTypeCodeMap.get(normalizedTypeCode)) {
      issues.push(`Paso ${stepOrder} (${stepCode}): tipo de firma no resuelto (${rawTypeCode || "vacío"}).`);
    }

    const resolverType = String(step?.resolver?.type || "cargo_in_scope").trim();
    if (resolverType === "cargo_in_scope") {
      const rawCargoCode = String(
        step?.resolver?.cargo_code
        || step.required_cargo_code
        || ""
      ).trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      if (!cargoCodeMap.get(normalizedCargoCode)) {
        issues.push(`Paso ${stepOrder} (${stepCode}): cargo no resuelto (${rawCargoCode || "vacío"}).`);
      }
    }
  }
  return issues;
};

const buildArtifactSyncedFillDescription = ({ artifactId, templateCode, storageVersion }) =>
  `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}${artifactId}:${templateCode}:${storageVersion}`;

const buildArtifactSyncedSignatureDescription = ({ artifactId, templateCode, storageVersion }) =>
  `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}${artifactId}:${templateCode}:${storageVersion}`;

const isArtifactFillWorkflowSyncEnabled = (workflow = {}) =>
  String(workflow?.sync_mode || "").trim() === "artifact_to_db"
  && normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

const isArtifactSignatureWorkflowSyncEnabled = (workflow = {}) =>
  String(workflow?.sync_mode || "").trim() === "artifact_to_db"
  && normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

const findPreferredPdfObject = (objectNames = []) => {
  const pdfCandidates = (objectNames || []).filter((name) => /\.pdf$/i.test(String(name || "")));
  if (!pdfCandidates.length) {
    return null;
  }
  const preferredMatchers = [
    /\/render\/output\/pdf\/.+\.pdf$/i,
    /\/render\/.+\.pdf$/i,
    /\/preview\/.+\.pdf$/i,
    /\.pdf$/i
  ];
  for (const matcher of preferredMatchers) {
    const match = pdfCandidates.find((name) => matcher.test(name));
    if (match) {
      return match;
    }
  }
  return pdfCandidates[0];
};

const buildArtifactModeDir = (baseDir, mode, format) =>
  path.join(baseDir, "template", "modes", mode, format, "src");

const setAvailableFormatEntry = (availableFormats, mode, format, baseObjectPrefix) => {
  if (!availableFormats[mode]) {
    availableFormats[mode] = {};
  }
  availableFormats[mode][format] = {
    entry_object_key: `${baseObjectPrefix}template/modes/${mode}/${format}/src/`
  };
};

const validatePackagedArtifactDraft = (draftDir, availableFormats) => {
  const schemaPath = path.join(draftDir, "schema.json");
  const metaPath = path.join(draftDir, "meta.yaml");
  const templateDir = path.join(draftDir, "template");
  if (!fs.existsSync(schemaPath) || !fs.existsSync(metaPath) || !fs.existsSync(templateDir)) {
    throw new Error("El artifact no cumple la estructura base requerida (meta.yaml, schema.json y template/).");
  }
  const metaContent = fs.readFileSync(metaPath, "utf8");
  const requiredMetaSections = [
    /^workflows:\s*$/m,
    /^\s{2}fill:\s*$/m,
    /^\s{2}signatures:\s*$/m,
    /^dependencies:\s*$/m
  ];
  if (requiredMetaSections.some((pattern) => !pattern.test(metaContent))) {
    throw new Error("El artifact no cumple el contrato minimo de meta.yaml para workflows y dependencies.");
  }
  for (const [mode, formats] of Object.entries(availableFormats || {})) {
    for (const format of Object.keys(formats || {})) {
      const dirPath = buildArtifactModeDir(draftDir, mode, format);
      if (!hasVisibleFiles(dirPath)) {
        throw new Error(`La salida ${mode}/${format} no cumple la estructura esperada en template/modes/${mode}/${format}/src/.`);
      }
    }
  }
};

const parseJsonObject = (value, fieldLabel) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`El campo ${fieldLabel} debe ser un JSON valido.`);
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new Error(`El campo ${fieldLabel} debe ser un JSON valido.`);
  }
};

const normalizeValue = (field, value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (field?.type === "boolean") {
    return value ? 1 : 0;
  }

  return value;
};

const getConfig = (tableName) => {
  const config = SQL_TABLE_MAP[tableName];
  if (!config) {
    throw new Error(`Tabla no soportada: ${tableName}`);
  }
  return config;
};

const pickPayload = (fields, data, { includeReadOnly = false } = {}) => {
  const payload = {};
  for (const field of fields) {
    if (field.virtual) {
      continue;
    }
    if (!includeReadOnly && field.readOnly) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(data, field.name)) {
      payload[field.name] = normalizeValue(field, data[field.name]);
    }
  }
  return payload;
};

const buildWhere = (keys, values) => {
  const clauses = [];
  const params = [];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`Falta la llave primaria: ${key}`);
    }
    clauses.push(`${key} = ?`);
    params.push(values[key]);
  }
  return { where: clauses.join(" AND "), params };
};

const isValidDate = (value) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const ensureDateOrder = (startDate, endDate, label) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new Error(`La fecha de fin debe ser posterior a la fecha de inicio en ${label}.`);
    }
  }
};

const validateFieldTypes = (config, payload) => {
  for (const field of config.fields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field.name)) {
      continue;
    }
    const value = payload[field.name];
    if (value === null || value === undefined || value === "") {
      continue;
    }
    if (field.type === "number" && Number.isNaN(Number(value))) {
      throw new Error(`El campo ${field.label || field.name} debe ser numerico.`);
    }
    if (field.type === "boolean" && ![0, 1, "0", "1", true, false].includes(value)) {
      throw new Error(`El campo ${field.label || field.name} debe ser booleano.`);
    }
    if ((field.type === "date" || field.type === "datetime") && !isValidDate(value)) {
      throw new Error(`El campo ${field.label || field.name} debe tener una fecha valida.`);
    }
    if (field.type === "select" && field.options?.length) {
      if (!field.options.includes(value)) {
        throw new Error(`El campo ${field.label || field.name} no acepta el valor recibido.`);
      }
    }
  }
};

const validateTableRules = (tableName, candidate) => {
  switch (tableName) {
    case "unit_relations":
      if (candidate.parent_unit_id && candidate.child_unit_id) {
        if (Number(candidate.parent_unit_id) === Number(candidate.child_unit_id)) {
          throw new Error("La unidad padre y la unidad hija no pueden ser la misma.");
        }
      }
      break;
    case "terms":
      ensureDateOrder(candidate.start_date, candidate.end_date, "periodos");
      break;
    case "processes":
      break;
    case "process_definition_versions":
      if (!candidate.process_id) {
        throw new Error("Selecciona un proceso base para la definicion.");
      }
      if (!candidate.series_id) {
        throw new Error("Selecciona una serie de definicion.");
      }
      if (!candidate.definition_version || !SEMANTIC_VERSION_REGEX.test(String(candidate.definition_version).trim())) {
        throw new Error("La version de la definicion debe tener formato semantico de tres segmentos (ej: 1.0.0).");
      }
      if (!candidate.effective_from) {
        throw new Error("Selecciona la fecha de vigencia inicial de la definicion.");
      }
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "definiciones de proceso");
      break;
    case "process_definition_series":
      if (!candidate.source_type || !["unit_type", "cargo", "legacy"].includes(String(candidate.source_type))) {
        throw new Error("Selecciona el origen de la serie.");
      }
      if (candidate.source_type === "unit_type" && !candidate.unit_type_id) {
        throw new Error("Una serie por tipo de unidad requiere seleccionar un tipo de unidad.");
      }
      if (candidate.source_type === "cargo" && !candidate.cargo_id) {
        throw new Error("Una serie por cargo requiere seleccionar un cargo.");
      }
      if (candidate.source_type !== "legacy" && candidate.unit_type_id && candidate.cargo_id) {
        throw new Error("La serie debe asociarse a un tipo de unidad o a un cargo, no a ambos.");
      }
      break;
    case "process_target_rules":
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "reglas de alcance");
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una definicion de proceso.");
      }
      if (candidate.recipient_policy === "exact_position" && !candidate.position_id) {
        throw new Error("La politica exact_position requiere un puesto exacto.");
      }
      if (candidate.unit_scope_type === "unit_exact" || candidate.unit_scope_type === "unit_subtree") {
        if (!candidate.unit_id && !candidate.position_id) {
          throw new Error("El alcance por unidad requiere una unidad base.");
        }
      }
      if (candidate.unit_scope_type === "unit_type" && !candidate.unit_type_id) {
        throw new Error("El alcance por tipo requiere un tipo de unidad.");
      }
      break;
    case "process_definition_triggers":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una definicion de proceso.");
      }
      if (!candidate.trigger_mode) {
        throw new Error("Selecciona un modo de disparo.");
      }
      if (
        candidate.trigger_mode === "automatic_by_term_type"
        && !candidate.term_type_id
      ) {
        throw new Error("El disparo automatico requiere un tipo de periodo.");
      }
      if (
        ["manual_only", "manual_custom_term"].includes(String(candidate.trigger_mode))
        && candidate.term_type_id
      ) {
        throw new Error("Los disparos manuales no deben fijar un tipo de periodo.");
      }
      break;
    case "tasks":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una definicion de proceso.");
      }
      if (!candidate.term_id) {
        throw new Error("Selecciona un periodo para la tarea.");
      }
      if (!candidate.launch_mode || !["automatic", "manual"].includes(String(candidate.launch_mode))) {
        throw new Error("Selecciona un modo de lanzamiento valido.");
      }
      if (candidate.launch_mode === "manual" && !candidate.created_by_user_id) {
        throw new Error("Las tareas manuales requieren indicar quien las crea.");
      }
      if (candidate.launch_mode === "automatic" && candidate.created_by_user_id) {
        throw new Error("Las tareas automaticas no deben indicar usuario creador.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "tareas");
      break;
    case "task_items":
      if (!candidate.task_id) {
        throw new Error("Selecciona una tarea.");
      }
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso definido.");
      }
      if (!candidate.template_artifact_id) {
        throw new Error("Selecciona el paquete.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "items de tarea");
      break;
    case "documents":
      if (!candidate.task_item_id && !candidate.owner_person_id) {
        throw new Error("Selecciona el item de tarea o define un propietario para el documento.");
      }
      if (Object.prototype.hasOwnProperty.call(candidate, "status")) {
        candidate.status = assertDocumentStatusValue(candidate.status);
      }
      break;
    case "fill_flow_templates":
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso definido.");
      }
      break;
    case "fill_flow_steps":
      if (!candidate.fill_flow_template_id) {
        throw new Error("Selecciona la plantilla de llenado.");
      }
      if (!candidate.step_order) {
        throw new Error("Define el orden del paso.");
      }
      break;
    case "document_fill_flows":
      if (!candidate.fill_flow_template_id) {
        throw new Error("Selecciona la plantilla de llenado.");
      }
      if (!candidate.document_version_id) {
        throw new Error("Selecciona la version de documento.");
      }
      break;
    case "fill_requests":
      if (!candidate.document_fill_flow_id) {
        throw new Error("Selecciona la instancia de llenado.");
      }
      if (!candidate.fill_flow_step_id) {
        throw new Error("Selecciona el paso de llenado.");
      }
      break;
    case "signature_flow_templates":
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso definido.");
      }
      break;
    case "task_assignments":
      if (!candidate.task_id) {
        throw new Error("Selecciona una tarea para asignar.");
      }
      if (!candidate.position_id) {
        throw new Error("Selecciona un puesto para la asignacion.");
      }
      break;
    case "vacancies":
      break;
    case "contracts":
      ensureDateOrder(candidate.start_date, candidate.end_date, "contratos");
      break;
    case "role_assignments":
      break;
    case "document_versions":
      if (candidate.version !== undefined) {
        const versionValue = Number(candidate.version);
        if (Number.isNaN(versionValue) || versionValue < 0.1) {
          throw new Error("La version debe ser mayor o igual a 0.1.");
        }
      }
      if (Object.prototype.hasOwnProperty.call(candidate, "status")) {
        candidate.status = assertDocumentVersionStatusValue(candidate.status);
      }
      break;
    case "template_seeds":
      if (!candidate.seed_code || !candidate.source_path) {
        throw new Error("Debes registrar el codigo y la ruta fuente del seed.");
      }
      break;
    case "template_artifacts":
      if (candidate.artifact_stage && !ARTIFACT_STAGE_VALUES.has(String(candidate.artifact_stage))) {
        throw new Error("La etapa del artifact debe ser: draft, review, approved, published o archived.");
      }
      if (!candidate.bucket || !candidate.base_object_prefix) {
        throw new Error("Debes registrar bucket y prefijo base del artifact.");
      }
      {
        const availableFormats = parseJsonObject(candidate.available_formats, "Formatos disponibles (JSON)");
        if (!availableFormats || !Object.keys(availableFormats).length) {
          throw new Error("Debes registrar al menos un formato disponible en available_formats.");
        }
        if (!candidate.artifact_origin) {
          candidate.artifact_origin = candidate.owner_ref ? "general" : "process";
        }
      }
      break;
    default:
      break;
  }
};

const isBcryptHash = (value) => typeof value === "string" && BCRYPT_HASH_REGEX.test(value);

const validatePasswordPolicy = (password) => {
  const validations = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password)
  };

  const passedCriteria = Object.values(validations).filter(Boolean).length;
  if (passedCriteria < 3) {
    throw new Error(
      "La contraseña debe cumplir al menos 3 criterios: 8+ caracteres, mayúscula, minúscula, número."
    );
  }
};

const hashPassword = async (password) => {
  validatePasswordPolicy(password);
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const sanitizePersonRow = (tableName, row) => {
  if (tableName !== "persons" || !row || typeof row !== "object") {
    return row;
  }
  const safeRow = { ...row };
  delete safeRow.password_hash;
  return safeRow;
};

export default class SqlAdminService {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con MariaDB no esta disponible.");
    }
  }

  async ensureProcessDefinitionVersionAvailable(candidate, { excludeId = null } = {}) {
    this.ensurePool();
    const processId = Number(candidate?.process_id);
    const variationKey = String(candidate?.variation_key || "").trim();
    const definitionVersion = String(candidate?.definition_version || "").trim();

    if (!processId || !variationKey || !definitionVersion) {
      return;
    }

    const params = [processId, variationKey, definitionVersion];
    let query = `
      SELECT id
      FROM process_definition_versions
      WHERE process_id = ?
        AND variation_key = ?
        AND definition_version = ?`;

    if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
      query += "\n        AND id <> ?";
      params.push(Number(excludeId));
    }

    query += "\n      LIMIT 1";

    const [rows] = await this.pool.query(query, params);
    if (rows?.length) {
      throw new Error("Ya existe una definicion con esa serie y version para el proceso seleccionado.");
    }
  }

  async resolveProcessDefinitionSeries(candidate, { connection = this.pool, allowLegacy = false } = {}) {
    this.ensurePool();
    const seriesId = Number(candidate?.series_id);
    if (!seriesId) {
      throw new Error("Selecciona una serie valida para la definicion.");
    }
    const [rows] = await connection.query(
      `SELECT id, source_type, unit_type_id, cargo_id, code, is_active
       FROM process_definition_series
       WHERE id = ?
       LIMIT 1`,
      [seriesId]
    );
    const series = rows?.[0] || null;
    if (!series) {
      throw new Error("La serie seleccionada no existe.");
    }
    if (!Number(series.is_active)) {
      throw new Error("La serie seleccionada esta inactiva.");
    }
    if (!allowLegacy && String(series.source_type) === "legacy") {
      throw new Error("Las series heredadas no se pueden usar para nuevas definiciones. Crea una serie basada en tipo de unidad o cargo.");
    }
    return series;
  }

  async retireActiveDefinitionsInSeries({ processId, variationKey, excludeId = null, connection = this.pool }) {
    this.ensurePool();
    const normalizedProcessId = Number(processId);
    const normalizedVariationKey = String(variationKey || "").trim();
    if (!normalizedProcessId || !normalizedVariationKey) {
      return 0;
    }

    const params = [normalizedProcessId, normalizedVariationKey];
    let excludeSql = "";
    if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
      excludeSql = " AND id <> ?";
      params.push(Number(excludeId));
    }

    const [activeRows] = await connection.query(
      `SELECT id
       FROM process_definition_versions
       WHERE process_id = ?
         AND variation_key = ?
         AND status = 'active'${excludeSql}`,
      params
    );

    if (!activeRows?.length) {
      return 0;
    }

    await connection.query(
      `UPDATE process_definition_versions
       SET status = 'retired',
           effective_to = COALESCE(effective_to, CURDATE())
       WHERE process_id = ?
         AND variation_key = ?
         AND status = 'active'${excludeSql}`,
      params
    );

    return activeRows.length;
  }

  getMeta() {
    return Object.values(SQL_TABLE_MAP);
  }

  async ensureContractablePosition(positionId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      "SELECT position_type FROM unit_positions WHERE id = ? LIMIT 1",
      [positionId]
    );
    if (!rows?.length) {
      throw new Error("El puesto seleccionado no existe.");
    }
    if (!["real", "promocion"].includes(rows[0].position_type)) {
      throw new Error("Solo se permiten vacantes para ocupaciones reales o de promocion.");
    }
  }

  async list(tableName, { q, limit, offset, orderBy, order, filters = {} } = {}) {
    this.ensurePool();
    const config = getConfig(tableName);
    const physicalFields = config.fields.filter((field) => !field.virtual).map((field) => field.name);
    const availableFields = config.fields.map((field) => field.name);
    const orderableFields = [...physicalFields];

    const params = [];
    const conditions = [];
    let joinClause = "";
    let selectClause = `SELECT ${physicalFields.join(", ")}`;
    let groupByClause = "";
    let columnPrefix = "";
    const normalizedFilters = { ...filters };

    if (tableName === "processes") {
      joinClause = `LEFT JOIN (
        SELECT process_id, definition_version, status
        FROM (
          SELECT
            process_id,
            definition_version,
            status,
            ROW_NUMBER() OVER (
              PARTITION BY process_id
              ORDER BY effective_from DESC, id DESC
            ) AS rn
          FROM process_definition_versions
          WHERE status IN ('draft', 'active')
        ) ranked_pd
        WHERE rn = 1
      ) pd_main ON pd_main.process_id = processes.id`;
      columnPrefix = "processes.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      if (availableFields.includes("active_definition_version")) {
        selectFields.push("pd_main.definition_version AS active_definition_version");
        orderableFields.push("active_definition_version");
      }
      if (availableFields.includes("active_definition_status")) {
        selectFields.push("pd_main.status AS active_definition_status");
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;
    }

    if (tableName === "process_target_rules") {
      joinClause = "LEFT JOIN process_definition_versions pd_rule ON pd_rule.id = process_target_rules.process_definition_id";
      columnPrefix = "process_target_rules.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      selectClause = `SELECT ${selectFields.join(", ")}`;

      const definitionStatus = normalizedFilters.definition_status;
      delete normalizedFilters.definition_status;

      if (definitionStatus !== undefined && definitionStatus !== null && definitionStatus !== "") {
        conditions.push("pd_rule.status = ?");
        params.push(definitionStatus);
      }

    }

    if (tableName === "template_artifacts") {
      joinClause = "LEFT JOIN template_seeds ts ON ts.id = template_artifacts.template_seed_id";
      columnPrefix = "template_artifacts.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      if (availableFields.includes("seed_display_name")) {
        selectFields.push("ts.display_name AS seed_display_name");
        orderableFields.push("seed_display_name");
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;
    }

    if (q && config.searchFields?.length) {
      const like = `%${q}%`;
      const searchClauses = config.searchFields.map((field) => `${columnPrefix}${field} LIKE ?`);
      conditions.push(`(${searchClauses.join(" OR ")})`);
      params.push(...config.searchFields.map(() => like));
    }

    for (const [field, value] of Object.entries(normalizedFilters)) {
      if (!physicalFields.includes(field)) {
        continue;
      }
      if (value === undefined || value === null || value === "") {
        continue;
      }
      const fieldMeta = config.fields.find((meta) => meta.name === field);
      const columnName = columnPrefix ? `${columnPrefix}${field}` : field;
      if (["text", "email", "textarea"].includes(fieldMeta?.type)) {
        conditions.push(`${columnName} LIKE ?`);
        params.push(`%${value}%`);
      } else {
        conditions.push(`${columnName} = ?`);
        params.push(value);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeOrderBy = orderableFields.includes(orderBy) ? orderBy : config.primaryKeys[0];
    const orderColumn =
      (tableName === "processes" && safeOrderBy === "active_definition_version")
        ? safeOrderBy
        : (tableName === "template_artifacts" && safeOrderBy === "seed_display_name")
          ? safeOrderBy
        : joinClause
          ? `${tableName}.${safeOrderBy}`
          : safeOrderBy;
    const safeOrder = order?.toLowerCase() === "asc" ? "ASC" : "DESC";
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : DEFAULT_LIMIT;
    const safeOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;

    const [rows] = await this.pool.query(
      `${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${groupByClause}
       ORDER BY ${orderColumn} ${safeOrder} LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    return tableName === "persons" ? rows.map((row) => sanitizePersonRow(tableName, row)) : rows;
  }

  async getByKeys(tableName, keys) {
    this.ensurePool();
    const config = getConfig(tableName);
    const { where, params } = buildWhere(config.primaryKeys, keys);
    const fields = config.fields.filter((field) => !field.virtual).map((field) => field.name);
    const [rows] = await this.pool.query(
      `SELECT ${fields.join(", ")} FROM ${tableName} WHERE ${where} LIMIT 1`,
      params
    );
    return rows?.[0] ?? null;
  }

  async getTaskTemplate(templateId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT id, process_definition_id, template_artifact_id, usage_role, instance_mode, sort_order, creates_task
       FROM process_definition_templates
       WHERE id = ?
       LIMIT 1`,
      [templateId]
    );
    return rows?.[0] ?? null;
  }

  async getTemplateArtifact(artifactId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT
         id,
         template_code,
         display_name,
         storage_version,
         bucket,
         meta_object_key
       FROM template_artifacts
       WHERE id = ?
       LIMIT 1`,
      [artifactId]
    );
    return rows?.[0] ?? null;
  }

  async loadTemplateArtifactMetaDocument(artifact, connection = this.pool) {
    if (!artifact?.bucket || !artifact?.meta_object_key) {
      return null;
    }
    const content = await readMinioObjectAsText(
      artifact.bucket,
      String(artifact.meta_object_key || "").trim()
    );
    return parseYamlDocument(content, {
      filePath: `${artifact.bucket}/${artifact.meta_object_key}`
    });
  }

  async syncArtifactWorkflowsForTemplateArtifactId(artifactId, connection = this.pool) {
    const artifact = await this.getTemplateArtifact(artifactId, connection);
    if (!artifact?.id) {
      return null;
    }

    const metaDocument = await this.loadTemplateArtifactMetaDocument(artifact, connection);
    const fillSyncSummary = await this.syncArtifactFillWorkflowForArtifact({
      connection,
      artifactId: Number(artifact.id),
      templateCode: artifact.template_code,
      storageVersion: artifact.storage_version,
      displayName: artifact.display_name,
      metaDocument
    });

    const signatureSyncSummary = await this.syncArtifactSignatureWorkflowForArtifact({
      connection,
      artifactId: Number(artifact.id),
      templateCode: artifact.template_code,
      storageVersion: artifact.storage_version,
      displayName: artifact.display_name,
      metaDocument
    });

    return {
      fill: fillSyncSummary,
      signatures: signatureSyncSummary
    };
  }

  async getTaskItem(taskItemId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, task_id, process_definition_template_id, template_artifact_id, start_date, end_date, user_started_at
       FROM task_items
       WHERE id = ?
       LIMIT 1`,
      [taskItemId]
    );
    return rows?.[0] ?? null;
  }

  async getProcessRun(processRunId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, process_definition_id, term_id, run_mode, created_by_user_id
       FROM process_runs
       WHERE id = ?
       LIMIT 1`,
      [processRunId]
    );
    return rows?.[0] ?? null;
  }

  async getFillFlowTemplate(fillFlowTemplateId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, process_definition_template_id
       FROM fill_flow_templates
       WHERE id = ?
       LIMIT 1`,
      [fillFlowTemplateId]
    );
    return rows?.[0] ?? null;
  }

  async getProcessDefinitionVersion(definitionId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, process_id, variation_key, status
       FROM process_definition_versions
       WHERE id = ?
       LIMIT 1`,
      [definitionId]
    );
    return rows?.[0] ?? null;
  }

  async getTermWithType(termId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT
         t.id,
         t.term_type_id,
         tt.code AS term_type_code
       FROM terms t
       INNER JOIN term_types tt
         ON tt.id = t.term_type_id
       WHERE t.id = ?
       LIMIT 1`,
      [termId]
    );
    return rows?.[0] ?? null;
  }

  async ensureDraftDefinitionContext(definitionId, { connection = this.pool, entityLabel = "registros asociados" } = {}) {
    const definition = await this.getProcessDefinitionVersion(definitionId, connection);
    if (!definition) {
      throw new Error("La definicion de proceso seleccionada no existe.");
    }
    if (String(definition.status || "") !== "draft") {
      throw new Error(`Solo se pueden modificar ${entityLabel} cuando la definicion esta en draft.`);
    }
    return definition;
  }

  async cloneProcessDefinitionChildren({
    sourceDefinitionId,
    targetDefinitionId,
    targetProcessId,
    connection = this.pool
  }) {
    const normalizedSourceId = Number(sourceDefinitionId);
    const normalizedTargetId = Number(targetDefinitionId);
    const normalizedTargetProcessId = Number(targetProcessId);

    if (!normalizedSourceId || !normalizedTargetId) {
      return { clonedTemplates: 0, clonedRules: 0, clonedTriggers: 0 };
    }

    const sourceDefinition = await this.getProcessDefinitionVersion(normalizedSourceId, connection);
    if (!sourceDefinition) {
      throw new Error("La definicion origen para clonar no existe.");
    }
    if (normalizedTargetProcessId && Number(sourceDefinition.process_id) !== normalizedTargetProcessId) {
      throw new Error("Solo se puede clonar desde una definicion del mismo proceso.");
    }

    const [templateRows] = await connection.query(
      `SELECT template_artifact_id, usage_role, instance_mode, creates_task, is_required, sort_order
       FROM process_definition_templates
       WHERE process_definition_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [normalizedSourceId]
    );

    for (const row of templateRows) {
      await connection.query(
        `INSERT INTO process_definition_templates (
          process_definition_id,
          template_artifact_id,
          usage_role,
          instance_mode,
          creates_task,
          is_required,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedTargetId,
          row.template_artifact_id,
          row.usage_role,
          row.instance_mode || "single_document",
          row.creates_task,
          row.is_required,
          row.sort_order
        ]
      );

      if (row.template_artifact_id) {
        await this.syncArtifactWorkflowsForTemplateArtifactId(Number(row.template_artifact_id), connection);
      }
    }

    const [ruleRows] = await connection.query(
      `SELECT unit_scope_type,
              unit_id,
              unit_type_id,
              include_descendants,
              cargo_id,
              position_id,
              recipient_policy,
              priority,
              is_active,
              effective_from,
              effective_to
       FROM process_target_rules
       WHERE process_definition_id = ?
       ORDER BY priority ASC, id ASC`,
      [normalizedSourceId]
    );

    for (const row of ruleRows) {
      await connection.query(
        `INSERT INTO process_target_rules (
          process_definition_id,
          unit_scope_type,
          unit_id,
          unit_type_id,
          include_descendants,
          cargo_id,
          position_id,
          recipient_policy,
          priority,
          is_active,
          effective_from,
          effective_to
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedTargetId,
          row.unit_scope_type,
          row.unit_id,
          row.unit_type_id,
          row.include_descendants,
          row.cargo_id,
          row.position_id,
          row.recipient_policy,
          row.priority,
          row.is_active,
          row.effective_from,
          row.effective_to
        ]
      );
    }

    const [triggerRows] = await connection.query(
      `SELECT trigger_mode,
              term_type_id,
              is_active
       FROM process_definition_triggers
       WHERE process_definition_id = ?
       ORDER BY id ASC`,
      [normalizedSourceId]
    );

    for (const row of triggerRows) {
      await connection.query(
        `INSERT INTO process_definition_triggers (
          process_definition_id,
          trigger_mode,
          term_type_id,
          is_active
        ) VALUES (?, ?, ?, ?)`,
        [
          normalizedTargetId,
          row.trigger_mode,
          row.term_type_id,
          row.is_active
        ]
      );
    }

    return {
      clonedTemplates: templateRows.length,
      clonedRules: ruleRows.length,
      clonedTriggers: triggerRows.length
    };
  }

  async ensureDefinitionHasArtifactsForActivation(definitionId, candidate = null, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const requiresDocument = Number(candidate?.has_document ?? 0) === 1;
    if (!requiresDocument) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_definition_templates
       WHERE process_definition_id = ?`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una definicion con documento si no tiene al menos un artifact vinculado en Plantillas de definicion."
      );
    }
  }

  async ensureDefinitionHasActiveRulesForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_target_rules
       WHERE process_definition_id = ?
         AND is_active = 1`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una definicion si no tiene al menos una regla activa en Reglas de alcance."
      );
    }
  }

  async ensureDefinitionHasActiveTriggersForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_definition_triggers
       WHERE process_definition_id = ?
         AND is_active = 1`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una definicion si no tiene al menos un disparador activo en Disparadores de definiciones."
      );
    }
  }

  async ensureDefinitionTriggerAllowsTaskLaunch(
    definitionId,
    termId,
    launchMode,
    connection = this.pool
  ) {
    const normalizedDefinitionId = Number(definitionId);
    const normalizedTermId = Number(termId);
    const normalizedLaunchMode = String(launchMode || "manual");

    if (!normalizedDefinitionId || !normalizedTermId) {
      throw new Error("La tarea requiere una definicion y un periodo validos.");
    }

    const term = await this.getTermWithType(normalizedTermId, connection);
    if (!term) {
      throw new Error("El periodo seleccionado no existe.");
    }

    let triggerMode;
    let triggerParams;
    if (normalizedLaunchMode === "automatic") {
      triggerMode = "automatic_by_term_type";
      triggerParams = [normalizedDefinitionId, triggerMode, Number(term.term_type_id)];
    } else if (String(term.term_type_code || "").toUpperCase() === "CUS") {
      triggerMode = "manual_custom_term";
      triggerParams = [normalizedDefinitionId, triggerMode];
    } else {
      triggerMode = "manual_only";
      triggerParams = [normalizedDefinitionId, triggerMode];
    }

    const triggerSql =
      triggerMode === "automatic_by_term_type"
        ? `SELECT id
           FROM process_definition_triggers
           WHERE process_definition_id = ?
             AND trigger_mode = ?
             AND term_type_id = ?
             AND is_active = 1
           LIMIT 1`
        : `SELECT id
           FROM process_definition_triggers
           WHERE process_definition_id = ?
             AND trigger_mode = ?
             AND is_active = 1
           LIMIT 1`;

    const [rows] = await connection.query(triggerSql, triggerParams);
    if (!rows?.length) {
      if (triggerMode === "automatic_by_term_type") {
        throw new Error("La definicion no tiene un disparador automatico activo para el tipo de periodo seleccionado.");
      }
      if (triggerMode === "manual_custom_term") {
        throw new Error("La definicion no tiene un disparador manual activo para periodos custom.");
      }
      throw new Error("La definicion no tiene un disparador manual activo para el periodo seleccionado.");
    }
  }

  async create(tableName, data) {
    this.ensurePool();
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);
    const cloneSourceDefinitionId = (
      tableName === "process_definition_versions"
      && data?.source_process_definition_id !== undefined
      && data?.source_process_definition_id !== null
      && data?.source_process_definition_id !== ""
    )
      ? Number(data.source_process_definition_id)
      : null;

    if (tableName === "process_definition_versions") {
      if (typeof payload.definition_version === "string") {
        payload.definition_version = payload.definition_version.trim();
      }
    }

    if (tableName === "process_definition_series") {
      const sourceType = String(payload.source_type || "").trim();
      payload.source_type = sourceType;
      let code = "";
      if (sourceType === "unit_type") {
        const unitType = await this.getByKeys("unit_types", { id: payload.unit_type_id });
        if (!unitType) {
          throw new Error("El tipo de unidad seleccionado no existe.");
        }
        payload.cargo_id = null;
        code = slugify(unitType.name);
      } else if (sourceType === "cargo") {
        const cargo = await this.getByKeys("cargos", { id: payload.cargo_id });
        if (!cargo) {
          throw new Error("El cargo seleccionado no existe.");
        }
        payload.unit_type_id = null;
        code = slugify(cargo.name);
      } else {
        throw new Error("Selecciona un origen de serie valido.");
      }
      const [dupRows] = await this.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
         LIMIT 1`,
        [code]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe una serie con ese origen.");
      }
      payload.code = code;
    }

    if (tableName === "persons") {
      const rawPassword = typeof data?.password === "string" ? data.password : "";
      if (rawPassword) {
        payload.password_hash = await hashPassword(rawPassword);
      } else if (typeof payload.password_hash === "string" && payload.password_hash) {
        if (!isBcryptHash(payload.password_hash)) {
          payload.password_hash = await hashPassword(payload.password_hash);
        }
      } else {
        throw new Error("Ingresa el password del usuario.");
      }
    }

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_triggers"
    ) {
      await this.ensureDraftDefinitionContext(
        payload.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de definicion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los disparadores de definicion"
        }
      );
    }

    if (tableName === "process_definition_triggers") {
      const definition = await this.getProcessDefinitionVersion(payload.process_definition_id);
      if (!definition) {
        throw new Error("La definicion de proceso seleccionada no existe.");
      }
      if (String(payload.trigger_mode || "") !== "automatic_by_term_type") {
        payload.term_type_id = null;
      }
    }

    if (tableName === "tasks") {
      const definition = await this.getProcessDefinitionVersion(payload.process_definition_id);
      if (!definition) {
        throw new Error("La definicion de proceso seleccionada no existe.");
      }
      if (String(definition.status || "") !== "active") {
        throw new Error("Solo se pueden instanciar tareas desde definiciones activas.");
      }
      payload.launch_mode = String(payload.launch_mode || "manual");
      if (payload.launch_mode === "automatic") {
        payload.created_by_user_id = null;
      }
      await this.ensureDefinitionTriggerAllowsTaskLaunch(
        payload.process_definition_id,
        payload.term_id,
        payload.launch_mode
      );

      if (payload.process_run_id) {
        const processRun = await this.getProcessRun(payload.process_run_id);
        if (!processRun) {
          throw new Error("La corrida de proceso seleccionada no existe.");
        }
        if (Number(processRun.process_definition_id) !== Number(payload.process_definition_id)) {
          throw new Error("La corrida de proceso no pertenece a la definicion seleccionada.");
        }
        if (Number(processRun.term_id || 0) !== Number(payload.term_id || 0)) {
          throw new Error("La corrida de proceso no pertenece al periodo seleccionado.");
        }
      }
    }

    if (tableName === "task_items" && payload.process_definition_template_id) {
      const template = await this.getTaskTemplate(payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definido seleccionada no existe.");
      }
      if (!Number(template.creates_task)) {
        throw new Error("La plantilla seleccionada no esta marcada para generar items de tarea.");
      }
      const task = await this.getByKeys("tasks", { id: payload.task_id });
      if (!task) {
        throw new Error("La tarea seleccionada no existe.");
      }
      if (Number(task.process_definition_id) !== Number(template.process_definition_id)) {
        throw new Error("La plantilla seleccionada no pertenece a la definicion de proceso de la tarea.");
      }
      payload.template_artifact_id = template.template_artifact_id;
      payload.template_usage_role = template.usage_role;
      if (!payload.start_date) {
        payload.start_date = task.start_date;
      }
      if (payload.end_date === undefined || payload.end_date === "") {
        payload.end_date = task.end_date ?? null;
      }
      if (payload.sort_order === undefined || payload.sort_order === null || payload.sort_order === "") {
        payload.sort_order = template.sort_order;
      }
    }

    if (tableName === "documents" && payload.task_item_id) {
      const taskItem = await this.getTaskItem(payload.task_item_id);
      if (!taskItem) {
        throw new Error("El item de tarea seleccionado no existe.");
      }
      payload.origin_type = payload.origin_type || "task_item";
    }

    if (tableName === "documents" && !payload.task_item_id) {
      if (!payload.owner_person_id) {
        throw new Error("Los documentos standalone requieren un propietario.");
      }
      payload.origin_type = payload.origin_type || "standalone";
    }

    if (tableName === "fill_flow_templates" && payload.process_definition_template_id) {
      const template = await this.getTaskTemplate(payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definido seleccionada no existe.");
      }
      payload.process_definition_id = template.process_definition_id;
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de llenado" }
      );
      delete payload.process_definition_id;
    }

    if (tableName === "fill_flow_steps" && payload.fill_flow_template_id) {
      const fillFlowTemplate = await this.getFillFlowTemplate(payload.fill_flow_template_id);
      if (!fillFlowTemplate) {
        throw new Error("La plantilla de llenado seleccionada no existe.");
      }
      const template = await this.getTaskTemplate(fillFlowTemplate.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definida asociada no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los pasos de llenado" }
      );
    }

    if (tableName === "document_versions" && payload.document_id) {
      const document = await this.getByKeys("documents", { id: payload.document_id });
      if (!document) {
        throw new Error("El documento seleccionado no existe.");
      }
      if (!payload.template_artifact_id && document.task_item_id) {
        const taskItem = await this.getTaskItem(document.task_item_id);
        if (taskItem?.template_artifact_id) {
          payload.template_artifact_id = taskItem.template_artifact_id;
        }
      }
    }

    if (tableName === "signature_flow_templates" && payload.process_definition_template_id) {
      const template = await this.getTaskTemplate(payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definido seleccionada no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }

    if (tableName === "template_artifacts") {
      throw new Error("Los artifacts se registran por sincronizacion desde MinIO o mediante el flujo de artifact general.");
    }

    const required = config.fields.filter((field) => field.required && !field.readOnly && !field.virtual);
    const missing = required.filter((field) => payload[field.name] === undefined || payload[field.name] === "");

    if (missing.length) {
      throw new Error(`Datos incompletos: ${missing.map((field) => field.label || field.name).join(", ")}`);
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

    if (tableName === "process_definition_versions") {
      const requestedStatus = String(payload.status || "draft");
      if (requestedStatus !== "draft") {
        throw new Error("Las nuevas definiciones solo pueden crearse en estado draft.");
      }
      const series = await this.resolveProcessDefinitionSeries(payload);
      payload.variation_key = String(series.code || "").trim();
      payload.status = "draft";
      await this.ensureProcessDefinitionVersionAvailable(payload);
    }

    if (tableName === "vacancies") {
      await this.ensureContractablePosition(payload.position_id ?? data?.position_id);
    }

    const columns = Object.keys(payload);
    if (!columns.length) {
      throw new Error("No hay datos para insertar.");
    }

    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");
    let result;
    let createNotice = "";
    try {
      if (tableName === "process_definition_versions") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;

          if (cloneSourceDefinitionId) {
            const cloneSummary = await this.cloneProcessDefinitionChildren({
              sourceDefinitionId: cloneSourceDefinitionId,
              targetDefinitionId: insertResult.insertId,
              targetProcessId: payload.process_id,
              connection
            });
            if (cloneSummary.clonedTemplates || cloneSummary.clonedRules || cloneSummary.clonedTriggers) {
              createNotice =
                `Se clonaron ${cloneSummary.clonedTemplates} plantillas, ${cloneSummary.clonedRules} reglas`
                + ` y ${cloneSummary.clonedTriggers} disparadores desde la definicion origen.`;
            }
          }

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "tasks") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          if (!payload.process_run_id) {
            payload.process_run_id = await ensureProcessRun({
              connection,
              processDefinitionId: Number(payload.process_definition_id),
              termId: Number(payload.term_id),
              runMode: payload.launch_mode === "automatic" ? "automatic_term" : "manual",
              createdByUserId: payload.launch_mode === "manual" ? payload.created_by_user_id : null,
              status: "active"
            });
          }
          const taskColumns = Object.keys(payload);
          const taskPlaceholders = taskColumns.map(() => "?").join(", ");
          const taskValues = taskColumns.map((key) => payload[key]);
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${taskColumns.join(", ")}) VALUES (${taskPlaceholders})`,
            taskValues
          );
          result = insertResult;
          await hydrateTaskFromDefinition({
            connection,
            taskId: insertResult.insertId,
            processDefinitionId: Number(payload.process_definition_id),
            termId: Number(payload.term_id)
          });
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "task_items") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          const taskItem = await this.getTaskItem(insertResult.insertId, connection);
          if (taskItem) {
            await ensureDocumentForTaskItem(connection, taskItem);
          } else {
            await ensureDocumentsForTask(connection, Number(payload.task_id));
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "process_definition_templates") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          if (payload.template_artifact_id) {
            await this.syncArtifactWorkflowsForTemplateArtifactId(Number(payload.template_artifact_id), connection);
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_versions") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await ensureFillFlowForDocumentVersion(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "fill_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await syncDocumentProgressFromFillRequest(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "signature_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await syncDocumentProgressFromSignatureRequest(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_signatures") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await syncDocumentProgressFromDocumentSignature(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else {
        const [insertResult] = await this.pool.query(
          `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
          values
        );
        result = insertResult;
      }
    } catch (error) {
      if (
        tableName === "process_definition_versions"
        && error?.code === "ER_DUP_ENTRY"
        && String(error?.message || "").includes("uq_process_definition_one_active_series")
      ) {
        throw new Error("Solo puede existir una definicion activa por serie dentro del mismo proceso.");
      }
      if (
        tableName === "tasks"
        && error?.code === "ER_DUP_ENTRY"
      ) {
        throw new Error("Ya existe una instancia de tarea con esa definicion, periodo y criterio de lanzamiento.");
      }
      throw error;
    }
    const created = { id: result.insertId, ...payload };
    if (createNotice) {
      return {
        ...sanitizePersonRow(tableName, created),
        __notice: createNotice
      };
    }
    return sanitizePersonRow(tableName, created);
  }

  async update(tableName, keys, data) {
    this.ensurePool();
    const config = getConfig(tableName);

    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);
    const updates = pickPayload(config.fields, data);
    const existing = await this.getByKeys(tableName, keyPayload);
    if (!existing) {
      throw new Error("Registro no encontrado.");
    }

    if (tableName === "persons" && Object.prototype.hasOwnProperty.call(data, "password")) {
      const rawPassword = typeof data.password === "string" ? data.password : "";
      if (rawPassword) {
        updates.password_hash = await hashPassword(rawPassword);
      }
    }
    if (tableName === "persons" && typeof updates.password_hash === "string" && updates.password_hash) {
      if (!isBcryptHash(updates.password_hash)) {
        updates.password_hash = await hashPassword(updates.password_hash);
      }
    }
    if (tableName === "tasks") {
      if (
        Object.prototype.hasOwnProperty.call(updates, "process_definition_id")
      ) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la definicion de una tarea ya instanciada.");
        }
        delete updates.process_definition_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "term_id")) {
        if (Number(updates.term_id) !== Number(existing.term_id)) {
          throw new Error("No se puede cambiar el periodo de una tarea ya instanciada.");
        }
        delete updates.term_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "launch_mode")) {
        if (String(updates.launch_mode) !== String(existing.launch_mode)) {
          throw new Error("No se puede cambiar el modo de lanzamiento de una tarea existente.");
        }
        delete updates.launch_mode;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "created_by_user_id")) {
        if (Number(updates.created_by_user_id || 0) !== Number(existing.created_by_user_id || 0)) {
          throw new Error("No se puede cambiar el usuario creador de una tarea existente.");
        }
        delete updates.created_by_user_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "process_run_id")) {
        if (Number(updates.process_run_id || 0) !== Number(existing.process_run_id || 0)) {
          throw new Error("No se puede cambiar la corrida de proceso de una tarea existente.");
        }
        delete updates.process_run_id;
      }
    }
    if (tableName === "task_items") {
      if (Object.prototype.hasOwnProperty.call(updates, "task_id")) {
        if (Number(updates.task_id) !== Number(existing.task_id)) {
          throw new Error("No se puede cambiar la tarea asociada de un item.");
        }
        delete updates.task_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un item.");
        }
        delete updates.process_definition_template_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "template_artifact_id")) {
        if (Number(updates.template_artifact_id) !== Number(existing.template_artifact_id)) {
          throw new Error("No se puede cambiar el paquete asociado de un item.");
        }
        delete updates.template_artifact_id;
      }
    }
    if (tableName === "documents") {
      if (Object.prototype.hasOwnProperty.call(updates, "task_item_id")) {
        if (Number(updates.task_item_id) !== Number(existing.task_item_id)) {
          throw new Error("No se puede cambiar el item de tarea asociado de un documento.");
        }
        delete updates.task_item_id;
      }
    }
    if (tableName === "signature_flow_templates") {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un flujo de firma.");
        }
        delete updates.process_definition_template_id;
      }
      const template = await this.getTaskTemplate(existing.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definido asociada al flujo ya no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }
    if (tableName === "fill_flow_templates") {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un flujo de llenado.");
        }
        delete updates.process_definition_template_id;
      }
      const template = await this.getTaskTemplate(existing.process_definition_template_id);
      if (template) {
        await this.ensureDraftDefinitionContext(
          template.process_definition_id,
          { entityLabel: "los flujos de llenado" }
        );
      }
    }
    if (tableName === "fill_flow_steps") {
      if (Object.prototype.hasOwnProperty.call(updates, "fill_flow_template_id")) {
        if (Number(updates.fill_flow_template_id) !== Number(existing.fill_flow_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un paso de llenado.");
        }
        delete updates.fill_flow_template_id;
      }
      const fillFlowTemplate = await this.getFillFlowTemplate(existing.fill_flow_template_id);
      if (fillFlowTemplate) {
        const template = await this.getTaskTemplate(fillFlowTemplate.process_definition_template_id);
        if (template) {
          await this.ensureDraftDefinitionContext(
            template.process_definition_id,
            { entityLabel: "los pasos de llenado" }
          );
        }
      }
    }
    if (tableName === "process_definition_triggers") {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_id")) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la definicion asociada de este disparador.");
        }
        delete updates.process_definition_id;
      }
      if (
        Object.prototype.hasOwnProperty.call(updates, "trigger_mode")
        && String(updates.trigger_mode || "") !== "automatic_by_term_type"
      ) {
        updates.term_type_id = null;
      }
    }
    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_triggers"
    ) {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_id")) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la definicion asociada de este registro.");
        }
        delete updates.process_definition_id;
      }
      await this.ensureDraftDefinitionContext(
        existing.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de definicion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los disparadores de definicion"
        }
      );
    }
    if (tableName === "process_definition_series") {
      const candidateSeries = { ...existing, ...updates };
      const sourceType = String(candidateSeries.source_type || existing.source_type || "").trim();
      if (sourceType === "legacy") {
        throw new Error("Las series legacy no se editan manualmente.");
      }
      let code = "";
      if (sourceType === "unit_type") {
        if (!candidateSeries.unit_type_id) {
          throw new Error("La serie requiere un tipo de unidad.");
        }
        const unitType = await this.getByKeys("unit_types", { id: candidateSeries.unit_type_id });
        if (!unitType) {
          throw new Error("El tipo de unidad seleccionado no existe.");
        }
        updates.cargo_id = null;
        code = slugify(unitType.name);
      } else if (sourceType === "cargo") {
        if (!candidateSeries.cargo_id) {
          throw new Error("La serie requiere un cargo.");
        }
        const cargo = await this.getByKeys("cargos", { id: candidateSeries.cargo_id });
        if (!cargo) {
          throw new Error("El cargo seleccionado no existe.");
        }
        updates.unit_type_id = null;
        code = slugify(cargo.name);
      } else {
        throw new Error("El origen de serie no es valido.");
      }
      const [dupRows] = await this.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
           AND id <> ?
         LIMIT 1`,
        [code, Number(existing.id)]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe otra serie con ese origen.");
      }
      updates.code = code;
    }
    if (tableName === "template_artifacts") {
      if (String(existing.artifact_origin || "process") === "process") {
        throw new Error("Los artifacts de proceso se sincronizan desde MinIO y no se pueden editar manualmente.");
      }
      if (Object.prototype.hasOwnProperty.call(updates, "artifact_origin")) {
        if (String(updates.artifact_origin || "") !== String(existing.artifact_origin || "")) {
          throw new Error("No se puede cambiar el origen del artifact.");
        }
        delete updates.artifact_origin;
      }
    }
    let activateDraftVersion = false;
    let processDefinitionActivationNotice = "";
    let processDefinitionSeriesContext = null;

    if (tableName === "process_definition_versions") {
      if (typeof updates.definition_version === "string") {
        updates.definition_version = updates.definition_version.trim();
      }

      const normalizeComparableValue = (fieldName, value) => {
        if (value === null || value === undefined || value === "") {
          return null;
        }
        const fieldMeta = config.fields.find((field) => field.name === fieldName);
        if (value instanceof Date) {
          if (fieldMeta?.type === "date") {
            return value.toISOString().slice(0, 10);
          }
          if (fieldMeta?.type === "datetime") {
            return value.toISOString().slice(0, 19).replace("T", " ");
          }
          return value.toISOString();
        }
        if (fieldMeta?.type === "number" || fieldMeta?.type === "boolean") {
          const numeric = Number(value);
          return Number.isNaN(numeric) ? String(value) : String(numeric);
        }
        return String(value);
      };

      const isSameValue = (fieldName, left, right) => {
        const normalizedLeft = normalizeComparableValue(fieldName, left);
        const normalizedRight = normalizeComparableValue(fieldName, right);
        return normalizedLeft === normalizedRight;
      };

      if (Object.prototype.hasOwnProperty.call(updates, "definition_version")) {
        if (!isSameValue("definition_version", updates.definition_version, existing.definition_version)) {
          throw new Error("No se puede modificar el numero de version de una definicion.");
        }
        delete updates.definition_version;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "process_id")) {
        if (!isSameValue("process_id", updates.process_id, existing.process_id)) {
          throw new Error("No se puede cambiar el proceso de una definicion.");
        }
        delete updates.process_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "series_id")) {
        if (!isSameValue("series_id", updates.series_id, existing.series_id)) {
          throw new Error("No se puede cambiar la serie de una definicion.");
        }
        delete updates.series_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "variation_key")) {
        if (!isSameValue("variation_key", updates.variation_key, existing.variation_key)) {
          throw new Error("No se puede cambiar la serie de una definicion.");
        }
        delete updates.variation_key;
      }

      Object.keys(updates).forEach((key) => {
        if (isSameValue(key, updates[key], existing[key])) {
          delete updates[key];
        }
      });

      const currentStatus = String(existing.status || "draft");
      const nextStatus = Object.prototype.hasOwnProperty.call(updates, "status")
        ? String(updates.status || "")
        : currentStatus;

      const allowedTransitions = {
        draft: new Set(["draft", "active", "retired"]),
        active: new Set(["active", "retired"]),
        retired: new Set(["retired"])
      };
      const currentAllowedTransitions = allowedTransitions[currentStatus] || new Set([currentStatus]);
      if (!currentAllowedTransitions.has(nextStatus)) {
        throw new Error(`No se permite cambiar una definicion ${currentStatus} a ${nextStatus}.`);
      }

      let allowed;
      let errorMessage;
      if (currentStatus === "draft") {
        allowed = new Set([
          "name",
          "description",
          "has_document",
          "status",
          "effective_from",
          "effective_to"
        ]);
        errorMessage = "Una definicion en borrador solo permite cambios funcionales y de estado.";
      } else if (currentStatus === "active") {
        allowed = new Set(["status", "effective_to"]);
        errorMessage = "Una definicion activa solo permite cambiar estado o vigencia final.";
      } else {
        allowed = new Set();
        errorMessage = "Una definicion retirada es de solo lectura.";
      }

      const disallowed = Object.keys(updates).filter((key) => !allowed.has(key));
      if (disallowed.length) {
        throw new Error(errorMessage);
      }

      if (currentStatus === "draft" && nextStatus === "active") {
        activateDraftVersion = true;
        processDefinitionSeriesContext = {
          processId: existing.process_id,
          variationKey: existing.variation_key,
          excludeId: existing.id ?? keyPayload.id
        };
      }
    }

    const allowPrimaryKeyUpdate = config.allowPrimaryKeyUpdate === true;
    const columns = Object.keys(updates).filter((column) =>
      allowPrimaryKeyUpdate ? true : !config.primaryKeys.includes(column)
    );
    if (!columns.length) {
      throw new Error("No hay cambios para actualizar.");
    }

    const setClause = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => updates[column]);

    const candidate = { ...existing, ...updates };
    validateFieldTypes(config, candidate);
    validateTableRules(tableName, candidate);

    try {
      if (tableName === "process_definition_versions" && activateDraftVersion) {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await this.ensureDefinitionHasActiveRulesForActivation(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasActiveTriggersForActivation(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasArtifactsForActivation(existing.id ?? keyPayload.id, candidate, connection);
          const retiredCount = await this.retireActiveDefinitionsInSeries({
            ...processDefinitionSeriesContext,
            connection
          });
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await connection.commit();
          if (retiredCount > 0) {
            processDefinitionActivationNotice = "La definicion activa anterior de la misma serie fue retirada automaticamente.";
          }
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_versions") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          if (Object.prototype.hasOwnProperty.call(updates, "status")) {
            const nextStatus = String(updates.status || "").trim().toLowerCase();
            if (nextStatus === "listo para firma") {
              const documentVersionId = Number(existing.id ?? keyPayload.id);
              const signatureFlowResult = await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
              if (signatureFlowResult && !signatureFlowResult.ok) {
                console.warn(
                  `[SqlAdminService] DocumentVersion ${documentVersionId} cannot enter signature: ${signatureFlowResult.reason}`
                );
              }
            }
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "fill_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await syncDocumentProgressFromFillRequest(connection, Number(existing.id ?? keyPayload.id));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "signature_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await syncDocumentProgressFromSignatureRequest(connection, Number(existing.id ?? keyPayload.id));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_signatures") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await syncDocumentProgressFromDocumentSignature(connection, Number(existing.id ?? keyPayload.id));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "process_definition_templates") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          const rawArtifactId =
            updates.template_artifact_id
            ?? existing.template_artifact_id
            ?? keyPayload.template_artifact_id
            ?? 0;
          const artifactId = Number(rawArtifactId);
          if (artifactId) {
            await this.syncArtifactWorkflowsForTemplateArtifactId(artifactId, connection);
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else {
        await this.pool.query(
          `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
          [...values, ...params]
        );
        if (tableName === "process_definition_series" && Object.prototype.hasOwnProperty.call(updates, "code")) {
          await this.pool.query(
            `UPDATE process_definition_versions
             SET variation_key = ?
             WHERE series_id = ?`,
            [updates.code, Number(existing.id)]
          );
        }
      }
    } catch (error) {
      if (
        tableName === "process_definition_versions"
        && error?.code === "ER_DUP_ENTRY"
        && String(error?.message || "").includes("uq_process_definition_one_active_series")
      ) {
        throw new Error("Solo puede existir una definicion activa por serie dentro del mismo proceso.");
      }
      throw error;
    }
    if (tableName === "tasks" && Object.prototype.hasOwnProperty.call(updates, "status")) {
      const taskId = existing.id ?? keyPayload.id;
      await updateParentTaskStatusForTask(taskId);
    }
    const updatedRow = sanitizePersonRow(tableName, { ...keyPayload, ...updates });
    if (processDefinitionActivationNotice) {
      return {
        ...updatedRow,
        __notice: processDefinitionActivationNotice
      };
    }
    return updatedRow;
  }

  async getProcessDefinitionTemplatesByArtifact(artifactId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT
         pdt.id,
         pdt.process_definition_id,
         pdt.template_artifact_id,
         pdv.name AS process_definition_name
       FROM process_definition_templates pdt
       INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
       WHERE pdt.template_artifact_id = ?
       ORDER BY pdt.id ASC`,
      [artifactId]
    );
    return rows;
  }

  async getSyncedFillFlowTemplate(processDefinitionTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id
       FROM fill_flow_templates
       WHERE process_definition_template_id = ?
         AND description LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [processDefinitionTemplateId, `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}%`]
    );
    return rows?.[0] || null;
  }

  async getSyncedSignatureFlowTemplate(processDefinitionTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id
       FROM signature_flow_templates
       WHERE process_definition_template_id = ?
         AND description LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [processDefinitionTemplateId, `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}%`]
    );
    return rows?.[0] || null;
  }

  async getCargoCodeMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, code, name
       FROM cargos
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedCode = slugify(row.code || "");
      const normalizedName = slugify(row.name || "");
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, Number(row.id));
      }
      if (normalizedName && !map.has(normalizedName)) {
        map.set(normalizedName, Number(row.id));
      }
    }
    return map;
  }

  async getSignatureTypeCodeMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, code
       FROM signature_types
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedCode = slugify(row.code);
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, Number(row.id));
      }
    }
    return map;
  }

  async getUnitTypeNameMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, name
       FROM unit_types
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedName = String(row.name || "").trim().toLowerCase();
      if (normalizedName && !map.has(normalizedName)) {
        map.set(normalizedName, Number(row.id));
      }
    }
    return map;
  }

  async ensureSignatureTypeCatalog(connection = this.pool) {
    await connection.query(
      `INSERT INTO signature_types (code, name, description, is_active)
       VALUES
         ('electronic', 'Firma electronica', 'Firma electronica general sincronizada desde artifacts', 1),
         ('digital', 'Firma digital', 'Firma digital general sincronizada desde artifacts', 1)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         is_active = VALUES(is_active)`
    );
  }

  async replaceSyncedFillFlowSteps(fillFlowTemplateId, steps, connection = this.pool) {
    await connection.query(
      "DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?",
      [fillFlowTemplateId]
    );

    for (const step of steps) {
      await connection.query(
        `INSERT INTO fill_flow_steps (
           fill_flow_template_id,
           step_order,
           resolver_type,
           assigned_person_id,
           unit_scope_type,
           unit_id,
           unit_type_id,
           cargo_id,
           position_id,
           selection_mode,
           is_required,
           can_reject
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fillFlowTemplateId,
          step.stepOrder,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
          step.cargoId,
          step.positionId,
          step.selectionMode,
          step.isRequired,
          step.canReject
        ]
      );
    }
  }

  async hasFillFlowTemplateRuntimeUsage(fillFlowTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT EXISTS(
         SELECT 1
         FROM document_fill_flows dff
         LEFT JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
         WHERE dff.fill_flow_template_id = ?
         LIMIT 1
       ) AS has_usage`,
      [fillFlowTemplateId]
    );
    return Boolean(Number(rows?.[0]?.has_usage || 0));
  }

  async replaceSyncedSignatureFlowSteps(signatureFlowTemplateId, steps, connection = this.pool) {
    await connection.query(
      "DELETE FROM signature_flow_steps WHERE template_id = ?",
      [signatureFlowTemplateId]
    );

    for (const step of steps) {
      await connection.query(
        `INSERT INTO signature_flow_steps (
           template_id,
           step_order,
           code,
           name,
           slot,
           step_type_id,
           resolver_type,
           assigned_person_id,
           unit_scope_type,
           unit_id,
           unit_type_id,
           position_id,
           required_cargo_id,
           selection_mode,
           approval_mode,
         required_signers_min,
         required_signers_max,
         is_required,
         anchor_refs
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          signatureFlowTemplateId,
          step.stepOrder,
          step.code,
          step.name,
          step.slot,
          step.stepTypeId,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
          step.positionId,
          step.requiredCargoId,
          step.selectionMode,
          step.approvalMode,
          step.requiredSignersMin,
          step.requiredSignersMax,
          step.isRequired,
          JSON.stringify(Array.isArray(step.anchorRefs) ? step.anchorRefs : [])
        ]
      );
    }
  }

  async hasSignatureFlowTemplateRuntimeUsage(signatureFlowTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT EXISTS(
         SELECT 1
         FROM signature_flow_instances sfi
         LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
         LEFT JOIN document_signatures ds ON ds.signature_request_id = sr.id
         WHERE sfi.template_id = ?
         LIMIT 1
       ) AS has_usage`,
      [signatureFlowTemplateId]
    );
    return Boolean(Number(rows?.[0]?.has_usage || 0));
  }

  async syncArtifactFillWorkflowForArtifact({
    connection,
    artifactId,
    templateCode,
    storageVersion,
    displayName,
    metaDocument
  }) {
    const workflow = metaDocument?.workflows?.fill || {};
    const processTemplates = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    if (!processTemplates.length) {
      return {
        linkedTemplates: 0,
        syncedTemplates: 0,
        syncedSteps: 0,
        deactivatedTemplates: 0
      };
    }

    const syncEnabled = isArtifactFillWorkflowSyncEnabled(workflow);
    const cargoCodeMap = syncEnabled ? await this.getCargoCodeMap(connection) : new Map();
    const normalizedSteps = syncEnabled
      ? normalizeFillSteps(workflow, { cargoCodeMap })
      : [];
    const templateName = String(workflow?.name || "").trim() || `Flujo de llenado - ${displayName}`;
    const templateDescription = buildArtifactSyncedFillDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    let syncedTemplates = 0;
    let syncedSteps = 0;
    let deactivatedTemplates = 0;

    for (const processTemplate of processTemplates) {
      const existingTemplate = await this.getSyncedFillFlowTemplate(processTemplate.id, connection);

      if (!syncEnabled || !normalizedSteps.length) {
        if (existingTemplate?.id) {
          await connection.query(
            `UPDATE fill_flow_templates
             SET is_active = 0,
                 name = ?,
                 description = ?
             WHERE id = ?`,
            [templateName, templateDescription, existingTemplate.id]
          );
          deactivatedTemplates += 1;
        }
        continue;
      }

      let fillFlowTemplateId = existingTemplate?.id ? Number(existingTemplate.id) : null;
      const templateHasRuntimeUsage = fillFlowTemplateId
        ? await this.hasFillFlowTemplateRuntimeUsage(fillFlowTemplateId, connection)
        : false;

      if (!fillFlowTemplateId || templateHasRuntimeUsage) {
        const [insertResult] = await connection.query(
          `INSERT INTO fill_flow_templates (
             process_definition_template_id,
             name,
             description,
             is_active
           ) VALUES (?, ?, ?, 1)`,
          [processTemplate.id, templateName, templateDescription]
        );
        fillFlowTemplateId = Number(insertResult.insertId);
      } else {
        await connection.query(
          `UPDATE fill_flow_templates
           SET name = ?,
               description = ?,
               is_active = 1
           WHERE id = ?`,
          [templateName, templateDescription, fillFlowTemplateId]
        );
      }

      await connection.query(
        `UPDATE fill_flow_templates
         SET is_active = 0
         WHERE process_definition_template_id = ?
           AND description LIKE ?
           AND id <> ?`,
        [processTemplate.id, `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}%`, fillFlowTemplateId]
      );

      await this.replaceSyncedFillFlowSteps(fillFlowTemplateId, normalizedSteps, connection);
      syncedTemplates += 1;
      syncedSteps += normalizedSteps.length;
    }

    return {
      linkedTemplates: processTemplates.length,
      syncedTemplates,
      syncedSteps,
      deactivatedTemplates
    };
  }

  async syncArtifactSignatureWorkflowForArtifact({
    connection,
    artifactId,
    templateCode,
    storageVersion,
    displayName,
    metaDocument
  }) {
    const workflow = metaDocument?.workflows?.signatures || {};
    const processTemplates = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    if (!processTemplates.length) {
      return {
        linkedTemplates: 0,
        syncedTemplates: 0,
        syncedSteps: 0,
        deactivatedTemplates: 0
      };
    }

    await this.ensureSignatureTypeCatalog(connection);
    const syncEnabled = isArtifactSignatureWorkflowSyncEnabled(workflow);
    const templateName = String(workflow?.name || "").trim() || `Flujo de firma - ${displayName}`;
    const templateDescription = buildArtifactSyncedSignatureDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    const cargoCodeMap = await this.getCargoCodeMap(connection);
    const signatureTypeCodeMap = await this.getSignatureTypeCodeMap(connection);
    const unitTypeNameMap = await this.getUnitTypeNameMap(connection);
    const normalizationIssues = syncEnabled
      ? collectSignatureWorkflowNormalizationIssues(workflow, { cargoCodeMap, signatureTypeCodeMap })
      : [];
    if (normalizationIssues.length) {
      throw new Error(
        `No se pudo sincronizar el flujo de firmas de ${templateCode}: ${normalizationIssues.join(" ")}`
      );
    }
    const normalizedSteps = syncEnabled
      ? normalizeSignatureSteps(workflow, { cargoCodeMap, signatureTypeCodeMap, unitTypeNameMap })
      : [];

    let syncedTemplates = 0;
    let syncedSteps = 0;
    let deactivatedTemplates = 0;

    for (const processTemplate of processTemplates) {
      const existingTemplate = await this.getSyncedSignatureFlowTemplate(processTemplate.id, connection);

      if (!syncEnabled || !normalizedSteps.length) {
        if (existingTemplate?.id) {
          await connection.query(
            `UPDATE signature_flow_templates
             SET is_active = 0,
                 name = ?,
                 description = ?
             WHERE id = ?`,
            [templateName, templateDescription, existingTemplate.id]
          );
          deactivatedTemplates += 1;
        }
        continue;
      }

      let signatureFlowTemplateId = existingTemplate?.id ? Number(existingTemplate.id) : null;
      const templateHasRuntimeUsage = signatureFlowTemplateId
        ? await this.hasSignatureFlowTemplateRuntimeUsage(signatureFlowTemplateId, connection)
        : false;

      if (!signatureFlowTemplateId || templateHasRuntimeUsage) {
        const [insertResult] = await connection.query(
          `INSERT INTO signature_flow_templates (
             process_definition_template_id,
             name,
             description,
             is_active
           ) VALUES (?, ?, ?, 1)`,
          [processTemplate.id, templateName, templateDescription]
        );
        signatureFlowTemplateId = Number(insertResult.insertId);
      } else {
        await connection.query(
          `UPDATE signature_flow_templates
           SET name = ?,
               description = ?,
               is_active = 1
           WHERE id = ?`,
          [templateName, templateDescription, signatureFlowTemplateId]
        );
      }

      await connection.query(
        `UPDATE signature_flow_templates
         SET is_active = 0
         WHERE process_definition_template_id = ?
           AND description LIKE ?
           AND id <> ?`,
        [processTemplate.id, `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}%`, signatureFlowTemplateId]
      );

      await this.replaceSyncedSignatureFlowSteps(signatureFlowTemplateId, normalizedSteps, connection);
      syncedTemplates += 1;
      syncedSteps += normalizedSteps.length;
    }

    return {
      linkedTemplates: processTemplates.length,
      syncedTemplates,
      syncedSteps,
      deactivatedTemplates
    };
  }

  async syncTemplateArtifactsFromDist() {
    this.ensurePool();

    if (!fs.existsSync(TEMPLATE_DIST_ROOT)) {
      throw new Error("No existe tools/templates/dist/Plantillas. Ejecuta el empaquetado primero.");
    }

    const templateRootEntries = fs.readdirSync(TEMPLATE_DIST_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());

    if (!templateRootEntries.length) {
      throw new Error("No hay templates empaquetados en tools/templates/dist/Plantillas.");
    }

    const bucket = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";
    const basePrefixRoot = (process.env.MINIO_TEMPLATES_PREFIX || "System").replace(/^\/+|\/+$/g, "");

    let inserted = 0;
    let updated = 0;
    let discovered = 0;
    let outputs = 0;
    let fillTemplatesSynced = 0;
    let fillStepsSynced = 0;
    let fillTemplatesDeactivated = 0;
    let signatureTemplatesSynced = 0;
    let signatureStepsSynced = 0;
    let signatureTemplatesDeactivated = 0;

    for (const templateEntry of templateRootEntries) {
      const templateCode = templateEntry.name;
      const templateDir = path.join(TEMPLATE_DIST_ROOT, templateCode);
      const storageEntries = fs.readdirSync(templateDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory());

      for (const storageEntry of storageEntries) {
        const storageVersion = storageEntry.name;
        const versionDir = path.join(templateDir, storageVersion);
        const metaPath = path.join(versionDir, "meta.yaml");
        const schemaPath = path.join(versionDir, "schema.json");
        const packagedTemplateDir = path.join(versionDir, "template");

        if (!fs.existsSync(metaPath) || !fs.existsSync(packagedTemplateDir)) {
          continue;
        }

        const metaContent = fs.readFileSync(metaPath, "utf8");
        const metaDocument = parseYamlDocument(metaContent, { filePath: metaPath });
        const displayName = getYamlScalar(metaContent, "name") || templateCode;
        const sourceVersion = getYamlScalar(metaContent, "version") || "1.0.0";
        const repositoryStage = (getYamlScalar(metaContent, "repository_stage") || "published").trim() || "published";
        const rawSeedCode = getYamlScalar(metaContent, "seed_code") || "";
        const legacySeedName = getYamlScalar(metaContent, "seed") || "";
        if (!ARTIFACT_STAGE_VALUES.has(repositoryStage)) {
          throw new Error(
            `El repository_stage de ${metaPath} debe ser uno de: draft, review, approved, published, archived.`
          );
        }
        const versionHash = hashDirectory(versionDir);
        const baseObjectPrefix = `${basePrefixRoot}/${templateCode}/${storageVersion}/`;
        const schemaObjectKey = `${baseObjectPrefix}schema.json`;
        const metaObjectKey = `${baseObjectPrefix}meta.yaml`;
        let templateSeedId = null;
        const candidateSeedCodes = [];
        if (rawSeedCode) {
          candidateSeedCodes.push(rawSeedCode);
        }
        if (legacySeedName) {
          candidateSeedCodes.push(`latex/${legacySeedName}`);
          candidateSeedCodes.push(legacySeedName);
        }
        for (const candidateSeedCode of candidateSeedCodes) {
          const [seedRows] = await this.pool.query(
            `SELECT id
             FROM template_seeds
             WHERE seed_code = ?
             LIMIT 1`,
            [candidateSeedCode]
          );
          if (seedRows?.length) {
            templateSeedId = seedRows[0].id;
            break;
          }
        }

        const candidates = [
          {
            mode: "process",
            format: "jinja2",
            dirPath: path.join(packagedTemplateDir, "modes", "process", "jinja2", "src")
          },
          {
            mode: "general",
            format: "docx",
            dirPath: path.join(packagedTemplateDir, "modes", "general", "docx", "src")
          },
          {
            mode: "general",
            format: "latex",
            dirPath: path.join(packagedTemplateDir, "modes", "general", "latex", "src")
          },
          {
            mode: "general",
            format: "pdf",
            dirPath: path.join(packagedTemplateDir, "modes", "general", "pdf", "src")
          },
          {
            mode: "general",
            format: "xlsx",
            dirPath: path.join(packagedTemplateDir, "modes", "general", "xlsx", "src")
          }
        ];

        const availableFormats = {};
        for (const candidate of candidates) {
          if (!hasVisibleFiles(candidate.dirPath)) {
            continue;
          }

          const entryObjectKey = `${baseObjectPrefix}template/modes/${candidate.mode}/${candidate.format}/src/`;
          if (!availableFormats[candidate.mode]) {
            availableFormats[candidate.mode] = {};
          }
          availableFormats[candidate.mode][candidate.format] = {
            entry_object_key: entryObjectKey
          };
          outputs += 1;
        }

        if (!Object.keys(availableFormats).length) {
          continue;
        }

        discovered += 1;
        const availableFormatsJson = JSON.stringify(availableFormats);
        const [existingRows] = await this.pool.query(
          `SELECT id
           FROM template_artifacts
           WHERE template_code = ?
             AND storage_version = ?
           LIMIT 1`,
          [templateCode, storageVersion]
        );

        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();

          let artifactId = null;

          if (existingRows?.length) {
            artifactId = Number(existingRows[0].id);
            await connection.query(
              `UPDATE template_artifacts
               SET display_name = ?,
                   description = COALESCE(description, NULL),
                   owner_ref = NULL,
                   owner_person_id = NULL,
                   artifact_origin = 'process',
                   source_version = ?,
                   artifact_stage = ?,
                   template_seed_id = ?,
                   bucket = ?,
                   base_object_prefix = ?,
                   available_formats = ?,
                   schema_object_key = ?,
                   meta_object_key = ?,
                   content_hash = ?,
                   is_active = 1
               WHERE id = ?`,
              [
                displayName,
                sourceVersion,
                repositoryStage,
                templateSeedId,
                bucket,
                baseObjectPrefix,
                availableFormatsJson,
                schemaObjectKey,
                metaObjectKey,
                versionHash,
                artifactId
              ]
            );
            updated += 1;
          } else {
            const [insertResult] = await connection.query(
              `INSERT INTO template_artifacts (
                template_seed_id,
                owner_person_id,
                template_code,
                display_name,
                description,
                owner_ref,
                artifact_origin,
                source_version,
                storage_version,
                artifact_stage,
                bucket,
                base_object_prefix,
                available_formats,
                schema_object_key,
                meta_object_key,
                content_hash,
                is_active
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                templateSeedId,
                null,
                templateCode,
                displayName,
                null,
                null,
                "process",
                sourceVersion,
                storageVersion,
                repositoryStage,
                bucket,
                baseObjectPrefix,
                availableFormatsJson,
                schemaObjectKey,
                metaObjectKey,
                versionHash
              ]
            );
            artifactId = Number(insertResult.insertId);
            inserted += 1;
          }

          const fillSyncSummary = await this.syncArtifactFillWorkflowForArtifact({
            connection,
            artifactId,
            templateCode,
            storageVersion,
            displayName,
            metaDocument
          });

          const signatureSyncSummary = await this.syncArtifactSignatureWorkflowForArtifact({
            connection,
            artifactId,
            templateCode,
            storageVersion,
            displayName,
            metaDocument
          });

          fillTemplatesSynced += Number(fillSyncSummary.syncedTemplates || 0);
          fillStepsSynced += Number(fillSyncSummary.syncedSteps || 0);
          fillTemplatesDeactivated += Number(fillSyncSummary.deactivatedTemplates || 0);
          signatureTemplatesSynced += Number(signatureSyncSummary.syncedTemplates || 0);
          signatureStepsSynced += Number(signatureSyncSummary.syncedSteps || 0);
          signatureTemplatesDeactivated += Number(signatureSyncSummary.deactivatedTemplates || 0);

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }
    }

    return {
      discovered,
      outputs,
      inserted,
      updated,
      fillTemplatesSynced,
      fillStepsSynced,
      fillTemplatesDeactivated,
      signatureTemplatesSynced,
      signatureStepsSynced,
      signatureTemplatesDeactivated,
      bucket,
      prefix: basePrefixRoot
    };
  }

  async syncTemplateSeedsFromSource() {
    this.ensurePool();
    const bucket = MINIO_TEMPLATES_BUCKET;
    const prefixRoot = `${MINIO_TEMPLATES_SEEDS_PREFIX}/`;
    const objectNames = await listMinioObjects(bucket, prefixRoot, true);
    if (!objectNames.length) {
      throw new Error(`No existen seeds publicados en MinIO bajo ${prefixRoot}`);
    }

    let discovered = 0;
    let inserted = 0;
    let updated = 0;

    const seedGroups = new Map();
    for (const objectName of objectNames) {
      if (!objectName.startsWith(prefixRoot)) {
        continue;
      }
      const relativePath = objectName.slice(prefixRoot.length);
      const parts = relativePath.split("/").filter(Boolean);
      if (parts.length < 2) {
        continue;
      }

      const seedType = parts[0];
      const seedName = parts[1];
      const seedCode = `${seedType}/${seedName}`;
      const objectSuffix = parts.slice(2).join("/");

      if (!seedGroups.has(seedCode)) {
        seedGroups.set(seedCode, {
          seedCode,
          displayName: humanizeSlug(seedName),
          seedType,
          sourcePath: `${prefixRoot}${seedType}/${seedName}/`,
          previewPath: null,
          readmeObjectKey: null,
          objectNames: []
        });
      }

      const group = seedGroups.get(seedCode);
      group.objectNames.push(objectName);
      if (!group.readmeObjectKey && objectSuffix === "README.md") {
        group.readmeObjectKey = objectName;
      }
    }

    for (const group of seedGroups.values()) {
      discovered += 1;
      group.previewPath = findPreferredPdfObject(group.objectNames);
      let description = `Seed ${group.displayName}`;
      if (group.readmeObjectKey) {
        try {
          const readmeStream = await getMinioObjectStream(bucket, group.readmeObjectKey);
          const readmeContent = (await streamToBuffer(readmeStream)).toString("utf8");
          const firstBodyLine = readmeContent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith("#"));
          if (firstBodyLine) {
            description = firstBodyLine.slice(0, 255);
          }
        } catch {
          // Fallback to generated description.
        }
      }

      const [existingRows] = await this.pool.query(
        `SELECT id
         FROM template_seeds
         WHERE seed_code = ?
         LIMIT 1`,
        [group.seedCode]
      );

      if (existingRows?.length) {
        await this.pool.query(
          `UPDATE template_seeds
           SET display_name = ?,
               description = ?,
               seed_type = ?,
               source_path = ?,
               preview_path = ?,
               is_active = 1
           WHERE id = ?`,
          [group.displayName, description, group.seedType, group.sourcePath, group.previewPath, existingRows[0].id]
        );
        updated += 1;
      } else {
        await this.pool.query(
          `INSERT INTO template_seeds (
            seed_code,
            display_name,
            description,
            seed_type,
            source_path,
            preview_path,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [group.seedCode, group.displayName, description, group.seedType, group.sourcePath, group.previewPath]
        );
        inserted += 1;
      }
    }

    return { discovered, inserted, updated, bucket, prefix: MINIO_TEMPLATES_SEEDS_PREFIX };
  }

  async getTemplateSeedPreview(seedId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT id, display_name, preview_path, source_path
       FROM template_seeds
       WHERE id = ?
       LIMIT 1`,
      [Number(seedId)]
    );
    const row = rows?.[0];
    if (!row) {
      throw new Error("El seed seleccionado no existe.");
    }
    if (!row.preview_path) {
      const seedObjects = await listMinioObjects(MINIO_TEMPLATES_BUCKET, row.source_path, true);
      const fallbackPreviewPath = findPreferredPdfObject(seedObjects);
      if (!fallbackPreviewPath) {
        throw new Error("El seed seleccionado no tiene preview PDF publicado en MinIO.");
      }
      row.preview_path = fallbackPreviewPath;
      await this.pool.query(
        "UPDATE template_seeds SET preview_path = ? WHERE id = ?",
        [fallbackPreviewPath, row.id]
      );
    }
    let objectStream;
    try {
      objectStream = await getMinioObjectStream(MINIO_TEMPLATES_BUCKET, row.preview_path);
    } catch (error) {
      const message = String(error?.message || "");
      if (!/does not exist|NoSuchKey/i.test(message)) {
        throw error;
      }
      const seedObjects = await listMinioObjects(MINIO_TEMPLATES_BUCKET, row.source_path, true);
      const fallbackPreviewPath = findPreferredPdfObject(seedObjects);
      if (!fallbackPreviewPath) {
        throw new Error("El seed seleccionado no tiene preview PDF publicado en MinIO.");
      }
      row.preview_path = fallbackPreviewPath;
      await this.pool.query(
        "UPDATE template_seeds SET preview_path = ? WHERE id = ?",
        [fallbackPreviewPath, row.id]
      );
      objectStream = await getMinioObjectStream(MINIO_TEMPLATES_BUCKET, row.preview_path);
    }
    return {
      stream: objectStream,
      fileName: `${slugify(row.display_name || "seed") || "seed"}-preview.pdf`
    };
  }

  async getNextStorageVersionForTemplateCode(templateCode, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT storage_version
       FROM template_artifacts
       WHERE template_code = ?`,
      [templateCode]
    );
    let maxVersion = 0;
    for (const row of rows || []) {
      const match = String(row.storage_version || "").match(/^v(\d+)$/i);
      if (!match) {
        continue;
      }
      maxVersion = Math.max(maxVersion, Number(match[1]));
    }
    return `v${String(maxVersion + 1).padStart(4, "0")}`;
  }

  async createTemplateArtifactDraft(data = {}, files = {}) {
    return this.saveTemplateArtifactDraft(null, data, files);
  }

  async updateTemplateArtifactDraft(artifactId, data = {}, files = {}) {
    return this.saveTemplateArtifactDraft(artifactId, data, files);
  }

  async saveTemplateArtifactDraft(artifactId, data = {}, files = {}) {
    this.ensurePool();

    const displayName = String(data.display_name || "").trim();
    const description = String(data.description || "").trim() || null;
    const sourceVersion = String(data.source_version || "1.0.0").trim();
    const ownerCedula = String(data.owner_cedula || "").trim();
    const requestedOwnerPersonId = normalizeNumericId(data.owner_person_id);
    const templateSeedId = data.template_seed_id ? Number(data.template_seed_id) : null;
    const isEdit = artifactId !== null && artifactId !== undefined && artifactId !== "";

    if (!displayName) {
      throw new Error("Ingresa el nombre del artifact borrador.");
    }
    if (!ownerCedula && !isEdit) {
      throw new Error("No se pudo inferir la cedula del usuario actual para crear el borrador.");
    }

    const uploadedFiles = {
      pdf: files?.pdf_file?.[0] || null,
      docx: files?.docx_file?.[0] || null,
      xlsx: files?.xlsx_file?.[0] || null,
      pptx: files?.pptx_file?.[0] || null
    };

    let existingArtifact = null;
    if (isEdit) {
      existingArtifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
      if (!existingArtifact) {
        throw new Error("El artifact seleccionado no existe.");
      }
      if (String(existingArtifact.artifact_origin || "process") !== "general") {
        throw new Error("Solo se pueden editar artifacts generales con este flujo.");
      }
    }

    const existingAvailableFormats = parseAvailableFormats(existingArtifact?.available_formats);

    if (
      !templateSeedId
      && !Object.values(uploadedFiles).some(Boolean)
      && !Object.keys(existingAvailableFormats).length
    ) {
      throw new Error("Selecciona un seed o sube al menos un archivo para crear el borrador.");
    }

    const ownerRef = String(existingArtifact?.owner_ref || ownerCedula).slice(0, 180);
    if (!ownerRef) {
      throw new Error("No se pudo resolver el propietario del artifact.");
    }
    let ownerPersonId = normalizeNumericId(existingArtifact?.owner_person_id);
    if (requestedOwnerPersonId) {
      const ownerPerson = await this.getByKeys("persons", { id: requestedOwnerPersonId });
      if (!ownerPerson) {
        throw new Error("La persona propietaria indicada no existe.");
      }
      ownerPersonId = requestedOwnerPersonId;
    } else if (!ownerPersonId && ownerRef) {
      const [ownerRows] = await this.pool.query(
        `SELECT id
         FROM persons
         WHERE cedula = ?
         LIMIT 1`,
        [ownerRef]
      );
      if (ownerRows?.length) {
        ownerPersonId = ownerRows[0].id;
      }
    }
    const baseSlug = slugify(displayName) || "artifact";
    const templateCode = String(existingArtifact?.template_code || `draft_${baseSlug}`).slice(0, 180);
    const storageVersion = existingArtifact?.storage_version || await this.getNextStorageVersionForTemplateCode(templateCode);
    const bucket = String(existingArtifact?.bucket || MINIO_TEMPLATES_BUCKET);
    const baseObjectPrefix = String(existingArtifact?.base_object_prefix || `${TEMPLATE_USERS_PREFIX}/${ownerRef}/${templateCode}/${storageVersion}/`);
    const artifactStage = String(existingArtifact?.artifact_stage || "draft");
    const draftDir = path.join(
      BACKEND_STORAGE_ROOT,
      "minio-jobs",
      "templates-drafts",
      ownerRef,
      templateCode,
      storageVersion
    );

    fs.rmSync(draftDir, { recursive: true, force: true });
    fs.mkdirSync(draftDir, { recursive: true });
    fs.mkdirSync(path.join(draftDir, "template", "modes"), { recursive: true });
    const availableFormats = {};

    const preserveExistingFormat = async (mode, format) => {
      const existingEntry = existingAvailableFormats?.[mode]?.[format];
      if (!existingEntry?.entry_object_key) {
        return false;
      }
      const targetDir = buildArtifactModeDir(draftDir, mode, format);
      const existingObjectKey = String(existingEntry.entry_object_key);
      if (/\.[a-z0-9]+$/i.test(existingObjectKey)) {
        const fileName = path.basename(existingObjectKey);
        await copyMinioObjectToFile(bucket, existingObjectKey, path.join(targetDir, fileName));
      } else {
        await downloadMinioPrefixToDirectory(bucket, existingObjectKey, targetDir);
      }
      setAvailableFormatEntry(availableFormats, mode, format, baseObjectPrefix);
      return true;
    };

    let seedRow = null;
    if (templateSeedId) {
      seedRow = await this.getByKeys("template_seeds", { id: templateSeedId });
      if (!seedRow) {
        throw new Error("El seed seleccionado no existe.");
      }
      await downloadMinioPrefixToDirectory(
        MINIO_TEMPLATES_BUCKET,
        `${seedRow.source_path}src/`,
        buildArtifactModeDir(draftDir, "process", "jinja2")
      );
      setAvailableFormatEntry(availableFormats, "process", "jinja2", baseObjectPrefix);
      const defaultsObjectKey = `${seedRow.source_path}defaults.yaml`;
      try {
        await copyMinioObjectToFile(
          MINIO_TEMPLATES_BUCKET,
          defaultsObjectKey,
          path.join(draftDir, "data.yaml")
        );
      } catch {
        // Optional for non-latex seeds.
      }
      if (String(seedRow.seed_type || "").toLowerCase() === "latex") {
        await downloadMinioPrefixToDirectory(
          MINIO_TEMPLATES_BUCKET,
          `${seedRow.source_path}render/`,
          buildArtifactModeDir(draftDir, "general", "latex")
        );
        setAvailableFormatEntry(availableFormats, "general", "latex", baseObjectPrefix);
      }
    }

    if (!seedRow) {
      await preserveExistingFormat("process", "jinja2");
      await preserveExistingFormat("general", "latex");
    }

    const fileFieldMap = {
      pdf: "pdf",
      docx: "docx",
      xlsx: "xlsx",
      pptx: "pptx"
    };

    for (const [format, file] of Object.entries(uploadedFiles)) {
      const relativeDir = path.join("template", "modes", "general", fileFieldMap[format], "src");
      const targetDir = path.join(draftDir, relativeDir);
      const existingEntry = existingAvailableFormats?.general?.[fileFieldMap[format]];

      if (file) {
        const safeName = slugify(path.parse(file.originalname || format).name) || format;
        const extension = path.extname(file.originalname || "") || `.${format}`;
        const fallbackFileName = `${safeName}${extension.toLowerCase()}`;
        const fileName = existingEntry?.entry_object_key
          ? path.basename(existingEntry.entry_object_key)
          : fallbackFileName;
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, fileName), file.buffer);
        setAvailableFormatEntry(availableFormats, "general", fileFieldMap[format], baseObjectPrefix);
        continue;
      }

      if (existingEntry?.entry_object_key) {
        const existingObjectKey = String(existingEntry.entry_object_key);
        if (/\.[a-z0-9]+$/i.test(existingObjectKey)) {
          const fileName = path.basename(existingObjectKey);
          await copyMinioObjectToFile(bucket, existingObjectKey, path.join(targetDir, fileName));
        } else {
          await downloadMinioPrefixToDirectory(bucket, existingObjectKey, targetDir);
        }
        setAvailableFormatEntry(availableFormats, "general", fileFieldMap[format], baseObjectPrefix);
      }
    }

    if (!Object.keys(availableFormats).length) {
      throw new Error("No se detectaron formatos disponibles para el borrador.");
    }

    const schemaObjectKey = `${baseObjectPrefix}schema.json`;
    const metaObjectKey = `${baseObjectPrefix}meta.yaml`;
    fs.writeFileSync(path.join(draftDir, "schema.json"), "{}\n", "utf8");
    const metaLines = [
      `name: "${displayName.replace(/"/g, '\\"')}"`,
      `version: "${sourceVersion.replace(/"/g, '\\"')}"`,
      `template_code: "${templateCode.replace(/"/g, '\\"')}"`,
      `owner_ref: "${ownerRef.replace(/"/g, '\\"')}"`,
      `stage: ${artifactStage}`
    ];
    if (description) {
      metaLines.push(`description: "${description.replace(/"/g, '\\"')}"`);
    }
    if (seedRow?.seed_code) {
      metaLines.push(`seed_code: "${String(seedRow.seed_code).replace(/"/g, '\\"')}"`);
    }
    fs.writeFileSync(
      path.join(draftDir, "meta.yaml"),
      `${metaLines.join("\n")}\n${ARTIFACT_WORKFLOW_CONTRACT}\n`,
      "utf8"
    );
    validatePackagedArtifactDraft(draftDir, availableFormats);

    const contentHash = hashDirectory(draftDir);
    let createdId = isEdit ? Number(existingArtifact.id) : null;

    try {
      await uploadDirectoryToMinio(bucket, baseObjectPrefix, draftDir);

      if (isEdit) {
        await this.pool.query(
          `UPDATE template_artifacts
           SET template_seed_id = ?,
               owner_person_id = ?,
               display_name = ?,
               description = ?,
               owner_ref = ?,
               artifact_origin = 'general',
               source_version = ?,
               artifact_stage = ?,
               bucket = ?,
               base_object_prefix = ?,
               available_formats = ?,
               schema_object_key = ?,
               meta_object_key = ?,
               content_hash = ?,
               is_active = 1
           WHERE id = ?`,
          [
            templateSeedId,
            ownerPersonId,
            displayName,
            description,
            ownerRef,
            sourceVersion,
            artifactStage,
            bucket,
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash,
            createdId
          ]
        );
      } else {
        const [result] = await this.pool.query(
          `INSERT INTO template_artifacts (
            template_seed_id,
            owner_person_id,
            template_code,
            display_name,
            description,
            owner_ref,
            artifact_origin,
            source_version,
            storage_version,
            artifact_stage,
            bucket,
            base_object_prefix,
            available_formats,
            schema_object_key,
            meta_object_key,
            content_hash,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 1)`,
          [
            templateSeedId,
            ownerPersonId,
            templateCode,
            displayName,
            description,
            ownerRef,
            "general",
            sourceVersion,
            storageVersion,
            bucket,
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash
          ]
        );
        createdId = result.insertId;
      }

      return {
        id: createdId,
        template_seed_id: templateSeedId,
        owner_person_id: ownerPersonId,
        template_code: templateCode,
        display_name: displayName,
        description,
        owner_ref: ownerRef,
        artifact_origin: "general",
        source_version: sourceVersion,
        storage_version: storageVersion,
        artifact_stage: artifactStage,
        bucket,
        base_object_prefix: baseObjectPrefix,
        available_formats: availableFormats,
        schema_object_key: schemaObjectKey,
        meta_object_key: metaObjectKey,
        content_hash: contentHash,
        is_active: 1,
        __notice: isEdit
          ? "El artifact general fue actualizado y cargado correctamente en MinIO."
          : "El artifact general fue cargado correctamente en MinIO y registrado en el sistema."
      };
    } catch (error) {
      if (createdId && !isEdit) {
        await this.pool.query("DELETE FROM template_artifacts WHERE id = ?", [createdId]);
      }
      throw error;
    } finally {
      fs.rmSync(draftDir, { recursive: true, force: true });
    }
  }

  async remove(tableName, keys) {
    this.ensurePool();
    const config = getConfig(tableName);
    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_triggers"
    ) {
      const existing = await this.getByKeys(tableName, keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      await this.ensureDraftDefinitionContext(
        existing.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de definicion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los disparadores de definicion"
        }
      );
    }

    if (tableName === "signature_flow_templates") {
      const existing = await this.getByKeys(tableName, keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      const template = await this.getTaskTemplate(existing.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definido asociada al flujo ya no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }

    await this.pool.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
    return keyPayload;
  }
}
