import { getPostgresPool } from "../../config/postgres.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import {
  walkFiles,
  hasVisibleFiles,
  hashDirectory,
  buildProtectedManifest,
  unzipToDirectory,
  listMinioObjects,
  getMinioObjectStream,
  streamToBuffer,
  readMinioObjectAsText,
  copyMinioObjectToFile,
  downloadMinioPrefixToDirectory,
  putMinioObjectFromText,
  copyMinioObjectBinary,
  removeMinioPrefix,
  uploadDirectoryToMinio
} from "./SqlAdminService.storage.js";
import OrgStructureService from "./SqlAdminService.orgStructure.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import yaml from "js-yaml";
import { sanitizeStorageSegment } from "../../utils/templateArchive.js";
import {
  buildProcessDefinitionVersionName,
  resolveProcessDefinitionSeriesIdentity
} from "./processDefinitionSeries.js";
import {
  ITEM_EMISSION_MODES,
  bumpSemanticVersion,
  normalizeItemMode,
} from "./SqlAdminService.versioning.js";
import {
  parseJsonObject,
  ensureDateOrder,
  validateTableRules,
} from "./SqlAdminService.validation.js";
import {
  slugify,
  humanizeSlug,
  normalizeNumericId,
  normalizeBooleanFlag,
} from "./SqlAdminService.primitives.js";
import {
  buildWorkflowsYaml,
  normalizeFillSteps,
  normalizeSignatureSteps,
  collectSignatureWorkflowNormalizationIssues,
  collectAuthoredWorkflowIssues,
} from "./SqlAdminService.workflows.js";
import {
  ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX,
  ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX,
  parseYamlDocument,
  sanitizeLatexSource,
  parseAvailableFormats,
  buildArtifactSyncedFillDescription,
  buildArtifactSyncedSignatureDescription,
  parseArtifactSyncMarker,
  isArtifactFillWorkflowSyncEnabled,
  isArtifactSignatureWorkflowSyncEnabled,
  findPreferredPdfObject,
} from "./SqlAdminService.artifacts.js";
import TemplateArtifactService from "./SqlAdminService.templateArtifact.js";
import ProcessDefinitionVersionService from "./SqlAdminService.processDefinitionVersion.js";
import WorkflowSyncService from "./SqlAdminService.workflowSync.js";
import TaskAssignmentService from "./SqlAdminService.taskAssignment.js";
import {
  getTableHooks,
  runInTransaction,
  insertPayload,
} from "./SqlAdminService.tableHooks.js";

const DEFAULT_LIMIT = 50;
const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVICE_DIR, "..", "..", "..");
const BACKEND_STORAGE_ROOT = path.join(REPO_ROOT, "backend", "storage");
const MINIO_TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";
const MINIO_TEMPLATES_PREFIX = (process.env.MINIO_TEMPLATES_PREFIX || "System").replace(/^\/+|\/+$/g, "");
// Semilla por defecto ("general") cuando se crea una plantilla sin elegir seed. Coincide con la del bootstrap.
const DEFAULT_SEED_CODE = process.env.DEFAULT_TEMPLATE_SEED_CODE || "latex/informe-general";
// Formatos de documento de referencia (al menos uno es obligatorio al crear una plantilla).
const REFERENCE_DOC_FORMATS = ["pdf", "docx", "xlsx", "pptx"];
// Rol derivado del formato (sustituye al eje "mode" que ya no se almacena): jinja2 = contrato ejecutable,
// latex = render derivable, el resto = documento de referencia. Es 1:1 con el formato, por eso es derivable.
const FORMAT_ROLE = { jinja2: "contract", latex: "render" };
const formatRole = (format) => FORMAT_ROLE[String(format || "").toLowerCase()] || "reference";
// Formato del contrato ejecutable (único editable por el admin).
const CONTRACT_FORMAT = "jinja2";
// Único subárbol editable por el admin (contenido LaTeX). Todo lo demás del contrato es protegido (hash).
const EDITABLE_CONTENT_SUBPATH = `template/${CONTRACT_FORMAT}/Contenido/`;
const MINIO_TEMPLATES_SEEDS_PREFIX = (process.env.MINIO_TEMPLATES_SEEDS_PREFIX || "Seeds").replace(/^\/+|\/+$/g, "");
const TEMPLATE_USERS_PREFIX = (
  process.env.MINIO_TEMPLATES_USERS_PREFIX
  || process.env.MINIO_TEMPLATES_DRAFT_PREFIX
  || "Users"
).replace(/^\/+|\/+$/g, "");
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

// Componentes UI permitidos para los campos del schema editados desde la web.
const SCHEMA_FIELD_COMPONENTS = new Set([
  "text", "richtext", "textarea", "number", "switch", "date", "date_expression", "select", "hidden"
]);

