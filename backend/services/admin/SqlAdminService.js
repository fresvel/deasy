import { getMariaDBPool } from "../../config/mariadb.js";
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
    case "documents":
      ensureXor(candidate.unit_id, candidate.program_id, "unidad o programa");
      break;
    case "processes":
      ensureAtLeastOne(candidate.unit_id, candidate.program_id, "unidad o programa");
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
      if (candidate.version !== undefined && Number(candidate.version) < 1) {
        throw new Error("La version debe ser mayor o igual a 1.");
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
    const normalizedFilters = { ...filters };

    if (tableName === "templates" && normalizedFilters.process_id) {
      joinClause = "INNER JOIN process_templates pt ON pt.template_id = templates.id";
      conditions.push("pt.process_id = ?");
      params.push(normalizedFilters.process_id);
      delete normalizedFilters.process_id;
      selectClause = `SELECT DISTINCT ${fields.map((field) => `templates.${field}`).join(", ")}`;
    }

    if (q && config.searchFields?.length) {
      const like = `%${q}%`;
      const searchClauses = config.searchFields.map((field) => `${field} LIKE ?`);
      conditions.push(`(${searchClauses.join(" OR ")})`);
      params.push(...config.searchFields.map(() => like));
    }

    for (const [field, value] of Object.entries(normalizedFilters)) {
      if (!fields.includes(field)) {
        continue;
      }
      if (value === undefined || value === null || value === "") {
        continue;
      }
      const fieldMeta = config.fields.find((meta) => meta.name === field);
      if (["text", "email", "textarea"].includes(fieldMeta?.type)) {
        conditions.push(`${field} LIKE ?`);
        params.push(`%${value}%`);
      } else {
        conditions.push(`${field} = ?`);
        params.push(value);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeOrderBy = fields.includes(orderBy) ? orderBy : config.primaryKeys[0];
    const orderColumn = joinClause ? `${tableName}.${safeOrderBy}` : safeOrderBy;
    const safeOrder = order?.toLowerCase() === "asc" ? "ASC" : "DESC";
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : DEFAULT_LIMIT;
    const safeOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;

    const [rows] = await this.pool.query(
      `${selectClause} FROM ${tableName} ${joinClause} ${whereClause}
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
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);

    const required = config.fields.filter((field) => field.required && !field.readOnly);
    const missing = required.filter((field) => payload[field.name] === undefined || payload[field.name] === "");

    if (missing.length) {
      throw new Error(`Datos incompletos: ${missing.map((field) => field.label || field.name).join(", ")}`);
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

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

    return { id: result.insertId, ...payload };
  }

  async update(tableName, keys, data) {
    this.ensurePool();
    const config = getConfig(tableName);

    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);
    const updates = pickPayload(config.fields, data);

    const allowPrimaryKeyUpdate = config.allowPrimaryKeyUpdate === true;
    const columns = Object.keys(updates).filter((column) =>
      allowPrimaryKeyUpdate ? true : !config.primaryKeys.includes(column)
    );
    if (!columns.length) {
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

    await this.pool.query(
      `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
      [...values, ...params]
    );

    return { ...keyPayload, ...updates };
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
