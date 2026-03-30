import { getMariaDBPool } from "../../config/mariadb.js";

const DEFAULT_STATUS = "Inactivo";

export default class UserRepository {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con MariaDB no está disponible.");
    }
  }

  async findById(id) {
    this.ensurePool();

    const [rows] = await this.pool.query(
      "SELECT * FROM persons WHERE id = ? LIMIT 1",
      [id]
    );

    return rows?.[0] ?? null;
  }

  async findByCedulaOrEmail({ cedula, email }) {
    this.ensurePool();

    const conditions = [];
    const params = [];

    if (cedula) {
      conditions.push("cedula = ?");
      params.push(cedula);
    }

    if (email) {
      conditions.push("email = ?");
      params.push(email);
    }

    if (!conditions.length) {
      return null;
    }

    const [rows] = await this.pool.query(
      `SELECT * FROM persons WHERE ${conditions.join(" OR ")} LIMIT 1`,
      params
    );

    return rows?.[0] ?? null;
  }

  async findAll() {
    this.ensurePool();

    const [rows] = await this.pool.query(
      "SELECT * FROM persons ORDER BY created_at DESC"
    );

    return rows;
  }

  async search(term = "", limit = 20, status = null, filters = {}) {
    this.ensurePool();

    const normalized = term?.trim();
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Number(limit))
      : 20;

    const statusFilter = status?.trim();
    const unitTypeId = filters?.unitTypeId ? Number(filters.unitTypeId) : null;
    const unitId = filters?.unitId ? Number(filters.unitId) : null;
    const cargoId = filters?.cargoId ? Number(filters.cargoId) : null;

    const conditions = [];
    const params = [];

    if (normalized) {
      const like = `%${normalized}%`;

      conditions.push(
        "(cedula LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)"
      );

      params.push(like, like, like, like);
    }

    if (statusFilter) {
      conditions.push("status = ?");
      params.push(statusFilter);
    }

    if (unitTypeId) {
      conditions.push("ut.id = ?");
      params.push(unitTypeId);
    }

    if (unitId) {
      conditions.push("u.id = ?");
      params.push(unitId);
    }

    if (cargoId) {
      conditions.push("c.id = ?");
      params.push(cargoId);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await this.pool.query(
      `SELECT
         p.*,
         GROUP_CONCAT(DISTINCT ut.id ORDER BY ut.name SEPARATOR ',') AS unit_type_ids,
         GROUP_CONCAT(DISTINCT ut.name ORDER BY ut.name SEPARATOR ' | ') AS unit_type_names,
         GROUP_CONCAT(DISTINCT u.id ORDER BY COALESCE(u.label, u.name) SEPARATOR ',') AS unit_ids,
         GROUP_CONCAT(DISTINCT COALESCE(u.label, u.name) ORDER BY COALESCE(u.label, u.name) SEPARATOR ' | ') AS unit_names,
         GROUP_CONCAT(DISTINCT c.id ORDER BY c.name SEPARATOR ',') AS cargo_ids,
         GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ' | ') AS cargo_names
       FROM persons p
       LEFT JOIN position_assignments pa
         ON pa.person_id = p.id
        AND pa.is_current = 1
       LEFT JOIN unit_positions up
         ON up.id = pa.position_id
        AND up.is_active = 1
       LEFT JOIN units u
         ON u.id = up.unit_id
        AND u.is_active = 1
       LEFT JOIN unit_types ut
         ON ut.id = u.unit_type_id
       LEFT JOIN cargos c
         ON c.id = up.cargo_id
        AND c.is_active = 1
        ${whereClause}
       GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ?`,
      [...params, safeLimit]
    );

    return rows;
  }

  async create(userData) {
    this.ensurePool();

    const payload = {
      cedula: userData.cedula,
      email: userData.email ?? null,
      password_hash: userData.password_hash ?? userData.password,
      first_name: userData.first_name ?? userData.nombre,
      last_name: userData.last_name ?? userData.apellido,
      whatsapp: userData.whatsapp ?? null,
      direccion: userData.direccion ?? null,
      pais: userData.pais ?? null,
      pais_residencia: userData.pais_residencia ?? null,
      provincia_residencia: userData.provincia_residencia ?? null,
      ciudad_residencia: userData.ciudad_residencia ?? null,
      calle_primaria: userData.calle_primaria ?? null,
      calle_secundaria: userData.calle_secundaria ?? null,
      codigo_postal: userData.codigo_postal ?? null,
      status: userData.status ?? DEFAULT_STATUS,
      verify_email: Number(userData.verify_email ?? userData.verify?.email ?? 0),
      verify_whatsapp: Number(userData.verify_whatsapp ?? userData.verify?.whatsapp ?? 0),
      photo_url: userData.photo_url ?? userData.photoUrl ?? null,
      is_active: userData.is_active ?? 1,
      token: userData.token
    };

    if (!payload.token) {
      throw new Error("Token no generado");
    }
    const requiredFields = ["cedula", "password_hash", "first_name", "last_name"];

    const missingFields = requiredFields.filter(
      (field) => !payload[field]
    );

    if (missingFields.length) {
      throw new Error(
        `Datos incompletos del usuario: ${missingFields.join(", ")}`
      );
    }

    const columns = Object.keys(payload);
    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");

    const [result] = await this.pool.query(
      `INSERT INTO persons (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return {
      id: result.insertId,
      ...payload
    };
  }

  toPublicUser(userRow) {
    if (!userRow) return null;

    const toNumericArray = (value) => {
      if (!value) return [];
      return String(value)
        .split(",")
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
    };

    const toStringArray = (value) => {
      if (!value) return [];
      return String(value)
        .split(" | ")
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const unitTypeNames = toStringArray(userRow.unit_type_names);
    const unitNames = toStringArray(userRow.unit_names);
    const cargoNames = toStringArray(userRow.cargo_names);

    return {
      id: userRow.id ?? userRow._id,
      _id: (userRow.id ?? userRow._id)?.toString(),
      cedula: userRow.cedula,
      first_name: userRow.first_name,
      last_name: userRow.last_name,
      email: userRow.email,
      whatsapp: userRow.whatsapp,
      direccion: userRow.direccion,
      pais: userRow.pais,
      pais_residencia: userRow.pais_residencia,
      provincia_residencia: userRow.provincia_residencia,
      ciudad_residencia: userRow.ciudad_residencia,
      calle_primaria: userRow.calle_primaria,
      calle_secundaria: userRow.calle_secundaria,
      codigo_postal: userRow.codigo_postal,
      photoUrl: userRow.photo_url ?? userRow.photoUrl ?? null,
      status: userRow.status ?? DEFAULT_STATUS,
      current_assignment: {
        unit_type_ids: toNumericArray(userRow.unit_type_ids),
        unit_type_names: unitTypeNames,
        unit_ids: toNumericArray(userRow.unit_ids),
        unit_names: unitNames,
        cargo_ids: toNumericArray(userRow.cargo_ids),
        cargo_names: cargoNames
      },
      unit_type_name: unitTypeNames[0] ?? "",
      unit_name: unitNames[0] ?? "",
      cargo_name: cargoNames[0] ?? "",
      verify: {
        email: Boolean(userRow.verify_email),
        whatsapp: Boolean(userRow.verify_whatsapp)
      },
      createdAt: userRow.created_at ?? userRow.createdAt ?? null,
      updatedAt: userRow.updated_at ?? userRow.updatedAt ?? null
    };
  }

  async updatePhotoByCedula(cedula, photoUrl) {
    this.ensurePool();

    if (!cedula) {
      throw new Error("La cédula es requerida");
    }

    await this.pool.query(
      "UPDATE persons SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE cedula = ?",
      [photoUrl, cedula]
    );

    const updated = await this.findByCedulaOrEmail({ cedula });

    return this.toPublicUser(updated);
  }

  async update(userId, data) {
    this.ensurePool();

    const fields = [];
    const values = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (!fields.length) return null;

    values.push(userId);

    await this.pool.query(
      `UPDATE persons SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const updated = await this.findById(userId);

    return this.toPublicUser(updated);
  }

  async updateMe(userId, data) {
    const allowedFields = [
      "first_name",
      "last_name",
      "email",
      "whatsapp",
      "direccion",
      "pais",
      "pais_residencia",
      "provincia_residencia",
      "ciudad_residencia",
      "calle_primaria",
      "calle_secundaria",
      "codigo_postal"
    ];

    const filtered = {};

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    });

    return this.update(userId, filtered);
  }
}
