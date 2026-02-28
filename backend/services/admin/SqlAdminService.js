import { getMariaDBPool } from "../../config/mariadb.js";
import {
  generateTasksForTerm,
  updateParentTaskStatusForTask
} from "./TaskGenerationService.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import bcrypt from "bcrypt";

const DEFAULT_LIMIT = 50;
const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$/;
const SEMANTIC_VERSION_REGEX = /^\d+\.\d+\.\d+$/;

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
      if (!candidate.variation_key || !String(candidate.variation_key).trim()) {
        throw new Error("Ingresa la serie o variante de la definicion.");
      }
      if (!candidate.definition_version || !SEMANTIC_VERSION_REGEX.test(String(candidate.definition_version).trim())) {
        throw new Error("La version de la definicion debe tener formato semantico de tres segmentos (ej: 1.0.0).");
      }
      if (!candidate.effective_from) {
        throw new Error("Selecciona la fecha de vigencia inicial de la definicion.");
      }
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "definiciones de proceso");
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
    case "tasks":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona la definicion del proceso para la tarea.");
      }
      if (!candidate.term_id) {
        throw new Error("Selecciona un periodo para la tarea.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "tareas");
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
      break;
    case "template_artifacts":
      if (!candidate.bucket || !candidate.base_object_prefix || !candidate.entry_object_key) {
        throw new Error("Debes registrar bucket, prefijo base y ruta de entrada del artifact.");
      }
      break;
    case "templates":
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

    if (tableName === "templates") {
      const baseFields = physicalFields.filter((field) => field !== "process_name");
      joinClause = "LEFT JOIN processes p ON p.id = templates.process_id";
      columnPrefix = "templates.";
      const selectFields = baseFields.map((field) => `${columnPrefix}${field}`);
      if (availableFields.includes("process_name")) {
        selectFields.push("p.name AS process_name");
        orderableFields.push("process_name");
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;
      if (normalizedFilters.process_id) {
        conditions.push("templates.process_id = ?");
        params.push(normalizedFilters.process_id);
        delete normalizedFilters.process_id;
      }
    }

    if (tableName === "processes") {
      joinClause = `LEFT JOIN (
        SELECT process_id, definition_version, execution_mode, status
        FROM (
          SELECT
            process_id,
            definition_version,
            execution_mode,
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
      if (availableFields.includes("active_execution_mode")) {
        selectFields.push("pd_main.execution_mode AS active_execution_mode");
      }
      if (availableFields.includes("active_definition_status")) {
        selectFields.push("pd_main.status AS active_definition_status");
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
      if (tableName === "templates" && field === "process_name") {
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
      (tableName === "templates" && safeOrderBy === "process_name")
      || (tableName === "processes" && safeOrderBy === "active_definition_version")
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

  async create(tableName, data) {
    this.ensurePool();
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);

    if (tableName === "process_definition_versions") {
      if (typeof payload.variation_key === "string") {
        payload.variation_key = payload.variation_key.trim();
      }
      if (typeof payload.definition_version === "string") {
        payload.definition_version = payload.definition_version.trim();
      }
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

    const required = config.fields.filter((field) => field.required && !field.readOnly && !field.virtual);
    const missing = required.filter((field) => payload[field.name] === undefined || payload[field.name] === "");

    if (missing.length) {
      throw new Error(`Datos incompletos: ${missing.map((field) => field.label || field.name).join(", ")}`);
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

    if (tableName === "process_definition_versions") {
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
    const [result] = await this.pool.query(
      `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );
    const created = { id: result.insertId, ...payload };
    if (tableName === "terms") {
      try {
        await generateTasksForTerm(created.id);
      } catch (error) {
        console.warn("⚠️  No se pudo generar tareas para el periodo:", error.message);
      }
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
    if (tableName === "process_definition_versions") {
      if (typeof updates.variation_key === "string") {
        updates.variation_key = updates.variation_key.trim();
      }
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
          "execution_mode",
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

    await this.pool.query(
      `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
      [...values, ...params]
    );
    if (tableName === "tasks" && Object.prototype.hasOwnProperty.call(updates, "status")) {
      const taskId = existing.id ?? keyPayload.id;
      await updateParentTaskStatusForTask(taskId);
    }
    return sanitizePersonRow(tableName, { ...keyPayload, ...updates });
  }

  async remove(tableName, keys) {
    this.ensurePool();
    const config = getConfig(tableName);
    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);

    await this.pool.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
    return keyPayload;
  }
}
