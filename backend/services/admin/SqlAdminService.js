import { getMariaDBPool } from "../../config/mariadb.js";
import {
  generateTasksForTerm,
  updateParentTaskStatusForTask
} from "./TaskGenerationService.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";

const DEFAULT_LIMIT = 50;

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
  const ensureXor = (left, right, label) => {
    const hasLeft = left !== null && left !== undefined;
    const hasRight = right !== null && right !== undefined;
    if (hasLeft === hasRight) {
      throw new Error(`Debe existir solo uno entre ${label}.`);
    }
  };
  const ensureAtLeastOne = (left, right, label) => {
    const hasLeft = left !== null && left !== undefined;
    const hasRight = right !== null && right !== undefined;
    if (!hasLeft && !hasRight) {
      throw new Error(`Debe existir al menos uno entre ${label}.`);
    }
  };

  switch (tableName) {
    case "unit_relations":
      if (candidate.parent_unit_id && candidate.child_unit_id) {
        if (Number(candidate.parent_unit_id) === Number(candidate.child_unit_id)) {
          throw new Error("La unidad padre y la unidad hija no pueden ser la misma.");
        }
      }
      break;
    case "program_unit_history":
      ensureDateOrder(candidate.start_date, candidate.end_date, "historial programa-unidad");
      if (Number(candidate.is_current) === 1 && candidate.end_date) {
        throw new Error("No se puede marcar como actual si existe fecha de fin.");
      }
      break;
    case "terms":
      ensureDateOrder(candidate.start_date, candidate.end_date, "periodos");
      break;
    case "processes":
      if (!candidate.person_id) {
        throw new Error("Selecciona un responsable para el proceso.");
      }
      ensureAtLeastOne(candidate.unit_id, candidate.program_id, "unidad o programa");
      break;
    case "process_versions":
      if (!candidate.process_id) {
        throw new Error("Selecciona un proceso base para la version.");
      }
      if (!candidate.person_id) {
        throw new Error("Selecciona un responsable para la version del proceso.");
      }
      if (!candidate.version || !/^\d+\.\d+$/.test(String(candidate.version))) {
        throw new Error("La version del proceso debe tener formato decimal (ej: 1.0).");
      }
      if (!candidate.effective_from) {
        throw new Error("Selecciona la fecha de vigencia inicial.");
      }
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "versiones de proceso");
      ensureAtLeastOne(candidate.unit_id, candidate.program_id, "unidad o programa");
      break;
    case "tasks":
      if (!candidate.process_id) {
        throw new Error("Selecciona un proceso para la tarea.");
      }
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
      if (!candidate.person_id) {
        throw new Error("Selecciona una persona para la asignacion.");
      }
      break;
    case "vacancies":
      ensureXor(candidate.unit_id, candidate.program_id, "unidad o programa");
      break;
    case "contracts":
      ensureDateOrder(candidate.start_date, candidate.end_date, "contratos");
      break;
    case "person_cargos":
      ensureDateOrder(candidate.start_date, candidate.end_date, "cargos por persona");
      if (Number(candidate.is_current) === 1 && candidate.end_date) {
        throw new Error("No se puede marcar como actual si existe fecha de fin.");
      }
      break;
    case "role_assignments":
      if (candidate.unit_id && candidate.program_id) {
        throw new Error("La asignacion no puede tener unidad y programa al mismo tiempo.");
      }
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
      if (candidate.version && !/^\d+\.\d+$/.test(String(candidate.version))) {
        throw new Error("La version de plantilla debe tener formato decimal (ej: 0.1).");
      }
      break;
    default:
      break;
  }
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

  async list(tableName, { q, limit, offset, orderBy, order, filters = {} } = {}) {
    this.ensurePool();
    const config = getConfig(tableName);
    const fields = config.fields.map((field) => field.name);

    const params = [];
    const conditions = [];
    let joinClause = "";
    let selectClause = `SELECT ${fields.join(", ")}`;
    let groupByClause = "";
    let columnPrefix = "";
    const normalizedFilters = { ...filters };

    if (tableName === "templates") {
      const baseFields = fields.filter((field) => field !== "process_name");
      joinClause =
        "LEFT JOIN process_templates pt ON pt.template_id = templates.id " +
        "LEFT JOIN processes p ON p.id = pt.process_id";
      columnPrefix = "templates.";
      const selectFields = baseFields.map((field) => `${columnPrefix}${field}`);
      if (fields.includes("process_name")) {
        selectFields.push('GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ", ") AS process_name');
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;
      groupByClause = `GROUP BY ${baseFields.map((field) => `${columnPrefix}${field}`).join(", ")}`;
      if (normalizedFilters.process_id) {
        conditions.push("pt.process_id = ?");
        params.push(normalizedFilters.process_id);
        delete normalizedFilters.process_id;
      }
    }

    if (q && config.searchFields?.length) {
      const like = `%${q}%`;
      const searchClauses = config.searchFields.map((field) => `${columnPrefix}${field} LIKE ?`);
      conditions.push(`(${searchClauses.join(" OR ")})`);
      params.push(...config.searchFields.map(() => like));
    }

    for (const [field, value] of Object.entries(normalizedFilters)) {
      if (!fields.includes(field)) {
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
    const safeOrderBy = fields.includes(orderBy) ? orderBy : config.primaryKeys[0];
    const orderColumn =
      tableName === "templates" && safeOrderBy === "process_name"
        ? "process_name"
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

    return rows;
  }

  async getByKeys(tableName, keys) {
    this.ensurePool();
    const config = getConfig(tableName);
    const { where, params } = buildWhere(config.primaryKeys, keys);
    const fields = config.fields.map((field) => field.name);
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
    const processId = tableName === "templates" ? data?.process_id : null;

    const required = config.fields.filter((field) => field.required && !field.readOnly);
    const missing = required.filter((field) => payload[field.name] === undefined || payload[field.name] === "");

    if (missing.length) {
      throw new Error(`Datos incompletos: ${missing.map((field) => field.label || field.name).join(", ")}`);
    }
    if (tableName === "templates" && (!processId || Number(processId) <= 0)) {
      throw new Error("Selecciona un proceso para la plantilla.");
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

    const columns = Object.keys(payload);
    if (!columns.length) {
      throw new Error("No hay datos para insertar.");
    }

    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");

    if (tableName !== "templates" && tableName !== "processes") {
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
      return created;
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
        values
      );
      const insertedId = result.insertId;
      if (tableName === "templates") {
        await connection.query(
          "INSERT INTO process_templates (process_id, template_id) VALUES (?, ?)",
          [processId, insertedId]
        );
      }
      if (tableName === "processes") {
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
          person_id: payload.person_id,
          unit_id: payload.unit_id ?? null,
          program_id: payload.program_id ?? null,
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
      return { id: insertedId, ...payload };
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
    const processId = tableName === "templates" ? data?.process_id : null;
    if (tableName === "process_versions") {
      const allowed = new Set([
        "name",
        "slug",
        "parent_version_id",
        "person_id",
        "unit_id",
        "program_id",
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
    if (!columns.length && tableName !== "templates" && tableName !== "processes") {
      throw new Error("No hay cambios para actualizar.");
    }

    const setClause = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => updates[column]);

    const existing = await this.getByKeys(tableName, keyPayload);
    if (!existing) {
      throw new Error("Registro no encontrado.");
    }

    const candidate = { ...existing, ...updates };
    validateFieldTypes(config, candidate);
    validateTableRules(tableName, candidate);

    if (tableName !== "templates" && tableName !== "processes") {
      await this.pool.query(
        `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
        [...values, ...params]
      );
      if (tableName === "tasks" && Object.prototype.hasOwnProperty.call(updates, "status")) {
        const taskId = existing.id ?? keyPayload.id;
        await updateParentTaskStatusForTask(taskId);
      }
      return { ...keyPayload, ...updates };
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
      if (tableName === "templates") {
        const templateId = existing.id ?? keyPayload.id;
        if (processId && Number(processId) > 0) {
          await connection.query(
            "DELETE FROM process_templates WHERE template_id = ?",
            [templateId]
          );
          await connection.query(
            "INSERT INTO process_templates (process_id, template_id) VALUES (?, ?)",
            [processId, templateId]
          );
        } else {
          const [rows] = await connection.query(
            "SELECT process_id FROM process_templates WHERE template_id = ? LIMIT 1",
            [templateId]
          );
          if (!rows?.length) {
            throw new Error("Selecciona un proceso para la plantilla.");
          }
        }
      }
      if (tableName === "processes") {
        const processRow = { ...existing, ...updates };
        const version = data?.version ?? data?.version_number ?? null;
        const effectiveFrom = data?.version_effective_from ?? data?.effective_from ?? null;
        const effectiveTo = data?.version_effective_to ?? data?.effective_to ?? null;
        const versionName = data?.version_name ?? processRow.name;
        const versionSlug = data?.version_slug ?? processRow.slug ?? `process-${processRow.id}-v${version}`;
        const parentVersionId = data?.version_parent_version_id ?? data?.parent_version_id ?? null;

        if (!version) {
          throw new Error("Debes indicar la nueva version del proceso.");
        }
        if (!/^\d+\.\d+$/.test(String(version))) {
          throw new Error("La version del proceso debe tener formato decimal (ej: 1.0).");
        }
        if (!effectiveFrom) {
          throw new Error("Selecciona la fecha de vigencia inicial para la version del proceso.");
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
          person_id: processRow.person_id,
          unit_id: processRow.unit_id ?? null,
          program_id: processRow.program_id ?? null,
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
      await connection.commit();
      return { ...keyPayload, ...updates };
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
