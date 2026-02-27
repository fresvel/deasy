import { getMariaDBPool } from "../../config/mariadb.js";
import {
  generateTasksForTerm,
  updateParentTaskStatusForTask
} from "./TaskGenerationService.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import bcrypt from "bcrypt";

const DEFAULT_LIMIT = 50;
const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$/;

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

const normalizeNumericIdList = (values) => {
  const source = Array.isArray(values) ? values : [];
  const numeric = source
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  return Array.from(new Set(numeric));
};

const getProcessUnitIdsFromPayload = (data = {}) => {
  const ids = [];

  if (Array.isArray(data.unit_ids)) {
    ids.push(...data.unit_ids);
  } else if (typeof data.unit_ids === "string") {
    ids.push(
      ...data.unit_ids
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
    );
  }

  if (Object.prototype.hasOwnProperty.call(data, "unit_id")) {
    ids.push(data.unit_id);
  }

  return normalizeNumericIdList(ids);
};

const hasProcessUnitPayload = (data = {}) =>
  Object.prototype.hasOwnProperty.call(data, "unit_id")
  || Object.prototype.hasOwnProperty.call(data, "unit_ids");

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
    case "process_units":
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "unidades por proceso");
      break;
    case "process_versions":
      if (!candidate.process_id) {
        throw new Error("Selecciona un proceso base para la version.");
      }
      if (!candidate.cargo_id) {
        throw new Error("Selecciona un cargo responsable para la version del proceso.");
      }
      if (!candidate.version || !/^\d+\.\d+$/.test(String(candidate.version))) {
        throw new Error("La version del proceso debe tener formato decimal (ej: 1.0).");
      }
      if (!candidate.effective_from) {
        throw new Error("Selecciona la fecha de vigencia inicial.");
      }
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "versiones de proceso");
      break;
    case "tasks":
      if (!candidate.process_version_id) {
        throw new Error("Selecciona la version del proceso para la tarea.");
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

  async syncProcessUnits(connection, processId, unitIds, { replace = false } = {}) {
    const normalizedIds = normalizeNumericIdList(unitIds);
    if (!normalizedIds.length) {
      throw new Error("Selecciona al menos una unidad para el proceso.");
    }

    if (replace) {
      await connection.query("DELETE FROM process_units WHERE process_id = ?", [processId]);
    }

    for (const unitId of normalizedIds) {
      await connection.query(
        `INSERT INTO process_units
          (process_id, unit_id, scope, is_primary, is_active, effective_from, effective_to)
         VALUES (?, ?, 'owner', 0, 1, CURDATE(), NULL)
         ON DUPLICATE KEY UPDATE
           is_active = 1,
           effective_to = NULL`,
        [processId, unitId]
      );
    }

    await connection.query("UPDATE process_units SET is_primary = 0 WHERE process_id = ?", [processId]);
    await connection.query(
      `UPDATE process_units
       SET is_primary = 1, is_active = 1, effective_to = NULL
       WHERE process_id = ? AND unit_id = ?`,
      [processId, normalizedIds[0]]
    );
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
        SELECT process_id, unit_id
        FROM (
          SELECT
            process_id,
            unit_id,
            ROW_NUMBER() OVER (
              PARTITION BY process_id
              ORDER BY is_primary DESC, id ASC
            ) AS rn
          FROM process_units
          WHERE is_active = 1
            AND (effective_from IS NULL OR effective_from <= CURDATE())
            AND (effective_to IS NULL OR effective_to >= CURDATE())
        ) ranked_pu
        WHERE rn = 1
      ) pu_main ON pu_main.process_id = processes.id
      LEFT JOIN (
        SELECT process_id, version, name, slug, parent_version_id, cargo_id, effective_from, effective_to
        FROM (
          SELECT
            process_id,
            version,
            name,
            slug,
            parent_version_id,
            cargo_id,
            effective_from,
            effective_to,
            ROW_NUMBER() OVER (
              PARTITION BY process_id
              ORDER BY created_at DESC, id DESC
            ) AS rn
          FROM process_versions
        ) ranked_pv
        WHERE rn = 1
      ) pv_main ON pv_main.process_id = processes.id`;
      columnPrefix = "processes.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      if (availableFields.includes("unit_id")) {
        selectFields.push("pu_main.unit_id AS unit_id");
        orderableFields.push("unit_id");
      }
      if (availableFields.includes("cargo_id")) {
        selectFields.push("pv_main.cargo_id AS cargo_id");
      }
      if (availableFields.includes("version")) {
        selectFields.push("pv_main.version AS version");
      }
      if (availableFields.includes("version_name")) {
        selectFields.push("pv_main.name AS version_name");
      }
      if (availableFields.includes("version_slug")) {
        selectFields.push("pv_main.slug AS version_slug");
      }
      if (availableFields.includes("version_effective_from")) {
        selectFields.push("pv_main.effective_from AS version_effective_from");
      }
      if (availableFields.includes("version_effective_to")) {
        selectFields.push("pv_main.effective_to AS version_effective_to");
      }
      if (availableFields.includes("version_parent_version_id")) {
        selectFields.push("pv_main.parent_version_id AS version_parent_version_id");
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;

      if (normalizedFilters.unit_id) {
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM process_units pu_filter
            WHERE pu_filter.process_id = processes.id
              AND pu_filter.unit_id = ?
              AND pu_filter.is_active = 1
              AND (pu_filter.effective_from IS NULL OR pu_filter.effective_from <= CURDATE())
              AND (pu_filter.effective_to IS NULL OR pu_filter.effective_to >= CURDATE())
          )`
        );
        params.push(normalizedFilters.unit_id);
        delete normalizedFilters.unit_id;
      }
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
      || (tableName === "processes" && safeOrderBy === "unit_id")
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
    if (tableName === "process_versions") {
      throw new Error("Las versiones de proceso se gestionan desde la tabla de procesos.");
    }
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);

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
    const processUnitIds = tableName === "processes" ? getProcessUnitIdsFromPayload(data) : [];
    if (tableName === "processes" && !data?.cargo_id) {
      throw new Error("Selecciona un cargo responsable para la version inicial del proceso.");
    }
    if (tableName === "processes" && !processUnitIds.length) {
      throw new Error("Selecciona al menos una unidad para el proceso.");
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

    if (tableName === "vacancies") {
      await this.ensureContractablePosition(payload.position_id ?? data?.position_id);
    }

    const columns = Object.keys(payload);
    if (!columns.length) {
      throw new Error("No hay datos para insertar.");
    }

    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");

    if (tableName !== "processes") {
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

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
        values
      );
      const insertedId = result.insertId;
      if (tableName === "processes") {
        await this.syncProcessUnits(connection, insertedId, processUnitIds, { replace: true });

        const version = data?.version ?? "0.1";
        const versionName = data?.version_name ?? "Inicial";
        const versionSlug = data?.version_slug ?? payload.slug ?? `process-${insertedId}-v${version}`;
        const effectiveFrom = data?.version_effective_from ?? data?.effective_from ?? null;
        const effectiveTo = data?.version_effective_to ?? data?.effective_to ?? null;
        const parentVersionId = data?.version_parent_version_id ?? data?.parent_version_id ?? null;

        if (!effectiveFrom) {
          throw new Error("Selecciona la fecha de vigencia inicial para la version del proceso.");
        }
        if (!/^\d+\.\d+$/.test(String(version))) {
          throw new Error("La version del proceso debe tener formato decimal (ej: 0.1).");
        }
        ensureDateOrder(effectiveFrom, effectiveTo, "versiones de proceso");

        const versionPayload = {
          process_id: insertedId,
          version,
          name: versionName,
          slug: versionSlug,
          parent_version_id: parentVersionId || null,
          cargo_id: data?.cargo_id,
          has_document: payload.has_document ?? 1,
          is_active: payload.is_active ?? 1,
          effective_from: effectiveFrom,
          effective_to: effectiveTo
        };
        const versionColumns = Object.keys(versionPayload);
        const versionValues = versionColumns.map((key) => versionPayload[key]);
        const versionPlaceholders = versionColumns.map(() => "?").join(", ");
        await connection.query(
          `INSERT INTO process_versions (${versionColumns.join(", ")}) VALUES (${versionPlaceholders})`,
          versionValues
        );
      }
      await connection.commit();
      return { id: insertedId, ...payload, unit_id: processUnitIds[0] ?? null };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(tableName, keys, data) {
    this.ensurePool();
    const config = getConfig(tableName);

    if (tableName === "process_versions") {
      if (Object.prototype.hasOwnProperty.call(data, "version")) {
        throw new Error("No se puede modificar el numero de version.");
      }
      if (Object.prototype.hasOwnProperty.call(data, "process_id")) {
        throw new Error("No se puede cambiar el proceso de una version.");
      }
    }

    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);
    const updates = pickPayload(config.fields, data);
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
    if (tableName === "process_versions") {
      const allowed = new Set([
        "name",
        "slug",
        "parent_version_id",
        "has_document",
        "is_active",
        "effective_from",
        "effective_to"
      ]);
      const disallowed = Object.keys(updates).filter((key) => !allowed.has(key));
      if (disallowed.length) {
        throw new Error("Solo se permiten cambios en campos descriptivos de la version.");
      }
    }

    const allowPrimaryKeyUpdate = config.allowPrimaryKeyUpdate === true;
    const columns = Object.keys(updates).filter((column) =>
      allowPrimaryKeyUpdate ? true : !config.primaryKeys.includes(column)
    );
    if (!columns.length && tableName !== "processes") {
      throw new Error("No hay cambios para actualizar.");
    }

    const setClause = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => updates[column]);
    const shouldSyncProcessUnits = tableName === "processes" && hasProcessUnitPayload(data);
    const incomingProcessUnitIds = shouldSyncProcessUnits ? getProcessUnitIdsFromPayload(data) : [];
    const replaceProcessUnits = tableName === "processes" && Object.prototype.hasOwnProperty.call(data, "unit_ids");
    if (shouldSyncProcessUnits && !incomingProcessUnitIds.length) {
      throw new Error("Selecciona al menos una unidad para el proceso.");
    }

    const existing = await this.getByKeys(tableName, keyPayload);
    if (!existing) {
      throw new Error("Registro no encontrado.");
    }

    const candidate = { ...existing, ...updates };
    validateFieldTypes(config, candidate);
    validateTableRules(tableName, candidate);

    if (tableName !== "processes") {
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

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      if (columns.length) {
        await connection.query(
          `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
          [...values, ...params]
        );
      }
      if (tableName === "processes") {
        if (shouldSyncProcessUnits) {
          await this.syncProcessUnits(connection, keyPayload.id, incomingProcessUnitIds, {
            replace: replaceProcessUnits
          });
        }

        const processRow = { ...existing, ...updates };
        const hasVersionPayload = [
          data?.version,
          data?.version_number,
          data?.version_name,
          data?.version_slug,
          data?.version_effective_from,
          data?.version_effective_to,
          data?.version_parent_version_id,
          data?.parent_version_id
        ].some((value) =>
          value !== undefined
          && value !== null
          && String(value).trim() !== ""
        );

        if (hasVersionPayload) {
          const version = data?.version ?? data?.version_number ?? null;
          const effectiveFrom = data?.version_effective_from ?? null;
          const effectiveTo = data?.version_effective_to ?? null;
          const versionName = data?.version_name ?? processRow.name;
          const versionSlug = data?.version_slug ?? processRow.slug ?? `process-${processRow.id}-v${version}`;
          const parentVersionId = data?.version_parent_version_id ?? data?.parent_version_id ?? null;
          const cargoId = data?.cargo_id ?? null;

          if (!version) {
            throw new Error("Debes indicar la nueva version del proceso.");
          }
          if (!/^\d+\.\d+$/.test(String(version))) {
            throw new Error("La version del proceso debe tener formato decimal (ej: 1.0).");
          }
          if (!effectiveFrom) {
            throw new Error("Selecciona la fecha de vigencia inicial para la version del proceso.");
          }
          if (!cargoId) {
            throw new Error("Selecciona el cargo responsable para la nueva version del proceso.");
          }
          ensureDateOrder(effectiveFrom, effectiveTo, "versiones de proceso");

          let resolvedParentVersionId = parentVersionId;
          if (!resolvedParentVersionId) {
            const [rows] = await connection.query(
              "SELECT id FROM process_versions WHERE process_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
              [processRow.id]
            );
            resolvedParentVersionId = rows?.[0]?.id ?? null;
          }

          const versionPayload = {
            process_id: processRow.id,
            version: String(version),
            name: versionName,
            slug: versionSlug,
            parent_version_id: resolvedParentVersionId,
            cargo_id: cargoId,
            has_document: processRow.has_document ?? 1,
            is_active: processRow.is_active ?? 1,
            effective_from: effectiveFrom,
            effective_to: effectiveTo
          };
          const versionColumns = Object.keys(versionPayload);
          const versionValues = versionColumns.map((key) => versionPayload[key]);
          const versionPlaceholders = versionColumns.map(() => "?").join(", ");
          await connection.query(
            `INSERT INTO process_versions (${versionColumns.join(", ")}) VALUES (${versionPlaceholders})`,
            versionValues
          );
        }
      }
      await connection.commit();
      return {
        ...keyPayload,
        ...updates,
        ...(shouldSyncProcessUnits ? { unit_id: incomingProcessUnitIds[0] ?? null } : {})
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async remove(tableName, keys) {
    this.ensurePool();
    if (tableName === "process_versions") {
      throw new Error("Las versiones de proceso se gestionan desde la tabla de procesos.");
    }
    const config = getConfig(tableName);
    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);

    await this.pool.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
    return keyPayload;
  }
}