const slugifyFieldKey = (value, fallback = "campo") => {
  const base = String(value || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || fallback;
};

// Convierte la lista de campos definida en la web en un JSON Schema con extensiones x-deasy-*.
// Cada field: { key, title, type, component, group, required }
const buildSchemaJsonFromFields = (fields = []) => {
  const properties = {};
  const required = [];
  const seen = new Set();
  (Array.isArray(fields) ? fields : []).forEach((rawField, index) => {
    const dataKey = slugifyFieldKey(rawField?.key || rawField?.title, `campo_${index + 1}`);
    if (seen.has(dataKey)) return;
    seen.add(dataKey);
    const component = SCHEMA_FIELD_COMPONENTS.has(String(rawField?.component || "").trim())
      ? String(rawField.component).trim()
      : "text";
    const group = slugifyFieldKey(rawField?.group || "general", "general");
    const jsonType = component === "switch" ? "boolean"
      : component === "number" ? "number"
      : "string";
    const fieldCode = String(rawField?.field_code || `${group}.${dataKey}`).trim();
    properties[dataKey] = {
      type: jsonType,
      title: String(rawField?.title || dataKey).slice(0, 180),
      "x-deasy-field-code": fieldCode,
      "x-deasy-data-key": dataKey,
      "x-deasy-ui": { component, group },
    };
    if (rawField?.required) required.push(dataKey);
  });
  return {
    type: "object",
    properties,
    required,
    additionalProperties: true,
  };
};

// Opciones de autoría de pasos de llenado SEGÚN el tipo de plantilla (template_scope):
// - 'official' (de proceso): responsable | cargo en {misma unidad, unidad específica, TIPO de unidad}.
//   El tipo de unidad permite disparar la revisión a un cargo en muchas unidades (p. ej. todas las carreras).
//   SIN persona concreta (frágil ante rotación en algo durable que corre en muchas unidades).
// - 'ad_hoc' (de usuario, extensión puntual): responsable | cargo en {misma unidad, unidad específica} |
//   persona concreta. SIN tipo de unidad (no hay distribución masiva en una extensión puntual).
// Autoría web de ENTREGA: 'manual' no está implementado en el resolvedor de llenado (se comporta como 'todas')
// → se excluye para no engañar. El enum/runtime mantiene 'manual' por compatibilidad de seeds.

// Layout aplanado por formato (sin eje "modes" ni "mode" ni "src"): template/<format>/...
const buildArtifactFormatDir = (baseDir, format) =>
  path.join(baseDir, "template", format);

const setAvailableFormatEntry = (availableFormats, format, baseObjectPrefix) => {
  availableFormats[format] = {
    entry_object_key: `${baseObjectPrefix}template/${format}/`
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
  for (const format of Object.keys(availableFormats || {})) {
    const dirPath = buildArtifactFormatDir(draftDir, format);
    if (!hasVisibleFiles(dirPath)) {
      throw new Error(`La salida ${format} no cumple la estructura esperada en template/${format}/.`);
    }
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

  // Columnas JSON: vacío → null; string → validar JSON; objeto → serializar.
  if (field?.json) {
    if (value === "") {
      return null;
    }
    if (typeof value === "string") {
      try {
        JSON.parse(value);
      } catch {
        throw new Error(`El campo ${field.label || field.name} debe ser un JSON válido.`);
      }
      return value;
    }
    return JSON.stringify(value);
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
    if (Object.hasOwn(data, field.name)) {
      payload[field.name] = normalizeValue(field, data[field.name]);
    }
  }
  return payload;
};

const buildWhere = (keys, values) => {
  const clauses = [];
  const params = [];
  for (const key of keys) {
    if (!Object.hasOwn(values, key)) {
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

const validateFieldTypes = (config, payload) => {
  for (const field of config.fields) {
    if (!Object.hasOwn(payload, field.name)) {
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

const sanitizePersonRow = (tableName, row) => {
  if (tableName !== "persons" || !row || typeof row !== "object") {
    return row;
  }
  const safeRow = { ...row };
  delete safeRow.password_hash;
  return safeRow;
};

export default class SqlAdminService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
    this.taskAssignment = new TaskAssignmentService(this.pool);
    this.workflowSync = new WorkflowSyncService(this.pool, { getCargoCodeMap: (...a) => this.getCargoCodeMap(...a), getUnitTypeNameMap: (...a) => this.getUnitTypeNameMap(...a), getTemplateArtifact: (...a) => this.getTemplateArtifact(...a), loadTemplateArtifactMetaDocument: (...a) => this.loadTemplateArtifactMetaDocument(...a) });
    this.processDefinitionVersion = new ProcessDefinitionVersionService(this.pool, { getByKeys: (tableName, keys) => this.getByKeys(tableName, keys), syncArtifactWorkflows: (artifactId, connection) => this.syncArtifactWorkflowsForTemplateArtifactId(artifactId, connection) });
    this.templateArtifact = new TemplateArtifactService(this.pool, { getByKeys: (tableName, keys) => this.getByKeys(tableName, keys) });
    this.orgStructure = new OrgStructureService(this.pool, { getByKeys: (tableName, keys) => this.getByKeys(tableName, keys) });
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
  }
  // --- Delegadores a ProcessDefinitionVersionService (Extract Class, cut #4) ----------------------
  // Series/versionado/clonado viven en SqlAdminService.processDefinitionVersion.js. Delegadores con la
  // misma firma: ni el controller ni los grafts de create()/update() se tocan.
  resolveProcessDefinitionSeriesIdentity(...args) { return this.processDefinitionVersion.resolveProcessDefinitionSeriesIdentity(...args); }
  ensureProcessDefinitionVersionAvailable(...args) { return this.processDefinitionVersion.ensureProcessDefinitionVersionAvailable(...args); }
  resolveProcessDefinitionSeries(...args) { return this.processDefinitionVersion.resolveProcessDefinitionSeries(...args); }
  ensureDefaultProcessSingleVariation(...args) { return this.processDefinitionVersion.ensureDefaultProcessSingleVariation(...args); }
  resolveProcessDefinitionVersionName(...args) { return this.processDefinitionVersion.resolveProcessDefinitionVersionName(...args); }
  refreshProcessDefinitionVersionNames(...args) { return this.processDefinitionVersion.refreshProcessDefinitionVersionNames(...args); }
  retireActiveDefinitionsInSeries(...args) { return this.processDefinitionVersion.retireActiveDefinitionsInSeries(...args); }
  getProcessDefinitionVersion(...args) { return this.processDefinitionVersion.getProcessDefinitionVersion(...args); }
  ensureDraftDefinitionContext(...args) { return this.processDefinitionVersion.ensureDraftDefinitionContext(...args); }
  cloneProcessDefinitionChildren(...args) { return this.processDefinitionVersion.cloneProcessDefinitionChildren(...args); }
  getProcessDefinitionSeriesScope(...args) { return this.processDefinitionVersion.getProcessDefinitionSeriesScope(...args); }
  applyTargetRuleSeriesConstraints(...args) { return this.processDefinitionVersion.applyTargetRuleSeriesConstraints(...args); }
  getNextProcessDefinitionVersion(...args) { return this.processDefinitionVersion.getNextProcessDefinitionVersion(...args); }

  // Conteos agregados (solo lectura) para los resúmenes de Operación. Cada dominio se calcula de forma
  // independiente; si una consulta falla devuelve null y el frontend omite esa tarjeta.
  async getOperationStats() {
    this.ensurePool();
    const groupByStatus = async (sql) => {
      try {
        const [rows] = await this.pool.query(sql);
        return Object.fromEntries(rows.map((row) => [String(row.status), Number(row.c) || 0]));
      } catch {
        return null;
      }
    };
    const scalar = async (sql) => {
      try {
        const [[row]] = await this.pool.query(sql);
        return Number(row?.c) || 0;
      } catch {
        return null;
      }
    };
    const [tasks, overdue, documents, deliveries, signatures] = await Promise.all([
      groupByStatus("SELECT status, COUNT(*) AS c FROM tasks GROUP BY status"),
      scalar("SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('completada','cancelada') AND end_date IS NOT NULL AND end_date < CURDATE()"),
      groupByStatus("SELECT status, COUNT(*) AS c FROM documents GROUP BY status"),
      groupByStatus("SELECT status, COUNT(*) AS c FROM fill_requests GROUP BY status"),
      groupByStatus(
        "SELECT srs.code AS status, COUNT(*) AS c FROM signature_flow_instances sfi "
        + "JOIN signature_request_statuses srs ON srs.id = sfi.status_id GROUP BY srs.code"
      )
    ]);
    return {
      tasks: tasks === null ? null : { byStatus: tasks, overdue: overdue ?? 0 },
      documents: documents === null ? null : { byStatus: documents },
      deliveries: deliveries === null ? null : { byStatus: deliveries },
      signatures: signatures === null ? null : { byStatus: signatures }
    };
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
    // template_artifacts: estos campos viven en `deliverables` (alias d). Se rutean ahí en select/búsqueda/filtro/orden.
    const TA_DELIV_COLS = {
      template_code: "d.code",
      display_name: "d.display_name",
      description: "d.description",
      template_scope: "d.template_scope",
      template_seed_id: "d.template_seed_id",
      owner_person_id: "d.owner_person_id"
    };
    const qualifyField = (field) => {
      if (tableName === "template_artifacts" && TA_DELIV_COLS[field]) return TA_DELIV_COLS[field];
      return columnPrefix ? `${columnPrefix}${field}` : field;
    };

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
      columnPrefix = "template_artifacts.";
      joinClause = "LEFT JOIN deliverables d ON d.id = template_artifacts.deliverable_id";
      const selectFields = physicalFields.map((field) =>
        TA_DELIV_COLS[field] ? `${TA_DELIV_COLS[field]} AS ${field}` : `template_artifacts.${field}`
      );
      selectClause = `SELECT ${selectFields.join(", ")}`;
      // Filtro "por proceso al que pertenece": plantillas vinculadas a ese proceso vía process_definition_templates.
      const processFilter = normalizedFilters.process_id;
      delete normalizedFilters.process_id;
      if (processFilter !== undefined && processFilter !== null && processFilter !== "") {
        conditions.push(`EXISTS (
          SELECT 1 FROM process_definition_templates pdt
            INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
           WHERE pdt.template_artifact_id = template_artifacts.id AND pdv.process_id = ?
        )`);
        params.push(processFilter);
      }
    }

    if (q && config.searchFields?.length) {
      const like = `%${q}%`;
      const searchClauses = config.searchFields.map((field) => `${qualifyField(field)} LIKE ?`);
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
      const columnName = qualifyField(field);
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
        : tableName === "template_artifacts"
          ? qualifyField(safeOrderBy)
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
    // template_artifacts: la identidad/atributos del entregable viven en `deliverables` (modelo "libro/ediciones").
    // Se resuelven vía JOIN y se exponen con los MISMOS nombres (template_code/display_name/scope/seed/owner_person)
    // para no romper a los ~muchos llamadores. Funciona antes y después del drop de columnas (lee de `d`).
    if (tableName === "template_artifacts" && keys?.id !== undefined) {
      const [rows] = await this.pool.query(
        `SELECT ta.id, ta.storage_version, ta.lifecycle_state, ta.is_active, ta.base_object_prefix,
                ta.available_formats, ta.schema_object_key, ta.meta_object_key, ta.content_hash,
                ta.parent_version_id, ta.deliverable_id, ta.created_at,
                d.code AS template_code, d.display_name, d.description, d.template_scope,
                d.template_seed_id, d.owner_person_id
           FROM template_artifacts ta
           LEFT JOIN deliverables d ON d.id = ta.deliverable_id
          WHERE ta.id = ? LIMIT 1`,
        [Number(keys.id)]
      );
      return rows?.[0] ?? null;
    }
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
      `SELECT id, process_definition_id, template_artifact_id, sort_order
       FROM process_definition_templates
       WHERE id = ?
       LIMIT 1`,
      [templateId]
    );
    return rows?.[0] ?? null;
  }
  // --- Delegadores a TemplateArtifactService (Extract Class, cut #3) -----------------------------
  // El ciclo de vida de artifacts vive en SqlAdminService.templateArtifact.js. Delegadores con la
  // misma firma: ni el controller ni saveTemplateArtifactDraft (que se queda) se tocan.
  getTemplateArtifact(...args) { return this.templateArtifact.getTemplateArtifact(...args); }
  loadTemplateArtifactMetaDocument(...args) { return this.templateArtifact.loadTemplateArtifactMetaDocument(...args); }
  getTemplateVersions(...args) { return this.templateArtifact.getTemplateVersions(...args); }
  getTemplateArtifactSchema(...args) { return this.templateArtifact.getTemplateArtifactSchema(...args); }
  setTemplateArtifactActive(...args) { return this.templateArtifact.setTemplateArtifactActive(...args); }
  retirePriorPublishedSiblings(...args) { return this.templateArtifact.retirePriorPublishedSiblings(...args); }
  publishTemplateArtifact(...args) { return this.templateArtifact.publishTemplateArtifact(...args); }
  retireTemplateArtifact(...args) { return this.templateArtifact.retireTemplateArtifact(...args); }
  createTemplateArtifactVersion(...args) { return this.templateArtifact.createTemplateArtifactVersion(...args); }
  applyTemplateArtifactSource(...args) { return this.templateArtifact.applyTemplateArtifactSource(...args); }
  getNextStorageVersionForTemplateCode(...args) { return this.templateArtifact.getNextStorageVersionForTemplateCode(...args); }
  // --- Delegadores a WorkflowSyncService (Extract Class, cut #5) ---------------------------------
  // La sincronizacion de workflows vive en SqlAdminService.workflowSync.js. Delegadores con la misma
  // firma: ni el controller, ni los servicios que inyectan syncArtifactWorkflows, ni create()/update() se tocan.
  syncArtifactWorkflowsForTemplateArtifactId(...args) { return this.workflowSync.syncArtifactWorkflowsForTemplateArtifactId(...args); }
  getWorkflowReferenceIdSets(...args) { return this.workflowSync.getWorkflowReferenceIdSets(...args); }
  getArtifactWorkflowSyncStatus(...args) { return this.workflowSync.getArtifactWorkflowSyncStatus(...args); }
  reconcileArtifactWorkflows(...args) { return this.workflowSync.reconcileArtifactWorkflows(...args); }

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
        "No se puede activar una configuracion si no tiene al menos una regla activa en Reglas de alcance."
      );
    }
  }

  async ensureDefinitionHasActivePeriodTypesForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_definition_period_types
       WHERE process_definition_id = ?
         AND is_active = 1`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion si no tiene al menos un tipo de periodo activo en Periodos del proceso."
      );
    }
  }

  async ensureDefinitionHasArtifactsForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ta.is_active = 1 THEN 1 ELSE 0 END) AS active_total
       FROM process_definition_templates pdt
       INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
       WHERE pdt.process_definition_id = ?`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    const activeTotal = Number(rows?.[0]?.active_total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion si no tiene al menos un paquete (plantilla) vinculado."
      );
    }
    if (activeTotal < 1) {
      throw new Error(
        "No se puede activar: la configuracion debe tener al menos una plantilla vinculada y activa."
      );
    }
  }

  // Al activar una configuración, publica sus plantillas en BORRADOR (las creadas nacen draft y se publican de
  // forma controlada al activar la config: "activa la config + publica la plantilla"). Para cada borrador: exige
  // readiness (≥1 paso de entrega), retira la publicada previa del mismo template_code y la marca published.
  // No toca is_active (storage-ready): si la subida a MinIO no terminó, el chequeo de artefactos activos avisará.
  async publishDraftTemplatesForDefinition(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) return 0;
    const [rows] = await connection.query(
      `SELECT ta.*, pdt.item_mode AS item_mode, d.display_name AS deliverable_name
         FROM process_definition_templates pdt
         INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
         LEFT JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE pdt.process_definition_id = ? AND ta.lifecycle_state = 'draft'`,
      [normalizedDefinitionId]
    );
    let published = 0;
    for (const artifact of rows) {
      // routed NO autora flujo (se define al enviar): no se exige paso de entrega para publicarse.
      // single/replicated sí deben traer su flujo predefinido.
      if (String(artifact.item_mode) !== "routed") {
        let fillSteps = 0;
        try {
          const meta = await this.loadTemplateArtifactMetaDocument(artifact);
          fillSteps = (Array.isArray(meta?.workflows?.fill?.steps) ? meta.workflows.fill.steps : []).length;
        } catch {
          fillSteps = 0;
        }
        if (!fillSteps) {
          const templateName = artifact.deliverable_name || artifact.display_name || artifact.template_code || `#${artifact.id}`;
          throw new Error(
            `No se puede activar: la plantilla "${templateName}" debe definir al menos un paso de flujo de entrega antes de publicarse.`
          );
        }
      }
      await this.retirePriorPublishedSiblings(connection, artifact.id);
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = 'published' WHERE id = ?",
        [artifact.id]
      );
      published += 1;
    }
    return published;
  }

  // Valida que la configuracion corra en el tipo de periodo del term indicado: debe existir un
  // vinculo activo en process_definition_period_types. Reemplaza la antigua validacion por
  // trigger_mode (automatic/manual_only/manual_custom_term, ya deprecada).
  async ensureDefinitionRunsInTermPeriodType(definitionId, termId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    const normalizedTermId = Number(termId);

    if (!normalizedDefinitionId || !normalizedTermId) {
      throw new Error("La tarea requiere una configuracion y un periodo validos.");
    }

    const term = await this.getTermWithType(normalizedTermId, connection);
    if (!term) {
      throw new Error("El periodo seleccionado no existe.");
    }

    const [rows] = await connection.query(
      `SELECT id
       FROM process_definition_period_types
       WHERE process_definition_id = ?
         AND term_type_id = ?
         AND is_active = 1
       LIMIT 1`,
      [normalizedDefinitionId, Number(term.term_type_id)]
    );
    if (!rows?.length) {
      throw new Error("La configuracion no corre en el tipo de periodo seleccionado (revisa Periodos del proceso).");
    }
  }
  // --- Delegadores a OrgStructureService (Extract Class, cut #2) ---------------------------------
  // La logica de unidades/puestos/grafo vive ahora en SqlAdminService.orgStructure.js. Estos
  // delegadores conservan la firma para no tocar el controller ni los grafts de create()/update().
  assertUnitHeadAllowed(...args) { return this.orgStructure.assertUnitHeadAllowed(...args); }
  getUnitGraph(...args) { return this.orgStructure.getUnitGraph(...args); }
  wouldCreateUnitCycle(...args) { return this.orgStructure.wouldCreateUnitCycle(...args); }
  getUnitDetail(...args) { return this.orgStructure.getUnitDetail(...args); }
  getUnitProcesses(...args) { return this.orgStructure.getUnitProcesses(...args); }
  getUnitAttachableProcesses(...args) { return this.orgStructure.getUnitAttachableProcesses(...args); }
  addUnitPosition(...args) { return this.orgStructure.addUnitPosition(...args); }
  updateUnitPosition(...args) { return this.orgStructure.updateUnitPosition(...args); }
  removeUnitPosition(...args) { return this.orgStructure.removeUnitPosition(...args); }
  assignUnitPosition(...args) { return this.orgStructure.assignUnitPosition(...args); }
  unassignUnitPosition(...args) { return this.orgStructure.unassignUnitPosition(...args); }
  createUnitWithParent(...args) { return this.orgStructure.createUnitWithParent(...args); }

  // --- Jerarquía de procesos (padre→hijo vía processes.parent_id), análoga al organigrama de unidades ---
  async getProcessGraph() {
    this.ensurePool();
    const [nodes] = await this.pool.query(
      `SELECT p.id, p.name, p.slug, p.is_active, p.parent_id,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = p.id) AS definitions_count,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = p.id AND pdv.status = 'active') AS active_count
         FROM processes p
        ORDER BY p.name ASC`
    );
    const edges = nodes
      .filter((node) => node.parent_id)
      .map((node) => ({
        id: `pe-${node.parent_id}-${node.id}`,
        parent_process_id: node.parent_id,
        child_process_id: node.id
      }));
    // Configuraciones (process_definition_versions) por proceso, para el grafo multinivel expandible.
    const [configs] = await this.pool.query(
      `SELECT pdv.id AS definition_id, pdv.process_id, pdv.name AS definition_name,
              pdv.variation_key, pdv.definition_version, pdv.status,
              pds.source_type AS series_source_type, pds.code AS series_code,
              sc.name AS series_cargo_name, sut.name AS series_unit_type_name
         FROM process_definition_versions pdv
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos sc ON sc.id = pds.cargo_id
         LEFT JOIN unit_types sut ON sut.id = pds.unit_type_id
        ORDER BY pdv.process_id, FIELD(pdv.status, 'active', 'draft', 'retired'), pdv.variation_key ASC`
    );
    // Entregables (plantillas vinculadas) por configuración, para el 3er nivel del grafo. Una misma plantilla
    // puede estar en varias configuraciones: cada fila pdt es un nodo (duplicado por config) y el template_code
    // es el distintivo que identifica que es el mismo entregable.
    const [templates] = await this.pool.query(
      `SELECT pdt.id, pdt.process_definition_id AS definition_id, pdv.process_id,
              pdt.template_artifact_id, d.code AS template_code, d.display_name, d.template_scope,
              ta.storage_version, ta.lifecycle_state,
              (SELECT COUNT(*) FROM template_artifacts tav WHERE tav.deliverable_id = ta.deliverable_id) AS version_count
         FROM process_definition_templates pdt
         INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
         INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
        ORDER BY pdt.process_definition_id, pdt.sort_order ASC`
    );
    return { nodes, edges, configs, templates };
  }

  // Ciclo: poner parentId como padre de childId lo cerraría si parentId ya es descendiente de childId
  // (o son el mismo). CTE recursiva sobre processes.parent_id.
  async wouldCreateProcessCycle(parentId, childId, connection = this.pool) {
    if (Number(parentId) === Number(childId)) {
      return true;
    }
    const [rows] = await connection.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM processes WHERE parent_id = ?
         UNION ALL
         SELECT p.id FROM processes p INNER JOIN descendants d ON p.parent_id = d.id
       )
       SELECT 1 FROM descendants WHERE id = ? LIMIT 1`,
      [childId, parentId]
    );
    return rows.length > 0;
  }

  async createProcessWithParent({ name, slug, parent_id = null } = {}) {
    this.ensurePool();
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      throw new Error("El nombre del proceso es obligatorio.");
    }
    const cleanSlug = slugify(slug || cleanName);
    if (!cleanSlug) {
      throw new Error("No se pudo derivar el slug del proceso.");
    }
    const parentId = parent_id ? Number(parent_id) : null;
    if (parentId) {
      const parent = await this.getByKeys("processes", { id: parentId });
      if (!parent) {
        throw new Error("El proceso padre no existe.");
      }
    }
    try {
      const [r] = await this.pool.query(
        "INSERT INTO processes (name, slug, parent_id, is_active) VALUES (?, ?, ?, 1)",
        [cleanName, cleanSlug, parentId]
      );
      return { id: Number(r.insertId) };
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new Error("Ya existe un proceso con ese identificador (slug).");
      }
      throw error;
    }
  }

  // Reparenta (o desvincula con parentId null) un proceso, con guardia de ciclo.
  async setProcessParent(processId, parentId) {
    this.ensurePool();
    const id = Number(processId);
    const newParent = parentId ? Number(parentId) : null;
    const proc = await this.getByKeys("processes", { id });
    if (!proc) {
      throw new Error("El proceso no existe.");
    }
    if (newParent) {
      if (newParent === id) {
        throw new Error("Un proceso no puede ser su propio padre.");
      }
      const parent = await this.getByKeys("processes", { id: newParent });
      if (!parent) {
        throw new Error("El proceso padre no existe.");
      }
      if (await this.wouldCreateProcessCycle(newParent, id)) {
        throw new Error("La relación crearía un ciclo en la jerarquía de procesos.");
      }
    }
    await this.pool.query("UPDATE processes SET parent_id = ? WHERE id = ?", [newParent, id]);
    return { id, parent_id: newParent };
  }

  // Detalle de un proceso para el cockpit del grafo de procesos: el registro en sí (+ nombre del padre),
  // sus configuraciones (process_definition_versions agrupadas por serie/variación, con estado y conteos de
  // reglas/plantillas/corridas), sus sub-procesos (hijos en el árbol parent_id) y sus corridas (process_runs).
  async getProcessDetail(processId) {
    this.ensurePool();
    const id = Number(processId);
    if (!id) {
      throw new Error("Proceso inválido.");
    }
    const [processRows] = await this.pool.query(
      `SELECT p.id, p.name, p.slug, p.parent_id, p.is_active, par.name AS parent_name
         FROM processes p
         LEFT JOIN processes par ON par.id = p.parent_id
        WHERE p.id = ?
        LIMIT 1`,
      [id]
    );
    const process = processRows?.[0];
    if (!process) {
      throw new Error("El proceso no existe.");
    }

    const [configurations] = await this.pool.query(
      `SELECT pdv.id AS definition_id,
              pdv.name AS definition_name,
              pdv.variation_key,
              pdv.definition_version,
              pdv.status,
              pdv.effective_from,
              pdv.effective_to,
              pds.id AS series_id,
              pds.source_type AS series_source_type,
              pds.code AS series_code,
              sc.name AS series_cargo_name,
              sut.name AS series_unit_type_name,
              (SELECT COUNT(*) FROM process_target_rules ptr WHERE ptr.process_definition_id = pdv.id) AS rules_count,
              (SELECT COUNT(*) FROM process_definition_templates pdt WHERE pdt.process_definition_id = pdv.id) AS templates_count,
              (SELECT COUNT(*) FROM process_runs pr WHERE pr.process_definition_id = pdv.id) AS runs_count
         FROM process_definition_versions pdv
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos sc ON sc.id = pds.cargo_id
         LEFT JOIN unit_types sut ON sut.id = pds.unit_type_id
        WHERE pdv.process_id = ?
        ORDER BY FIELD(pdv.status, 'active', 'draft', 'retired'),
                 pdv.variation_key ASC, pdv.definition_version DESC`,
      [id]
    );

    const [children] = await this.pool.query(
      `SELECT c.id, c.name, c.slug, c.is_active,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = c.id) AS definitions_count,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = c.id AND pdv.status = 'active') AS active_count
         FROM processes c
        WHERE c.parent_id = ?
        ORDER BY c.name ASC`,
      [id]
    );

    const [runs] = await this.pool.query(
      `SELECT pr.id, pr.process_definition_id, pr.run_mode, pr.status, pr.reason, pr.source_run_id, pr.created_at,
              pdv.name AS definition_name, pdv.variation_key, pdv.definition_version,
              t.id AS term_id, t.name AS term_name,
              tt.code AS term_type_code, tt.name AS term_type_name
         FROM process_runs pr
         INNER JOIN process_definition_versions pdv ON pdv.id = pr.process_definition_id
         LEFT JOIN terms t ON t.id = pr.term_id
         LEFT JOIN term_types tt ON tt.id = t.term_type_id
        WHERE pdv.process_id = ?
        ORDER BY pr.created_at DESC`,
      [id]
    );

    return {
      process: {
        id: process.id,
        name: process.name,
        slug: process.slug,
        parent_id: process.parent_id,
        parent_name: process.parent_name,
        is_active: process.is_active
      },
      configurations,
      children,
      runs
    };
  }

  async create(tableName, data) {
    this.ensurePool();
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);
    const hooks = getTableHooks(tableName);
    const ctx = {
      service: this,
      pool: this.pool,
      connection: null,
      tableName,
      config,
      data,
      payload,
      state: {},
      notice: ""
    };

    if (hooks.beforeCreate) {
      await hooks.beforeCreate(ctx);
    }

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
      const identity = await this.resolveProcessDefinitionSeriesIdentity(payload);
      Object.assign(payload, identity);
      const [dupRows] = await this.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
         LIMIT 1`,
        [identity.code]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe una serie con ese origen.");
      }
    }

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_period_types"
    ) {
      await this.ensureDraftDefinitionContext(
        payload.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los periodos del proceso"
        }
      );
    }

    if (tableName === "process_definition_templates") {
      // F3 — "la pared": solo se enlaza un entregable cuyo dueño = (proceso, variación) de la config.
      await this.assertDeliverableBelongsToConfigLine(payload.process_definition_id, payload.template_artifact_id);
      // Vínculo idempotente: si la plantilla ya está en esta configuración (p. ej. porque al crearla desde el
      // wizard ya se enlazó), no se duplica el registro (evita el ER_DUP_ENTRY de uq_process_definition_templates);
      // se devuelve el vínculo existente.
      const [existingLinkRows] = await this.pool.query(
        `SELECT id, sort_order FROM process_definition_templates
         WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
        [payload.process_definition_id, payload.template_artifact_id]
      );
      if (existingLinkRows?.length) {
        return sanitizePersonRow(tableName, {
          id: existingLinkRows[0].id,
          process_definition_id: Number(payload.process_definition_id),
          template_artifact_id: Number(payload.template_artifact_id),
          sort_order: existingLinkRows[0].sort_order,
          __notice: "La plantilla ya estaba vinculada a esta configuración."
        });
      }
      // El orden es interno (secuencia de la plantilla dentro de la configuración) y se asigna solo:
      // el usuario no debe elegirlo.
      if (payload.sort_order === undefined || payload.sort_order === null || payload.sort_order === "") {
        const [countRows] = await this.pool.query(
          "SELECT COUNT(*) AS c FROM process_definition_templates WHERE process_definition_id = ?",
          [payload.process_definition_id]
        );
        payload.sort_order = Number(countRows?.[0]?.c || 0) + 1;
      }
    }

    if (tableName === "process_target_rules") {
      await this.applyTargetRuleSeriesConstraints(payload.process_definition_id, payload);
    }

    if (tableName === "process_definition_period_types") {
      const definition = await this.getProcessDefinitionVersion(payload.process_definition_id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
    }

    if (tableName === "template_artifacts") {
      throw new Error("Los artifacts se registran por sincronizacion desde MinIO o mediante el flujo de plantilla de documento.");
    }

    if (tableName === "process_definition_versions") {
      const requestedStatus = String(payload.status || "draft");
      if (requestedStatus !== "draft") {
        throw new Error("Las nuevas configuraciones solo pueden crearse en estado draft.");
      }
      const series = await this.resolveProcessDefinitionSeries(payload);
      payload.variation_key = String(series.code || "").trim();
      // El proceso por defecto es especial: SOLO admite la configuración "sin variación"
      // (source_type='default'). Puede versionarse (N versiones), pero no tener otra
      // variación por cargo/tipo de unidad.
      await this.ensureDefaultProcessSingleVariation(payload.process_id, series);
      payload.name = await this.resolveProcessDefinitionVersionName(payload.process_id, payload.series_id);
      payload.status = "draft";
      await this.ensureProcessDefinitionVersionAvailable(payload);
    }

    const required = config.fields.filter((field) => field.required && !field.readOnly && !field.virtual);
    const missing = required.filter((field) => payload[field.name] === undefined || payload[field.name] === "");

    if (missing.length) {
      throw new Error(`Datos incompletos: ${missing.map((field) => field.label || field.name).join(", ")}`);
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

    if (hooks.afterValidateCreate) {
      await hooks.afterValidateCreate(ctx);
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
      if (hooks.beforeInsertTx || hooks.afterInsertTx) {
        result = await runInTransaction(
          this.pool,
          ctx,
          { before: hooks.beforeInsertTx, after: hooks.afterInsertTx },
          (connection) => insertPayload(connection, ctx)
        );
      } else if (tableName === "process_definition_versions") {
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
            if (cloneSummary.clonedTemplates || cloneSummary.clonedRules || cloneSummary.clonedPeriodTypes) {
              createNotice =
                `Se clonaron ${cloneSummary.clonedTemplates} plantillas, ${cloneSummary.clonedRules} reglas`
                + ` y ${cloneSummary.clonedPeriodTypes} periodos del proceso desde la configuracion origen.`;
            }
            if (cloneSummary.templateWorkflowWarnings?.length) {
              createNotice = `${createNotice || ""} Atención: ${cloneSummary.templateWorkflowWarnings.length} plantilla(s) con flujo incompleto no se sincronizaron (revisa sus pasos de firma y vuelve a sincronizarlas).`.trim();
            }
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
      } else {
        const [insertResult] = await this.pool.query(
          `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
          values
        );
        result = insertResult;
      }
    } catch (error) {
      const mapped = hooks.mapCreateError ? hooks.mapCreateError(error, ctx) : null;
      if (mapped) {
        throw mapped;
      }
      if (
        tableName === "process_definition_versions"
        && error?.code === "ER_DUP_ENTRY"
        && String(error?.message || "").includes("uq_process_definition_one_active_series")
      ) {
        throw new Error("Solo puede existir una configuracion activa por serie dentro del mismo proceso.");
      }
      throw error;
    }
    const created = { id: result.insertId, ...payload };
    const notice = createNotice || ctx.notice;
    if (notice) {
      return {
        ...sanitizePersonRow(tableName, created),
        __notice: notice
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

    const hooks = getTableHooks(tableName);
    const ctx = {
      service: this,
      pool: this.pool,
      connection: null,
      tableName,
      config,
      data,
      keys,
      keyPayload,
      updates,
      existing,
      where,
      params,
      state: {},
      notice: ""
    };

    if (hooks.beforeUpdate) {
      await hooks.beforeUpdate(ctx);
    }

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_period_types"
    ) {
      if (Object.hasOwn(updates, "process_definition_id")) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la configuracion asociada de este registro.");
        }
        delete updates.process_definition_id;
      }
      await this.ensureDraftDefinitionContext(
        existing.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los periodos del proceso"
        }
      );
    }
    if (tableName === "process_target_rules") {
      const mergedRule = { ...existing, ...updates };
      await this.applyTargetRuleSeriesConstraints(existing.process_definition_id, mergedRule);
      for (const key of ["cargo_id", "unit_type_id"]) {
        if (mergedRule[key] != null && Number(mergedRule[key]) !== Number(existing[key])) {
          updates[key] = mergedRule[key];
        }
      }
    }
    if (tableName === "process_definition_series") {
      const candidateSeries = { ...existing, ...updates };
      const sourceType = String(candidateSeries.source_type || existing.source_type || "").trim();
      if (sourceType === "default") {
        throw new Error("La serie por defecto del sistema no se edita manualmente.");
      }
      const identity = await this.resolveProcessDefinitionSeriesIdentity(candidateSeries);
      Object.assign(updates, identity);
      const [dupRows] = await this.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
           AND id <> ?
         LIMIT 1`,
        [identity.code, Number(existing.id)]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe otra serie con ese origen.");
      }
    }
    if (tableName === "template_artifacts") {
      // Una versión publicada es inmutable; solo se edita en borrador. Para cambiar una publicada, versiónala.
      if (String(existing.lifecycle_state || "published") !== "draft") {
        throw new Error("Esta plantilla está publicada (inmutable). Crea una nueva versión para editarla.");
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

      if (Object.hasOwn(updates, "definition_version")) {
        if (!isSameValue("definition_version", updates.definition_version, existing.definition_version)) {
          throw new Error("No se puede modificar el numero de version de una configuracion.");
        }
        delete updates.definition_version;
      }
      if (Object.hasOwn(updates, "process_id")) {
        if (!isSameValue("process_id", updates.process_id, existing.process_id)) {
          throw new Error("No se puede cambiar el proceso de una configuracion.");
        }
        delete updates.process_id;
      }
      if (Object.hasOwn(updates, "series_id")) {
        if (!isSameValue("series_id", updates.series_id, existing.series_id)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.series_id;
      }
      if (Object.hasOwn(updates, "variation_key")) {
        if (!isSameValue("variation_key", updates.variation_key, existing.variation_key)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.variation_key;
      }
      if (Object.hasOwn(updates, "name")) {
        delete updates.name;
      }

      Object.keys(updates).forEach((key) => {
        if (isSameValue(key, updates[key], existing[key])) {
          delete updates[key];
        }
      });

      const currentStatus = String(existing.status || "draft");
      const nextStatus = Object.hasOwn(updates, "status")
        ? String(updates.status || "")
        : currentStatus;

      const allowedTransitions = {
        draft: new Set(["draft", "active", "retired"]),
        active: new Set(["active", "retired"]),
        retired: new Set(["retired"])
      };
      const currentAllowedTransitions = allowedTransitions[currentStatus] || new Set([currentStatus]);
      if (!currentAllowedTransitions.has(nextStatus)) {
        throw new Error(`No se permite cambiar una configuracion ${currentStatus} a ${nextStatus}.`);
      }

      let allowed;
      let errorMessage;
      if (currentStatus === "draft") {
        const generatedName = await this.resolveProcessDefinitionVersionName(existing.process_id, existing.series_id);
        if (generatedName && !isSameValue("name", generatedName, existing.name)) {
          updates.name = generatedName;
        }
        allowed = new Set([
          "name",
          "description",
          "status",
          "effective_from",
          "effective_to"
        ]);
        errorMessage = "Una configuracion en borrador solo permite cambios funcionales y de estado.";
      } else if (currentStatus === "active") {
        allowed = new Set(["status", "effective_to"]);
        errorMessage = "Una configuracion activa solo permite cambiar estado o vigencia final.";
      } else {
        allowed = new Set();
        errorMessage = "Una configuracion retirada es de solo lectura.";
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

    const runUpdate = (executor) => executor.query(
      `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
      [...values, ...params]
    );
    const needsUpdateTx = hooks.needsUpdateTransaction
      ? hooks.needsUpdateTransaction(ctx)
      : Boolean(hooks.beforeUpdateTx || hooks.afterUpdateTx);

    try {
      if (needsUpdateTx) {
        await runInTransaction(
          this.pool,
          ctx,
          { before: hooks.beforeUpdateTx, after: hooks.afterUpdateTx },
          runUpdate
        );
      } else if (tableName === "process_definition_versions" && activateDraftVersion) {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await this.ensureDefinitionHasActiveRulesForActivation(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasActivePeriodTypesForActivation(existing.id ?? keyPayload.id, connection);
          // Publica las plantillas borrador de la config (activa config + publica plantilla, juntas) antes de
          // validar que haya artefactos activos.
          await this.publishDraftTemplatesForDefinition(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasArtifactsForActivation(existing.id ?? keyPayload.id, connection);
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
            processDefinitionActivationNotice = "La configuracion activa anterior de la misma serie fue retirada automaticamente.";
          }
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
        await runUpdate(this.pool);
        if (hooks.afterUpdate) {
          await hooks.afterUpdate(ctx);
        }
        if (tableName === "process_definition_series" && Object.hasOwn(updates, "code")) {
          await this.pool.query(
            `UPDATE process_definition_versions
             SET variation_key = ?
             WHERE series_id = ?`,
            [updates.code, Number(existing.id)]
          );
          await this.refreshProcessDefinitionVersionNames({ seriesId: Number(existing.id) });
        }
      }
    } catch (error) {
      const mapped = hooks.mapUpdateError ? hooks.mapUpdateError(error, ctx) : null;
      if (mapped) {
        throw mapped;
      }
      if (
        tableName === "process_definition_versions"
        && error?.code === "ER_DUP_ENTRY"
        && String(error?.message || "").includes("uq_process_definition_one_active_series")
      ) {
        throw new Error("Solo puede existir una configuracion activa por serie dentro del mismo proceso.");
      }
      throw error;
    }
    const updatedRow = sanitizePersonRow(tableName, { ...keyPayload, ...updates });
    const notice = processDefinitionActivationNotice || ctx.notice;
    if (notice) {
      return {
        ...updatedRow,
        __notice: notice
      };
    }
    return updatedRow;
  }
  // --- Delegadores a TaskAssignmentService (Extract Class, cut #6) -------------------------------
  // Asignacion/handover/scope viven en SqlAdminService.taskAssignment.js. Delegadores con la misma
  // firma: ni el controller, ni saveTemplateArtifactDraft, ni WorkflowSyncService se tocan.
  getCargoCodeMap(...args) { return this.taskAssignment.getCargoCodeMap(...args); }
  getUnitTypeNameMap(...args) { return this.taskAssignment.getUnitTypeNameMap(...args); }
  getProcessTargetScope(...args) { return this.taskAssignment.getProcessTargetScope(...args); }
  listResolvableCargos(...args) { return this.taskAssignment.listResolvableCargos(...args); }
  getResolvableCargoIdsByUnit(...args) { return this.taskAssignment.getResolvableCargoIdsByUnit(...args); }
  reconcileOpenTaskItemAssignments(...args) { return this.taskAssignment.reconcileOpenTaskItemAssignments(...args); }
  handoverTaskItem(...args) { return this.taskAssignment.handoverTaskItem(...args); }
  listStuckTaskItems(...args) { return this.taskAssignment.listStuckTaskItems(...args); }
  resolveImmediateBoss(...args) { return this.taskAssignment.resolveImmediateBoss(...args); }

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

  // === FASE 2: actualización guiada de la plantilla de una configuración ACTIVA ===
  // Paso 1 (start): clona la plantilla (bump → borrador) y clona la config activa → borrador re-apuntando el
  // enlace a la nueva versión de plantilla. Devuelve ambos borradores para editar y luego publicar+activar.
  async startTemplateUpdateForActiveConfig({ definitionId, templateArtifactId, bumpLevel = "minor" } = {}) {
    this.ensurePool();
    const defId = Number(definitionId);
    const tplId = Number(templateArtifactId);
    if (!defId || !tplId) {
      throw new Error("Faltan datos: se requieren la configuración y la plantilla.");
    }

    const [defRows] = await this.pool.query(
      `SELECT id, process_id, series_id, variation_key, definition_version, name, description, status
         FROM process_definition_versions WHERE id = ? LIMIT 1`,
      [defId]
    );
    const definition = defRows?.[0];
    if (!definition) {
      throw new Error("La configuración no existe.");
    }
    if (String(definition.status) !== "active") {
      throw new Error("La actualización guiada aplica solo a configuraciones activas.");
    }

    const [linkRows] = await this.pool.query(
      "SELECT id FROM process_definition_templates WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1",
      [defId, tplId]
    );
    if (!linkRows.length) {
      throw new Error("La plantilla seleccionada no pertenece a esta configuración.");
    }

    const template = await this.getByKeys("template_artifacts", { id: tplId });
    if (!template) {
      throw new Error("La plantilla no existe.");
    }
    if (String(template.lifecycle_state || "published") !== "published") {
      throw new Error("Solo se puede actualizar desde una versión publicada de la plantilla.");
    }

    // 1) Clonar la plantilla → nueva versión en borrador (MinIO + DB). Fuera de la transacción de la config
    //    porque copia objetos en MinIO (efecto colateral no transaccional).
    const tplVersion = await this.createTemplateArtifactVersion(tplId, bumpLevel);
    const newTemplateId = Number(tplVersion.id);

    // 2) Clonar la config activa → borrador, re-apuntando el enlace de plantilla a la nueva versión.
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const nextConfigVersion = await this.getNextProcessDefinitionVersion(
        definition.process_id,
        definition.variation_key,
        bumpLevel,
        connection
      );
      const [insertResult] = await connection.query(
        `INSERT INTO process_definition_versions
           (process_id, series_id, variation_key, definition_version, name, description, status, effective_from)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', CURDATE())`,
        [
          definition.process_id,
          definition.series_id,
          definition.variation_key,
          nextConfigVersion,
          definition.name,
          definition.description
        ]
      );
      const newConfigId = Number(insertResult.insertId);
      await this.cloneProcessDefinitionChildren({
        sourceDefinitionId: defId,
        targetDefinitionId: newConfigId,
        targetProcessId: definition.process_id,
        templateRemap: { [tplId]: newTemplateId },
        connection
      });
      await connection.commit();
      return {
        template_draft_id: newTemplateId,
        template_storage_version: tplVersion.storage_version,
        config_draft_id: newConfigId,
        config_definition_version: nextConfigVersion,
        source_definition_id: defId,
        source_template_artifact_id: tplId,
        __notice: `Borradores creados: plantilla v${tplVersion.storage_version} y configuración v${nextConfigVersion}. Edita el contenido y publica para activar.`
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      // La plantilla borrador ya creada queda huérfana (inofensiva); se puede retirar/eliminar luego.
      throw error;
    } finally {
      connection.release();
    }
  }

  // Paso 2 (finish): publica la plantilla borrador y activa la config borrador, ATÓMICO. Retira la plantilla
  // publicada previa del mismo código y la config activa previa de la serie.
  async finishTemplateUpdate({ templateArtifactId, configDefinitionId } = {}) {
    this.ensurePool();
    const tplId = Number(templateArtifactId);
    const cfgId = Number(configDefinitionId);
    if (!tplId || !cfgId) {
      throw new Error("Faltan datos: se requieren la plantilla y la configuración borrador.");
    }

    const template = await this.getByKeys("template_artifacts", { id: tplId });
    if (!template) {
      throw new Error("La plantilla borrador no existe.");
    }
    if (String(template.lifecycle_state || "") !== "draft") {
      throw new Error("La plantilla ya no está en borrador.");
    }

    const [defRows] = await this.pool.query(
      "SELECT id, process_id, variation_key, definition_version, status FROM process_definition_versions WHERE id = ? LIMIT 1",
      [cfgId]
    );
    const definition = defRows?.[0];
    if (!definition) {
      throw new Error("La configuración borrador no existe.");
    }
    if (String(definition.status) !== "draft") {
      throw new Error("La configuración ya no está en borrador.");
    }

    const [linkRows] = await this.pool.query(
      "SELECT id, item_mode FROM process_definition_templates WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1",
      [cfgId, tplId]
    );
    if (!linkRows.length) {
      throw new Error("La configuración borrador no está vinculada a esta plantilla.");
    }

    // Readiness de publicación de la plantilla (≥1 paso de entrega) — lectura MinIO antes de la transacción.
    // routed NO autora flujo (se define al enviar): se omite el readiness de entrega.
    if (String(linkRows[0].item_mode) !== "routed") {
      let fillSteps = 0;
      try {
        const meta = await this.loadTemplateArtifactMetaDocument(template);
        fillSteps = (Array.isArray(meta?.workflows?.fill?.steps) ? meta.workflows.fill.steps : []).length;
      } catch {
        fillSteps = 0;
      }
      if (!fillSteps) {
        throw new Error("No se puede publicar: la plantilla debe definir al menos un paso de flujo de entrega.");
      }
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // Readiness de activación que NO depende del estado de la plantilla.
      await this.ensureDefinitionHasActiveRulesForActivation(cfgId, connection);
      await this.ensureDefinitionHasActivePeriodTypesForActivation(cfgId, connection);

      // Publicar plantilla PRIMERO (deja is_active=1) para que pase el check de artefactos activos.
      // Una sola publicada por ENTREGABLE: retira las demás publicadas del mismo deliverable.
      await this.retirePriorPublishedSiblings(connection, tplId);
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = 'published', is_active = 1 WHERE id = ?",
        [tplId]
      );

      // Ahora sí, el check de artefactos activos de la config pasa (la nueva plantilla ya está activa).
      await this.ensureDefinitionHasArtifactsForActivation(cfgId, connection);

      // Activar config: retira la activa previa de la serie + activa esta.
      const retiredCount = await this.retireActiveDefinitionsInSeries({
        processId: definition.process_id,
        variationKey: definition.variation_key,
        excludeId: cfgId,
        connection
      });
      await connection.query(
        "UPDATE process_definition_versions SET status = 'active' WHERE id = ?",
        [cfgId]
      );
      await connection.commit();
      return {
        template_artifact_id: tplId,
        template_lifecycle_state: "published",
        config_definition_id: cfgId,
        config_status: "active",
        retired_previous_config: retiredCount,
        __notice: `Plantilla v${template.storage_version} publicada y configuración v${definition.definition_version} activada.`
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  // Borrador de TRABAJO de una configuración (modelo config-céntrico): una config tiene a lo más UN borrador en
  // curso por (proceso, variación). Si la config dada es borrador, ese es el de trabajo. Si es activa, reutiliza
  // un borrador existente de la serie o, si no hay, clona la activa a un nuevo borrador (bump minor) con sus
  // reglas/periodos/plantillas. Devuelve { id, definition_version, created }.
  async getOrCreateConfigWorkingDraft(definitionId, connection = this.pool) {
    const defId = Number(definitionId);
    const [defRows] = await connection.query(
      `SELECT id, process_id, series_id, variation_key, definition_version, name, description, status
         FROM process_definition_versions WHERE id = ? LIMIT 1`,
      [defId]
    );
    const definition = defRows?.[0];
    if (!definition) throw new Error("La configuración no existe.");
    if (String(definition.status) === "draft") {
      return { id: defId, definition_version: definition.definition_version, created: false };
    }
    if (String(definition.status) !== "active") {
      throw new Error("Solo se puede preparar un borrador desde una configuración activa o borrador.");
    }
    // ¿Existe ya un borrador de la misma serie (proceso, variación)?
    const [existingDraft] = await connection.query(
      `SELECT id, definition_version FROM process_definition_versions
        WHERE process_id = ? AND variation_key = ? AND status = 'draft'
        ORDER BY id DESC LIMIT 1`,
      [definition.process_id, definition.variation_key]
    );
    if (existingDraft?.[0]?.id) {
      return { id: Number(existingDraft[0].id), definition_version: existingDraft[0].definition_version, created: false };
    }
    // Clonar la activa → nuevo borrador (bump minor) con sus hijos.
    const nextVersion = await this.getNextProcessDefinitionVersion(
      definition.process_id, definition.variation_key, "minor", connection
    );
    const [insertResult] = await connection.query(
      `INSERT INTO process_definition_versions
         (process_id, series_id, variation_key, definition_version, name, description, status, effective_from)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', CURDATE())`,
      [definition.process_id, definition.series_id, definition.variation_key, nextVersion, definition.name, definition.description]
    );
    const newId = Number(insertResult.insertId);
    await this.cloneProcessDefinitionChildren({
      sourceDefinitionId: defId,
      targetDefinitionId: newId,
      targetProcessId: definition.process_id,
      connection
    });
    return { id: newId, definition_version: nextVersion, created: true };
  }

  // Re-apunta el enlace de una configuración (su plantilla de cierto template_code) a una versión concreta.
  // F3 — "la pared": un entregable solo puede vincularse a configs de SU MISMA línea (proceso, variación).
  // Si el entregable no tiene dueño (legacy/transición) NO se bloquea (se limpia en F4). El clon de config
  // (cloneProcessDefinitionChildren) NO valida: copia enlaces existentes tal cual hasta el fork de F4.
  async assertDeliverableBelongsToConfigLine(definitionId, templateArtifactId, connection = this.pool) {
    const [defRows] = await connection.query(
      "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
      [Number(definitionId)]
    );
    const def = defRows?.[0];
    if (!def) throw new Error("La configuración no existe.");
    const [ownRows] = await connection.query(
      `SELECT d.owner_process_id, d.owner_variation_key, d.code
         FROM template_artifacts ta
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = ? LIMIT 1`,
      [Number(templateArtifactId)]
    );
    const own = ownRows?.[0];
    if (!own || own.owner_process_id == null) return; // sin dueño todavía → no se bloquea (transición)
    if (Number(own.owner_process_id) !== Number(def.process_id)
      || String(own.owner_variation_key) !== String(def.variation_key)) {
      const e = new Error(
        `El entregable "${own.code}" pertenece a otra línea (proceso/variación) y no se puede vincular a esta configuración. Crea o usa un entregable propio de esta línea ("Crear a partir de este").`
      );
      e.statusCode = 422;
      throw e;
    }
  }

  async repointConfigTemplateLink(definitionId, templateCode, targetArtifactId, connection = this.pool) {
    await this.assertDeliverableBelongsToConfigLine(definitionId, targetArtifactId, connection);
    const [result] = await connection.query(
      `UPDATE process_definition_templates pdt
         INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
          SET pdt.template_artifact_id = ?
        WHERE pdt.process_definition_id = ? AND d.code = ?`,
      [Number(targetArtifactId), Number(definitionId), String(templateCode)]
    );
    if (result?.affectedRows) {
      try {
        await this.syncArtifactWorkflowsForTemplateArtifactId(Number(targetArtifactId), connection);
      } catch {
        // aviso no bloqueante
      }
    }
    return result?.affectedRows || 0;
  }

  // Acción config-céntrica: "usar esta versión del entregable en esta configuración".
  //  - Config BORRADOR: re-apunta su enlace directo a la versión elegida.
  //  - Config ACTIVA: prepara (o reutiliza) el borrador de trabajo y re-apunta ahí; se aplica al activar el borrador.
  async useTemplateVersionInConfig({ definitionId, templateArtifactId } = {}) {
    this.ensurePool();
    const defId = Number(definitionId);
    const targetId = Number(templateArtifactId);
    if (!defId || !targetId) {
      throw new Error("Faltan datos: configuración y versión de plantilla.");
    }
    const target = await this.getByKeys("template_artifacts", { id: targetId });
    if (!target) throw new Error("La versión de plantilla no existe.");

    const [defRows] = await this.pool.query(
      "SELECT id, status FROM process_definition_versions WHERE id = ? LIMIT 1",
      [defId]
    );
    const status = String(defRows?.[0]?.status || "");
    if (!status) throw new Error("La configuración no existe.");
    if (status === "retired") throw new Error("Una configuración retirada es de solo lectura.");

    if (status === "draft") {
      const changed = await this.repointConfigTemplateLink(defId, target.template_code, targetId);
      if (!changed) throw new Error("Esta configuración no tiene un entregable de ese código para re-apuntar.");
      return {
        mode: "draft",
        config_definition_id: defId,
        target_artifact_id: targetId,
        __notice: `La configuración (borrador) ahora usa la versión v${target.storage_version}.`
      };
    }

    // Activa: preparar/usar el borrador de trabajo.
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const draft = await this.getOrCreateConfigWorkingDraft(defId, connection);
      const changed = await this.repointConfigTemplateLink(draft.id, target.template_code, targetId, connection);
      if (!changed) {
        throw new Error("El borrador de la configuración no tiene un entregable de ese código para re-apuntar.");
      }
      await connection.commit();
      return {
        mode: "active",
        config_definition_id: draft.id,
        config_definition_version: draft.definition_version,
        draft_created: draft.created,
        target_artifact_id: targetId,
        __notice: `Se preparó en el borrador v${draft.definition_version} de la configuración: usará v${target.storage_version}. Actívalo para aplicarlo.`
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  // Diff de activación: compara una configuración (borrador) contra la ACTIVA de su misma serie (proceso,
  // variación). Devuelve qué entregables cambian de versión / se agregan / se quitan, y conteos de reglas y
  // periodos. Para mostrar y confirmar antes de activar.
  async getConfigActivationDiff(definitionId) {
    this.ensurePool();
    const defId = Number(definitionId);
    const [defRows] = await this.pool.query(
      "SELECT id, process_id, variation_key, status, definition_version FROM process_definition_versions WHERE id = ? LIMIT 1",
      [defId]
    );
    const draft = defRows?.[0];
    if (!draft) throw new Error("La configuración no existe.");
    const [activeRows] = await this.pool.query(
      `SELECT id, definition_version FROM process_definition_versions
        WHERE process_id = ? AND variation_key = ? AND status = 'active' AND id <> ?
        ORDER BY id DESC LIMIT 1`,
      [draft.process_id, draft.variation_key, defId]
    );
    const active = activeRows?.[0] || null;

    const loadTemplates = async (id) => {
      const [rows] = await this.pool.query(
        `SELECT d.code AS template_code, d.display_name, ta.storage_version, ta.lifecycle_state
           FROM process_definition_templates pdt
           INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
           INNER JOIN deliverables d ON d.id = ta.deliverable_id
          WHERE pdt.process_definition_id = ?`,
        [id]
      );
      const map = new Map();
      for (const r of rows) map.set(r.template_code, r);
      return map;
    };
    const newT = await loadTemplates(defId);
    const oldT = active ? await loadTemplates(active.id) : new Map();
    const codes = new Set([...newT.keys(), ...oldT.keys()]);
    const templates = [];
    for (const code of codes) {
      const n = newT.get(code);
      const o = oldT.get(code);
      if (n && o) {
        templates.push({
          template_code: code, display_name: n.display_name,
          from_version: o.storage_version, to_version: n.storage_version, to_state: n.lifecycle_state,
          change: o.storage_version === n.storage_version ? "unchanged" : "changed"
        });
      } else if (n) {
        templates.push({ template_code: code, display_name: n.display_name, from_version: null, to_version: n.storage_version, to_state: n.lifecycle_state, change: "added" });
      } else {
        templates.push({ template_code: code, display_name: o.display_name, from_version: o.storage_version, to_version: null, change: "removed" });
      }
    }
    templates.sort((a, b) => String(a.template_code).localeCompare(String(b.template_code)));

    const countRows = async (table, id) => {
      const [r] = await this.pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE process_definition_id = ?`, [id]);
      return Number(r?.[0]?.n || 0);
    };
    const rules = { from: active ? await countRows("process_target_rules", active.id) : 0, to: await countRows("process_target_rules", defId) };
    const periodTypes = { from: active ? await countRows("process_definition_period_types", active.id) : 0, to: await countRows("process_definition_period_types", defId) };

    return {
      has_active: Boolean(active),
      from_version: active?.definition_version || null,
      to_version: draft.definition_version,
      config_status: draft.status,
      templates,
      rules,
      period_types: periodTypes
    };
  }

  // FORK: copia el contenido de una versión a un ENTREGABLE NUEVO propio de la línea (proceso, variación) de la
  // config destino, lo publica (v1.0.0) y re-apunta el enlace de esa config. Resuelve el conflicto cross-línea
  // (un linaje deja de tomar prestado el entregable de otro). Reusable también por la UI ("Crear a partir de este"
  // / arreglo del hueco cuando la pared bloquea use-in-config).
  async forkDeliverableForConfig({ sourceArtifactId, definitionId, newCode = null } = {}) {
    this.ensurePool();
    const srcId = Number(sourceArtifactId);
    const defId = Number(definitionId);
    const [srcRows] = await this.pool.query(
      `SELECT ta.*, d.code AS template_code, d.display_name, d.description, d.template_scope,
              d.template_seed_id, d.owner_person_id
         FROM template_artifacts ta LEFT JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = ? LIMIT 1`,
      [srcId]
    );
    const src = srcRows?.[0];
    if (!src) throw new Error("La versión de origen no existe.");
    const [defRows] = await this.pool.query(
      "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
      [defId]
    );
    const def = defRows?.[0];
    if (!def) throw new Error("La configuración destino no existe.");
    const [procRows] = await this.pool.query("SELECT slug FROM processes WHERE id = ? LIMIT 1", [def.process_id]);
    const procSlug = String(procRows?.[0]?.slug || `p${def.process_id}`);

    // Código nuevo único para el fork.
    let code = newCode || `${src.template_code}__${procSlug}`;
    for (let i = 1; ; i += 1) {
      const candidate = i === 1 ? code : `${code}-${i}`;
      const [exists] = await this.pool.query("SELECT id FROM deliverables WHERE code = ? LIMIT 1", [candidate]);
      if (!exists.length) { code = candidate; break; }
    }

    // Crear el deliverable propio de la línea destino.
    const [delivIns] = await this.pool.query(
      `INSERT INTO deliverables
         (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, src.display_name, src.description, def.process_id, def.variation_key, src.template_scope || "official", src.template_seed_id, src.owner_person_id]
    );
    const newDeliverableId = Number(delivIns.insertId);

    // Copiar contenido MinIO a un prefijo propio (System/<code>/1.0.0/).
    const bucket = MINIO_TEMPLATES_BUCKET;
    const oldPrefix = String(src.base_object_prefix || "").replace(/\/?$/, "/");
    const oldCode = String(src.template_code);
    const oldVersion = String(src.storage_version || "");
    const suffix = `${oldCode}/${oldVersion}/`;
    const root = oldPrefix.endsWith(suffix) ? oldPrefix.slice(0, oldPrefix.length - suffix.length) : oldPrefix.replace(/[^/]+\/[^/]+\/$/, "");
    const newPrefix = `${root}${code}/1.0.0/`;
    const objectNames = await listMinioObjects(bucket, oldPrefix, true);
    for (const objectName of objectNames) {
      if (!objectName.startsWith(oldPrefix)) continue;
      const relative = objectName.slice(oldPrefix.length);
      if (!relative) continue;
      await copyMinioObjectBinary(bucket, objectName, `${newPrefix}${relative}`);
    }
    const remappedFormats = parseAvailableFormats(src.available_formats);
    for (const entry of Object.values(remappedFormats || {})) {
      if (entry?.entry_object_key && String(entry.entry_object_key).startsWith(oldPrefix)) {
        entry.entry_object_key = `${newPrefix}${String(entry.entry_object_key).slice(oldPrefix.length)}`;
      }
    }

    // Insertar la versión publicada del fork. Identidad/scope/owner viven en el `deliverable` nuevo (newDeliverableId).
    const [taIns] = await this.pool.query(
      `INSERT INTO template_artifacts
         (storage_version, lifecycle_state, base_object_prefix, available_formats, schema_object_key,
          meta_object_key, content_hash, deliverable_id, is_active)
       VALUES ('1.0.0', 'published', ?, ?, ?, ?, ?, ?, 1)`,
      [
        newPrefix, JSON.stringify(remappedFormats || {}),
        `${newPrefix}schema.json`, `${newPrefix}meta.yaml`, src.content_hash, newDeliverableId
      ]
    );
    const newArtifactId = Number(taIns.insertId);

    // Re-apuntar el enlace de la config destino (del original al fork).
    await this.pool.query(
      "UPDATE process_definition_templates SET template_artifact_id = ? WHERE process_definition_id = ? AND template_artifact_id = ?",
      [newArtifactId, defId, srcId]
    );
    try { await this.syncArtifactWorkflowsForTemplateArtifactId(newArtifactId); } catch { /* aviso no bloqueante */ }

    return { deliverable_id: newDeliverableId, artifact_id: newArtifactId, code, base_object_prefix: newPrefix };
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

  async createTemplateArtifactDraft(data = {}, files = {}, actor = {}) {
    return this.saveTemplateArtifactDraft(null, data, files, actor);
  }

  async updateTemplateArtifactDraft(artifactId, data = {}, files = {}, actor = {}) {
    return this.saveTemplateArtifactDraft(artifactId, data, files, actor);
  }

  async saveTemplateArtifactDraft(artifactId, data = {}, files = {}, actor = {}) {
    this.ensurePool();

    const displayName = String(data.display_name || "").trim();
    const description = String(data.description || "").trim() || null;
    const ownerCedula = String(data.owner_cedula || "").trim();
    const requestedOwnerPersonId = normalizeNumericId(data.owner_person_id);
    let templateSeedId = data.template_seed_id ? Number(data.template_seed_id) : null;
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
      // Solo se edita el contenido mientras la versión está en BORRADOR (independiente del scope). Una versión
      // publicada es inmutable: para cambiarla, crea una nueva versión (que nace en borrador) y edítala.
      if (String(existingArtifact.lifecycle_state || "published") !== "draft") {
        throw new Error("Esta plantilla está publicada (inmutable). Crea una nueva versión para editarla.");
      }
    }

    // Fail-fast (antes de subir nada a MinIO): TODA plantilla debe pertenecer a un proceso. Aplica a todos
    // los roles (admin/gestor de procesos incluidos), no solo al ejecutor.
    if (!isEdit && !(data.process_definition_id ? Number(data.process_definition_id) : null)) {
      throw new Error("Debes seleccionar el proceso (o 'default') al que pertenece esta plantilla.");
    }

    // Modo de emisión del vínculo a proceso (single/replicated/routed). Se fija AL CREAR el link;
    // default 'single'. 'routed' no autora flujo predefinido: se define al enviar (runtime).
    const requestedItemMode = normalizeItemMode(data.item_mode);

    const existingAvailableFormats = parseAvailableFormats(existingArtifact?.available_formats);

    // Toda plantilla nace de una semilla: si al crear no se eligió ninguna, se usa la general (default).
    if (!isEdit && !templateSeedId) {
      const [defaultSeedRows] = await this.pool.query(
        "SELECT id FROM template_seeds WHERE seed_code = ? AND is_active = 1 LIMIT 1",
        [DEFAULT_SEED_CODE]
      );
      if (!defaultSeedRows?.[0]?.id) {
        throw new Error(`No existe la semilla por defecto "${DEFAULT_SEED_CODE}". Ejecuta el bootstrap del sistema.`);
      }
      templateSeedId = Number(defaultSeedRows[0].id);
    }

    // Al crear, siempre se exige al menos un documento de referencia (word/excel/pdf/pptx).
    if (!isEdit) {
      const hasReferenceDoc = REFERENCE_DOC_FORMATS.some((format) => uploadedFiles[format]);
      if (!hasReferenceDoc) {
        throw new Error("Debes adjuntar al menos un documento de referencia (PDF, Word, Excel o PowerPoint).");
      }
      // Toda plantilla single/replicated debe definir un flujo de entrega con al menos un paso
      // (fail-fast antes del upload). 'routed' NO autora flujo: se define al enviar (runtime).
      if (requestedItemMode !== "routed") {
        let fillWorkflowCheck = data.fill_workflow;
        if (typeof fillWorkflowCheck === "string") {
          try { fillWorkflowCheck = JSON.parse(fillWorkflowCheck); } catch { fillWorkflowCheck = null; }
        }
        if (!fillWorkflowCheck || !Array.isArray(fillWorkflowCheck.steps) || !fillWorkflowCheck.steps.length) {
          throw new Error("Debes definir al menos un paso en el flujo de entrega.");
        }
      }
    } else if (
      !templateSeedId
      && !Object.values(uploadedFiles).some(Boolean)
      && !Object.keys(existingAvailableFormats).length
    ) {
      throw new Error("Selecciona un seed o sube al menos un archivo para actualizar el borrador.");
    }

    // La cédula del propietario (ownerRef) ya no se persiste como columna: se usa solo para construir la ruta
    // MinIO ad_hoc al crear (Users/<cédula>/...) y para resolver owner_person_id. En edición se reutiliza el
    // base_object_prefix ya almacenado, así que no es necesaria.
    let ownerRef = ownerCedula.slice(0, 180);
    let ownerPersonId = normalizeNumericId(existingArtifact?.owner_person_id);
    if (!ownerRef && ownerPersonId) {
      const ownerPersonRow = await this.getByKeys("persons", { id: ownerPersonId });
      ownerRef = String(ownerPersonRow?.cedula || "").slice(0, 180);
    }
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
    const bucket = MINIO_TEMPLATES_BUCKET;
    const requestedTemplateScope = String(data.template_scope || existingArtifact?.template_scope || "official").trim();
    const templateScope = requestedTemplateScope === "ad_hoc" ? "ad_hoc" : "official";
    const adHocToken = sanitizeStorageSegment(data.task_item_id || data.draft_token || randomUUID(), "draft");
    // 'official' (de proceso) vive en un repo distinto del de usuarios; 'ad_hoc' (de usuario) bajo Users/.
    const defaultBaseObjectPrefix = templateScope === "ad_hoc"
      ? `${TEMPLATE_USERS_PREFIX}/${ownerRef}/AdHoc/${adHocToken}/${templateCode}/${storageVersion}/`
      : `${MINIO_TEMPLATES_PREFIX}/${templateCode}/${storageVersion}/`;
    const baseObjectPrefix = String(existingArtifact?.base_object_prefix || defaultBaseObjectPrefix);
    const draftDir = path.join(
      BACKEND_STORAGE_ROOT,
      "minio-jobs",
      "templates-drafts",
      ownerRef || templateScope,
      templateCode,
      storageVersion
    );

    fs.rmSync(draftDir, { recursive: true, force: true });
    fs.mkdirSync(draftDir, { recursive: true });
    fs.mkdirSync(path.join(draftDir, "template"), { recursive: true });
    const availableFormats = {};

    const preserveExistingFormat = async (format) => {
      const existingEntry = existingAvailableFormats?.[format];
      if (!existingEntry?.entry_object_key) {
        return false;
      }
      const targetDir = buildArtifactFormatDir(draftDir, format);
      const existingObjectKey = String(existingEntry.entry_object_key);
      if (/\.[a-z0-9]+$/i.test(existingObjectKey)) {
        const fileName = path.basename(existingObjectKey);
        await copyMinioObjectToFile(bucket, existingObjectKey, path.join(targetDir, fileName));
      } else {
        await downloadMinioPrefixToDirectory(bucket, existingObjectKey, targetDir);
      }
      setAvailableFormatEntry(availableFormats, format, baseObjectPrefix);
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
        buildArtifactFormatDir(draftDir, CONTRACT_FORMAT)
      );
      setAvailableFormatEntry(availableFormats, CONTRACT_FORMAT, baseObjectPrefix);
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
      // El render compilado (formato latex) es opcional/derivable: si el seed no lo publica (p.ej. el seed
      // base se empaqueta sin render/), se omite sin abortar. El contrato real es jinja2.
      if (String(seedRow.seed_type || "").toLowerCase() === "latex") {
        try {
          await downloadMinioPrefixToDirectory(
            MINIO_TEMPLATES_BUCKET,
            `${seedRow.source_path}render/`,
            buildArtifactFormatDir(draftDir, "latex")
          );
          setAvailableFormatEntry(availableFormats, "latex", baseObjectPrefix);
        } catch {
          // Sin render/ publicado: se omite el formato latex.
        }
      }
    }

    if (!seedRow) {
      await preserveExistingFormat(CONTRACT_FORMAT);
      await preserveExistingFormat("latex");
    }

    const fileFieldMap = {
      pdf: "pdf",
      docx: "docx",
      xlsx: "xlsx",
      pptx: "pptx"
    };

    for (const [format, file] of Object.entries(uploadedFiles)) {
      const targetDir = buildArtifactFormatDir(draftDir, fileFieldMap[format]);
      const existingEntry = existingAvailableFormats?.[fileFieldMap[format]];

      if (file) {
        const safeName = slugify(path.parse(file.originalname || format).name) || format;
        const extension = path.extname(file.originalname || "") || `.${format}`;
        const fallbackFileName = `${safeName}${extension.toLowerCase()}`;
        const fileName = existingEntry?.entry_object_key
          ? path.basename(existingEntry.entry_object_key)
          : fallbackFileName;
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, fileName), file.buffer);
        setAvailableFormatEntry(availableFormats, fileFieldMap[format], baseObjectPrefix);
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
        setAvailableFormatEntry(availableFormats, fileFieldMap[format], baseObjectPrefix);
      }
    }

    if (!Object.keys(availableFormats).length) {
      throw new Error("No se detectaron formatos disponibles para el borrador.");
    }

    const schemaObjectKey = `${baseObjectPrefix}schema.json`;
    const metaObjectKey = `${baseObjectPrefix}meta.yaml`;
    // Campos definidos desde la web (editor de schema). Si no llegan, se conserva {}.
    let schemaFields = data.schema_fields;
    if (typeof schemaFields === "string") {
      try { schemaFields = JSON.parse(schemaFields); } catch { schemaFields = null; }
    }
    const schemaJson = Array.isArray(schemaFields) && schemaFields.length
      ? buildSchemaJsonFromFields(schemaFields)
      : null;
    fs.writeFileSync(
      path.join(draftDir, "schema.json"),
      schemaJson ? `${JSON.stringify(schemaJson, null, 2)}\n` : "{}\n",
      "utf8"
    );
    const metaLines = [
      `name: "${displayName.replace(/"/g, '\\"')}"`,
      `version: "${storageVersion.replace(/"/g, '\\"')}"`,
      `template_code: "${templateCode.replace(/"/g, '\\"')}"`,
      `template_scope: ${templateScope}`
    ];
    if (description) {
      metaLines.push(`description: "${description.replace(/"/g, '\\"')}"`);
    }
    if (seedRow?.seed_code) {
      metaLines.push(`seed_code: "${String(seedRow.seed_code).replace(/"/g, '\\"')}"`);
    }
    // Flujos definidos desde el editor web (fill/signatures). Si no llegan, se usa el contrato vacío.
    let fillWorkflow = data.fill_workflow;
    let signatureWorkflow = data.signature_workflow;
    if (typeof fillWorkflow === "string") {
      try { fillWorkflow = JSON.parse(fillWorkflow); } catch { fillWorkflow = null; }
    }
    if (typeof signatureWorkflow === "string") {
      try { signatureWorkflow = JSON.parse(signatureWorkflow); } catch { signatureWorkflow = null; }
    }
    const hasCustomWorkflows =
      (fillWorkflow && Array.isArray(fillWorkflow.steps) && fillWorkflow.steps.length)
      || (signatureWorkflow && Array.isArray(signatureWorkflow.steps) && signatureWorkflow.steps.length);
    // Avisos no bloqueantes de autoría (p. ej. cargo sin puesto hoy en la ubicación): se acumulan para
    // informarlos en la respuesta, sin abortar el guardado.
    let authoringWarnings = [];
    // Validación del contrato de flujo en autoría (no solo al vincular): falla rápido y claro antes de
    // subir el meta.yaml, en vez de degradar silenciosamente en la normalización del sync.
    if (hasCustomWorkflows) {
      // Proceso vinculado: en creación llega en el form; en edición se busca el vínculo existente.
      let linkedDefinitionId = normalizeNumericId(data.process_definition_id);
      if (!linkedDefinitionId && isEdit && existingArtifact?.id) {
        const [linkRows] = await this.pool.query(
          "SELECT process_definition_id FROM process_definition_templates WHERE template_artifact_id = ? LIMIT 1",
          [Number(existingArtifact.id)]
        );
        linkedDefinitionId = normalizeNumericId(linkRows?.[0]?.process_definition_id);
      }
      const [cargoCodeMap, referenceIds, processScope] = await Promise.all([
        this.getCargoCodeMap(),
        this.getWorkflowReferenceIdSets(),
        this.getProcessTargetScope(linkedDefinitionId)
      ]);
      // Cargos resolubles por ubicación, para rechazar pasos por cargo que no tendrían titular: ctx (alcance,
      // para "misma unidad") + byUnit (cada unidad fija usada en pasos "unidad específica").
      const fillStepList = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps : [];
      const unitExactUnitIds = [];
      let needsCtxCargos = false;
      // Considera tanto pasos de entrega (un resolutor) como firmantes de cada paso de firma (lista). Así los
      // avisos "cargo sin puesto" se evalúan con el set de cargos resolubles correcto y no salen falsos.
      const cargoScopeSources = [...fillStepList];
      for (const step of (Array.isArray(signatureWorkflow?.steps) ? signatureWorkflow.steps : [])) {
        const signers = Array.isArray(step?.signers) && step.signers.length ? step.signers : [step];
        cargoScopeSources.push(...signers);
      }
      for (const step of cargoScopeSources) {
        const resolverType = String(step?.resolver_type || step?.resolver?.resolver_type || "task_assignee");
        if (resolverType !== "cargo_in_scope") continue;
        const stepScope = String(step?.unit_scope_type || step?.resolver?.unit_scope_type || "context_exact");
        if (stepScope === "unit_exact") {
          const uid = normalizeNumericId(step?.unit_id ?? step?.resolver?.unit_id);
          if (uid) unitExactUnitIds.push(uid);
        } else if (stepScope === "context_exact") {
          needsCtxCargos = true;
        }
      }
      const [ctxCargos, resolvableByUnit] = await Promise.all([
        needsCtxCargos && linkedDefinitionId ? this.listResolvableCargos(linkedDefinitionId) : Promise.resolve(null),
        unitExactUnitIds.length ? this.getResolvableCargoIdsByUnit(this.pool, unitExactUnitIds) : Promise.resolve(new Map())
      ]);
      const resolvableCargoIds = {
        ctx: ctxCargos ? new Set(ctxCargos.map((c) => c.id)) : null,
        byUnit: resolvableByUnit
      };
      const { errors: workflowErrors, warnings: workflowWarnings } = collectAuthoredWorkflowIssues({
        fillWorkflow,
        signatureWorkflow,
        cargoCodeMap,
        referenceIds,
        processScope,
        resolvableCargoIds,
        templateScope
      });
      if (workflowErrors.length) {
        const error = new Error(`El flujo definido tiene errores:\n- ${workflowErrors.join("\n- ")}`);
        error.statusCode = 422;
        throw error;
      }
      authoringWarnings = workflowWarnings;
    }
    const workflowsYaml = hasCustomWorkflows
      ? buildWorkflowsYaml({ fillWorkflow, signatureWorkflow })
      : ARTIFACT_WORKFLOW_CONTRACT;
    fs.writeFileSync(
      path.join(draftDir, "meta.yaml"),
      `${metaLines.join("\n")}\n${workflowsYaml}\n`,
      "utf8"
    );
    validatePackagedArtifactDraft(draftDir, availableFormats);

    const contentHash = hashDirectory(draftDir);
    // Manifiesto de integridad (después del content_hash para no alterarlo; antes del upload para que viaje).
    fs.writeFileSync(
      path.join(draftDir, "manifest.json"),
      `${JSON.stringify(buildProtectedManifest(draftDir, EDITABLE_CONTENT_SUBPATH), null, 2)}\n`,
      "utf8"
    );
    let createdId = isEdit ? Number(existingArtifact.id) : null;
    let uploadedToMinio = false;

    try {
      await uploadDirectoryToMinio(bucket, baseObjectPrefix, draftDir);
      uploadedToMinio = true;

      if (isEdit) {
        // Storage en template_artifacts; identidad/scope/owner/seed/nombre en el `deliverable`.
        await this.pool.query(
          `UPDATE template_artifacts
           SET base_object_prefix = ?,
               available_formats = ?,
               schema_object_key = ?,
               meta_object_key = ?,
               content_hash = ?,
               is_active = 1
           WHERE id = ?`,
          [
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash,
            createdId
          ]
        );
        if (existingArtifact?.deliverable_id) {
          await this.pool.query(
            `UPDATE deliverables
             SET display_name = ?, description = ?, template_scope = ?, template_seed_id = ?, owner_person_id = ?
             WHERE id = ?`,
            [displayName, description, templateScope, templateSeedId, ownerPersonId, existingArtifact.deliverable_id]
          );
        }
      } else {
        // Modelo entregable/ediciones: crear (o reusar) el `deliverable` PRIMERO (dueño = (proceso, variación) de
        // la configuración destino) y luego insertar la versión con su deliverable_id.
        let ownerProcessId = null;
        let ownerVariationKey = null;
        const destDefId = data.process_definition_id ? Number(data.process_definition_id) : null;
        if (destDefId) {
          const [dRows] = await this.pool.query(
            "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
            [destDefId]
          );
          ownerProcessId = dRows?.[0]?.process_id ?? null;
          ownerVariationKey = dRows?.[0]?.variation_key ?? null;
        }
        const [delivExisting] = await this.pool.query("SELECT id FROM deliverables WHERE code = ? LIMIT 1", [templateCode]);
        let newDeliverableId = delivExisting?.[0]?.id;
        if (!newDeliverableId) {
          const [delivIns] = await this.pool.query(
            `INSERT INTO deliverables
               (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [templateCode, displayName, description, ownerProcessId, ownerVariationKey, templateScope, templateSeedId, ownerPersonId]
          );
          newDeliverableId = delivIns.insertId;
        }
        const [result] = await this.pool.query(
          `INSERT INTO template_artifacts (
            storage_version,
            lifecycle_state,
            base_object_prefix,
            available_formats,
            schema_object_key,
            meta_object_key,
            content_hash,
            deliverable_id,
            is_active
          ) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, 1)`,
          [
            storageVersion,
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash,
            newDeliverableId
          ]
        );
        createdId = result.insertId;
      }

      // Vínculo a proceso destino. Obligatorio para ejecutores (GestorEjecucionProcesos):
      // su plantilla debe colgar de un proceso ya definido o de 'default'. Opcional para diseñadores.
      // El requisito de vínculo obligatorio para ejecutores al crear ya se validó arriba (fail-fast);
      // en edición el vínculo previo se conserva. Aquí solo se materializa el vínculo si llega un destino.
      const requestedProcessDefinitionId = data.process_definition_id ? Number(data.process_definition_id) : null;
      if (requestedProcessDefinitionId && createdId) {
        const def = await this.getByKeys("process_definition_versions", { id: requestedProcessDefinitionId });
        if (!def) {
          throw new Error("El proceso destino seleccionado no existe.");
        }
        const [existingLink] = await this.pool.query(
          `SELECT id FROM process_definition_templates
           WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
          [requestedProcessDefinitionId, createdId]
        );
        if (!existingLink?.length) {
          await this.pool.query(
            `INSERT INTO process_definition_templates
              (process_definition_id, template_artifact_id, sort_order, item_mode)
             VALUES (?, ?, 1, ?)`,
            [requestedProcessDefinitionId, createdId, requestedItemMode]
          );
        } else if (requestedItemMode !== "single") {
          // El link ya existía (p. ej. reintento): respeta el modo solicitado si no es el default.
          await this.pool.query(
            `UPDATE process_definition_templates SET item_mode = ?
             WHERE process_definition_id = ? AND template_artifact_id = ?`,
            [requestedItemMode, requestedProcessDefinitionId, createdId]
          );
        }
      }

      // Si se definieron flujos y el artifact ya está vinculado a configuraciones de proceso,
      // sincroniza inmediatamente fill/signature flow templates desde el meta.yaml recién subido.
      let workflowNotice = "";
      let workflowSyncFailed = false;
      if (hasCustomWorkflows && createdId) {
        try {
          const summary = await this.syncArtifactWorkflowsForTemplateArtifactId(createdId);
          const fillTpls = summary?.fill?.syncedTemplates || 0;
          const sigTpls = summary?.signatures?.syncedTemplates || 0;
          if (fillTpls || sigTpls) {
            workflowNotice = ` Flujos sincronizados (entrega: ${fillTpls}, firmas: ${sigTpls}).`;
          }
        } catch (syncError) {
          console.warn("No se pudieron sincronizar los flujos del artifact:", syncError?.message);
          workflowSyncFailed = true;
          workflowNotice = " Los flujos se guardaron en el meta.yaml pero NO se pudieron sincronizar a la base de datos; vuelve a guardar o re-sincroniza.";
        }
      }

      // Avisos no bloqueantes (sync fallido + autoría: cargos sin puesto hoy) se combinan en __warning.
      const combinedWarning = [
        workflowSyncFailed ? workflowNotice.trim() : "",
        ...authoringWarnings
      ].filter(Boolean).join(" ");

      return {
        id: createdId,
        template_seed_id: templateSeedId,
        owner_person_id: ownerPersonId,
        template_code: templateCode,
        display_name: displayName,
        description,
        storage_version: storageVersion,
        template_scope: templateScope,
        base_object_prefix: baseObjectPrefix,
        available_formats: availableFormats,
        schema_object_key: schemaObjectKey,
        meta_object_key: metaObjectKey,
        content_hash: contentHash,
        is_active: 1,
        workflow_sync_failed: workflowSyncFailed,
        __warning: combinedWarning || undefined,
        __notice: (isEdit
          ? "La plantilla de documento fue actualizada y cargada correctamente en MinIO."
          : "La plantilla de documento fue cargada correctamente en MinIO y registrada en el sistema.") + workflowNotice
      };
    } catch (error) {
      // Rollback en creación: borra la fila SQL y limpia los objetos huérfanos subidos a MinIO.
      // En edición no se limpia MinIO (los objetos pertenecen a un artifact existente que se conserva).
      if (!isEdit) {
        if (createdId) {
          await this.pool.query("DELETE FROM template_artifacts WHERE id = ?", [createdId]).catch(() => {});
        }
        if (uploadedToMinio) {
          await removeMinioPrefix(bucket, baseObjectPrefix).catch(() => {});
        }
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

    // La configuración en sí: solo se puede eliminar en draft. Sus tablas hijas ya lo validan más abajo con
    // ensureDraftDefinitionContext, pero la propia definición caía al DELETE genérico del final sin comprobar
    // status, así que una configuración activa (con corridas en curso que la referencian) era borrable por API.
    if (tableName === "process_definition_versions") {
      const definition = await this.getProcessDefinitionVersion(keyPayload.id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
      if (String(definition.status || "") !== "draft") {
        throw new Error("Solo se pueden eliminar configuraciones de proceso cuando estan en draft.");
      }
    }

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_period_types"
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
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los periodos del proceso"
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
        throw new Error("La plantilla de proceso configurado asociada al flujo ya no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }

    // Quitar una plantilla de la configuración: sus flujos derivados (entrega/firma) cuelgan del vínculo y sus
    // FKs NO son ON DELETE CASCADE, así que hay que borrarlos primero. Solo aplica en draft (validado arriba);
    // en draft no existen instancias de runtime (requests/firmas), por eso basta con templates + pasos.
    if (tableName === "process_definition_templates") {
      const templateId = Number(keyPayload.id);
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        // Flujos de ENTREGA del vínculo: pasos → template.
        const [fillTpls] = await connection.query(
          "SELECT id FROM fill_flow_templates WHERE process_definition_template_id = ?",
          [templateId]
        );
        for (const tpl of fillTpls) {
          await connection.query("DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?", [tpl.id]);
        }
        await connection.query("DELETE FROM fill_flow_templates WHERE process_definition_template_id = ?", [templateId]);
        // Flujos de FIRMA del vínculo: pasos → template.
        const [sigTpls] = await connection.query(
          "SELECT id FROM signature_flow_templates WHERE process_definition_template_id = ?",
          [templateId]
        );
        for (const tpl of sigTpls) {
          await connection.query("DELETE FROM signature_flow_steps WHERE template_id = ?", [tpl.id]);
        }
        await connection.query("DELETE FROM signature_flow_templates WHERE process_definition_template_id = ?", [templateId]);
        // Finalmente el vínculo.
        await connection.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return keyPayload;
    }

    await this.pool.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
    return keyPayload;
  }
}
