// FACHADA de SqlAdminService: el CRUD genérico de tablas admin + los delegadores a los
// colaboradores que los cuts #1-#9 extrajeron (God Object #1, de 5924 L a las actuales).
//
// El directorio está empaquetado por dependencia, no por capricho: `kernel/` no importa a
// nadie y todos importan de él; nada apunta "hacia arriba". Dónde vive cada cosa:
//
//   kernel/      primitives, versioning, constants, storage — puros, sin estado ni pool
//   crud/        tableHooks (los injertos por tabla) y validation (el registro del cut #10)
//   templates/   plantillas, entregables y flujos autorados (incluye templateLifecycle)
//   processes/   series, versionado y grafo de configuraciones de proceso
//   org/         unidades, puestos y resolución de cargos
//   generation/  generación de tareas/entregables en runtime (fachada TaskGenerationService.js)
//
// La superficie pública del directorio son las DOS fachadas de este nivel: este fichero y
// `TaskGenerationService.js`. Todo lo demás es interno.
//
// Ver docs/planes/referencia/calidad-y-medicion.md
import { getPostgresPool } from "../../config/postgres.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import OrgStructureService from "./org/orgStructure.js";
import { validateTableRules } from "./crud/validation.js";
import TemplateArtifactService from "./templates/templateArtifact.js";
import ProcessDefinitionVersionService from "./processes/processDefinitionVersion.js";
import TaskAssignmentService from "./org/taskAssignment.js";
import TemplateLifecycleService from "./templates/templateLifecycle.js";
import ProcessGraphService from "./processes/processGraph.js";
import {
  getTableHooks,
  runInTransaction,
  insertPayload,
} from "./crud/tableHooks.js";
import { translateConstraintError } from "../../errors/sqlErrors.js";

const DEFAULT_LIMIT = 50;

// Opciones de autoría de pasos de llenado SEGÚN el tipo de plantilla (template_scope):
// - 'official' (de proceso): responsable | cargo en {misma unidad, unidad específica, TIPO de unidad}.
//   El tipo de unidad permite disparar la revisión a un cargo en muchas unidades (p. ej. todas las carreras).
//   SIN persona concreta (frágil ante rotación en algo durable que corre en muchas unidades).
// - 'ad_hoc' (de usuario, extensión puntual): responsable | cargo en {misma unidad, unidad específica} |
//   persona concreta. SIN tipo de unidad (no hay distribución masiva en una extensión puntual).
// Autoría web de ENTREGA: 'manual' no está implementado en el resolvedor de llenado (se comporta como 'todas')
// → se excluye para no engañar. El enum/runtime mantiene 'manual' por compatibilidad de seeds.

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
    this.templateLifecycle = new TemplateLifecycleService(this.pool, { getByKeys: (...a) => this.getByKeys(...a), cloneProcessDefinitionChildren: (...a) => this.cloneProcessDefinitionChildren(...a), getNextProcessDefinitionVersion: (...a) => this.getNextProcessDefinitionVersion(...a), retireActiveDefinitionsInSeries: (...a) => this.retireActiveDefinitionsInSeries(...a), createTemplateArtifactVersion: (...a) => this.createTemplateArtifactVersion(...a), getNextStorageVersionForTemplateCode: (...a) => this.getNextStorageVersionForTemplateCode(...a), retirePriorPublishedSiblings: (...a) => this.retirePriorPublishedSiblings(...a), getCargoCodeMap: (...a) => this.getCargoCodeMap(...a), getUnitTypeNameMap: (...a) => this.getUnitTypeNameMap(...a), getProcessTargetScope: (...a) => this.getProcessTargetScope(...a), getResolvableCargoIdsByUnit: (...a) => this.getResolvableCargoIdsByUnit(...a), listResolvableCargos: (...a) => this.listResolvableCargos(...a), getWorkflowReferenceIdSets: (...a) => this.getWorkflowReferenceIdSets(...a), ensureDefinitionHasActiveRulesForActivation: (...a) => this.ensureDefinitionHasActiveRulesForActivation(...a), ensureDefinitionHasActivePeriodTypesForActivation: (...a) => this.ensureDefinitionHasActivePeriodTypesForActivation(...a), ensureDefinitionHasArtifactsForActivation: (...a) => this.ensureDefinitionHasArtifactsForActivation(...a) });
    this.processGraph = new ProcessGraphService(this.pool, { getByKeys: (...a) => this.getByKeys(...a) });
    this.processDefinitionVersion = new ProcessDefinitionVersionService(this.pool, { getByKeys: (tableName, keys) => this.getByKeys(tableName, keys) });
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
      groupByStatus("SELECT document_status AS status, COUNT(*) AS c FROM task_items GROUP BY document_status"),
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
                ta.available_formats, ta.schema_object_key, ta.content_hash,
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
  getTemplateVersions(...args) { return this.templateArtifact.getTemplateVersions(...args); }
  getTemplateArtifactSchema(...args) { return this.templateArtifact.getTemplateArtifactSchema(...args); }
  setTemplateArtifactActive(...args) { return this.templateArtifact.setTemplateArtifactActive(...args); }
  retirePriorPublishedSiblings(...args) { return this.templateArtifact.retirePriorPublishedSiblings(...args); }
  publishTemplateArtifact(...args) { return this.templateArtifact.publishTemplateArtifact(...args); }
  retireTemplateArtifact(...args) { return this.templateArtifact.retireTemplateArtifact(...args); }
  createTemplateArtifactVersion(...args) { return this.templateArtifact.createTemplateArtifactVersion(...args); }
  applyTemplateArtifactSource(...args) { return this.templateArtifact.applyTemplateArtifactSource(...args); }
  getNextStorageVersionForTemplateCode(...args) { return this.templateArtifact.getNextStorageVersionForTemplateCode(...args); }

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

  // ÚNICO punto por el que pasan los DOS caminos de activación (el CRUD genérico via
  // `tableHooks.beforeUpdateTx` y el update guiado via `finishTemplateUpdate`), así que aquí vive la
  // invariante: una configuración ACTIVA no puede llevar dentro un entregable SIN PUBLICAR.
  //
  // Los dos llamadores publican los borradores ANTES de llegar aquí, así que el tercer guard no
  // debería dispararse nunca por los caminos de hoy — y ESO es el punto: es la invariante escrita en
  // el sitio por el que hay que pasar, no un atajo del camino que la cumple. Sin ella, un tercer
  // camino de activación (o uno de los dos que se olvide de publicar primero) reintroduce el 1.12 en
  // silencio, y `launch.js` no comprueba `lifecycle_state` en ningún sitio: lanzaría documentos
  // contra una plantilla que nunca pasó el gate de publicación.
  //
  // EL ORDEN DE LOS TRES GUARDS ES CONTRATO (los mensajes están caracterizados): el de borradores va
  // el ÚLTIMO para no mover los dos que ya existían.
  async ensureDefinitionHasArtifactsForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ta.is_active = 1 THEN 1 ELSE 0 END) AS active_total,
         SUM(CASE WHEN ta.lifecycle_state = 'draft' THEN 1 ELSE 0 END) AS draft_total,
         STRING_AGG(
           CASE WHEN ta.lifecycle_state = 'draft' THEN COALESCE(d.display_name, d.code) END,
           ', ' ORDER BY ta.id
         ) AS draft_names
       FROM process_definition_templates pdt
       INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
       LEFT JOIN deliverables d ON d.id = ta.deliverable_id
       WHERE pdt.process_definition_id = ?`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    const activeTotal = Number(rows?.[0]?.active_total || 0);
    const draftTotal = Number(rows?.[0]?.draft_total || 0);
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
    if (draftTotal > 0) {
      const nombres = String(rows?.[0]?.draft_names || "").trim();
      throw new Error(
        `No se puede activar: la configuracion tiene ${draftTotal} entregable(s) sin publicar${nombres ? ` (${nombres})` : ""}. Publicalos o desvinculalos antes de activar.`
      );
    }
  }

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
      // Un hook puede resolver el create sin llegar al INSERT (vinculo idempotente de
      // process_definition_templates): devuelve la fila que ya existia.
      if (ctx.shortCircuit !== undefined) {
        return sanitizePersonRow(tableName, ctx.shortCircuit);
      }
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
    try {
      if (hooks.beforeInsertTx || hooks.afterInsertTx) {
        result = await runInTransaction(
          this.pool,
          ctx,
          { before: hooks.beforeInsertTx, after: hooks.afterInsertTx },
          (connection) => insertPayload(connection, ctx)
        );
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
      // Red genérica: sin esto, una violación de restricción en cualquiera de las ~44 tablas del
      // admin se le enseña al usuario con el texto interno de PostgreSQL.
      const constraintError = translateConstraintError(error, tableName);
      if (constraintError) {
        throw constraintError;
      }
      throw error;
    }
    const created = { id: result.insertId, ...payload };
    const notice = ctx.notice;
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
      } else {
        await runUpdate(this.pool);
        if (hooks.afterUpdate) {
          await hooks.afterUpdate(ctx);
        }
      }
    } catch (error) {
      const mapped = hooks.mapUpdateError ? hooks.mapUpdateError(error, ctx) : null;
      if (mapped) {
        throw mapped;
      }
      const constraintError = translateConstraintError(error, tableName);
      if (constraintError) {
        throw constraintError;
      }
      throw error;
    }
    const updatedRow = sanitizePersonRow(tableName, { ...keyPayload, ...updates });
    const notice = ctx.notice;
    if (notice) {
      return {
        ...updatedRow,
        __notice: notice
      };
    }
    return updatedRow;
  }
  // --- Delegadores a ProcessGraphService (Extract Class, cut #9) ---------------------------------
  // Jerarquia y grafo de procesos en SqlAdminService.processGraph.js. Gemelo de OrgStructureService.
  createProcessWithParent(...args) { return this.processGraph.createProcessWithParent(...args); }
  getProcessDetail(...args) { return this.processGraph.getProcessDetail(...args); }
  getProcessGraph(...args) { return this.processGraph.getProcessGraph(...args); }
  setProcessParent(...args) { return this.processGraph.setProcessParent(...args); }
  wouldCreateProcessCycle(...args) { return this.processGraph.wouldCreateProcessCycle(...args); }

  // --- Delegadores a TemplateLifecycleService (Extract Class, cut #8) ----------------------------
  // El ciclo de vida de plantillas/entregables vive en SqlAdminService.templateLifecycle.js.
  // Delegadores con la misma firma: ni el controller ni el hook de activacion de
  // process_definition_versions (que llama publishDraftTemplatesForDefinition via ctx.service) se tocan.
  assertDeliverableBelongsToConfigLine(...args) { return this.templateLifecycle.assertDeliverableBelongsToConfigLine(...args); }
  createTemplateArtifactDraft(...args) { return this.templateLifecycle.createTemplateArtifactDraft(...args); }
  finishTemplateUpdate(...args) { return this.templateLifecycle.finishTemplateUpdate(...args); }
  forkDeliverableForConfig(...args) { return this.templateLifecycle.forkDeliverableForConfig(...args); }
  getConfigActivationDiff(...args) { return this.templateLifecycle.getConfigActivationDiff(...args); }
  getOrCreateConfigWorkingDraft(...args) { return this.templateLifecycle.getOrCreateConfigWorkingDraft(...args); }
  getTemplateSeedPreview(...args) { return this.templateLifecycle.getTemplateSeedPreview(...args); }
  publishDraftTemplatesForDefinition(...args) { return this.templateLifecycle.publishDraftTemplatesForDefinition(...args); }
  repointConfigTemplateLink(...args) { return this.templateLifecycle.repointConfigTemplateLink(...args); }
  saveTemplateArtifactDraft(...args) { return this.templateLifecycle.saveTemplateArtifactDraft(...args); }
  startTemplateUpdateForActiveConfig(...args) { return this.templateLifecycle.startTemplateUpdateForActiveConfig(...args); }
  syncTemplateSeedsFromSource(...args) { return this.templateLifecycle.syncTemplateSeedsFromSource(...args); }
  updateTemplateArtifactDraft(...args) { return this.templateLifecycle.updateTemplateArtifactDraft(...args); }
  useTemplateVersionInConfig(...args) { return this.templateLifecycle.useTemplateVersionInConfig(...args); }

  // --- Delegadores a TaskAssignmentService (Extract Class, cut #6) -------------------------------
  // Asignacion/handover/scope viven en SqlAdminService.taskAssignment.js. Delegadores con la misma
  // firma: ni el controller ni saveTemplateArtifactDraft se tocan.
  getCargoCodeMap(...args) { return this.taskAssignment.getCargoCodeMap(...args); }
  getWorkflowReferenceIdSets(...args) { return this.taskAssignment.getWorkflowReferenceIdSets(...args); }
  getUnitTypeNameMap(...args) { return this.taskAssignment.getUnitTypeNameMap(...args); }
  getProcessTargetScope(...args) { return this.taskAssignment.getProcessTargetScope(...args); }
  listResolvableCargos(...args) { return this.taskAssignment.listResolvableCargos(...args); }
  getResolvableCargoIdsByUnit(...args) { return this.taskAssignment.getResolvableCargoIdsByUnit(...args); }
  reconcileOpenTaskItemAssignments(...args) { return this.taskAssignment.reconcileOpenTaskItemAssignments(...args); }
  handoverTaskItem(...args) { return this.taskAssignment.handoverTaskItem(...args); }
  listStuckTaskItems(...args) { return this.taskAssignment.listStuckTaskItems(...args); }
  // Estos DOS delegadores faltaban desde la extraccion del cluster, y sus dos endpoints estaban
  // muertos: `service.<x> is not a function` -> 400. Ninguna prueba los tocaba. Es el mismo agujero
  // que el guard del relevo manual, en el escalon de arriba: al partir una clase God, lo que no
  // tiene contrato HTTP no se entera de que se quedo fuera.
  listTaskItemHandovers(...args) { return this.taskAssignment.listTaskItemHandovers(...args); }
  listSupervisorStuckTaskItems(...args) { return this.taskAssignment.listSupervisorStuckTaskItems(...args); }
  resolveImmediateBoss(...args) { return this.taskAssignment.resolveImmediateBoss(...args); }

  async remove(tableName, keys) {
    this.ensurePool();
    const config = getConfig(tableName);
    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);

    const hooks = getTableHooks(tableName);
    const ctx = {
      service: this,
      pool: this.pool,
      connection: null,
      tableName,
      config,
      keys,
      keyPayload,
      where,
      params,
      state: {},
      notice: ""
    };

    if (hooks.beforeRemove) {
      await hooks.beforeRemove(ctx);
    }

    const runDelete = (executor) => executor.query(`DELETE FROM ${tableName} WHERE ${where}`, params);

    try {
      if (hooks.beforeRemoveTx || hooks.afterRemoveTx) {
        await runInTransaction(
          this.pool,
          ctx,
          { before: hooks.beforeRemoveTx, after: hooks.afterRemoveTx },
          runDelete
        );
      } else {
        await runDelete(this.pool);
      }
    } catch (error) {
      // Al BORRAR, la violación típica es de clave foránea (algo depende de esta fila). Sin esto el
      // usuario ve el texto interno de PostgreSQL con nombres de tabla y de constraint.
      throw translateConstraintError(error, tableName, { deleting: true }) || error;
    }
    return keyPayload;
  }
}
