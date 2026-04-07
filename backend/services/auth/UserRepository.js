import { getMariaDBPool } from "../../config/mariadb.js";

const DEFAULT_STATUS = "Inactivo";

/**
 * Repositorio de personas (tabla `persons`).
 *
 * Cubre el ciclo CRUD completo e incluye los campos TTHH agregados
 * en el refactor `refactor/tthh-sql-format`:
 *   - Identidad: fecha_nacimiento, genero, etnia, nacionalidad,
 *                estado_civil, tipo_sangre, pasaporte, tipo_visa
 *   - Contacto:  celular (independiente de whatsapp)
 *   - Domicilio: numero_casa, referencia_domicilio, sector_barrio,
 *                provincia_nacimiento, canton, parroquia
 *
 * Los datos de salud, banco y contacto de emergencia tienen sus propios
 * repositorios: PersonHealthRepository, PersonBankRepository,
 * PersonEmergencyRepository.
 */
export default class UserRepository {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con MariaDB no está disponible.");
    }
  }

  // ─────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────

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

    if (cedula) { conditions.push("cedula = ?"); params.push(cedula); }
    if (email)  { conditions.push("email = ?");  params.push(email);  }
    if (!conditions.length) return null;

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

  async search(term = "", limit = 20, status = null) {
    this.ensurePool();
    const normalized  = term?.trim();
    const safeLimit   = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 20;
    const statusFilter = status?.trim();

    const conditions = [];
    const params = [];

    if (normalized) {
      const like = `%${normalized}%`;
      conditions.push("(cedula LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)");
      params.push(like, like, like, like);
    }
    if (statusFilter) { conditions.push("status = ?"); params.push(statusFilter); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await this.pool.query(
      `SELECT * FROM persons ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, safeLimit]
    );
    return rows;
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(userData) {
    this.ensurePool();

    const payload = {
      // Identidad básica
      cedula:       userData.cedula,
      email:        userData.email        ?? null,
      password_hash: userData.password_hash ?? userData.password,
      first_name:   userData.first_name   ?? userData.nombre,
      last_name:    userData.last_name    ?? userData.apellido,

      // Identidad TTHH
      fecha_nacimiento:    userData.fecha_nacimiento    ?? null,
      genero:              userData.genero              ?? null,
      etnia:               userData.etnia               ?? null,
      nacionalidad:        userData.nacionalidad         ?? null,
      estado_civil:        userData.estado_civil         ?? null,
      tipo_sangre:         userData.tipo_sangre          ?? null,
      pasaporte:           userData.pasaporte            ?? null,
      tipo_visa:           userData.tipo_visa            ?? null,

      // Contacto
      whatsapp:    userData.whatsapp ?? null,
      celular:     userData.celular  ?? null,

      // Dirección
      direccion:              userData.direccion              ?? null,
      pais:                   userData.pais                   ?? null,
      provincia_nacimiento:   userData.provincia_nacimiento   ?? null,
      canton:                 userData.canton                 ?? null,
      parroquia:              userData.parroquia              ?? null,
      pais_residencia:        userData.pais_residencia        ?? null,
      provincia_residencia:   userData.provincia_residencia   ?? null,
      ciudad_residencia:      userData.ciudad_residencia      ?? null,
      calle_primaria:         userData.calle_primaria         ?? null,
      calle_secundaria:       userData.calle_secundaria       ?? null,
      numero_casa:            userData.numero_casa            ?? null,
      referencia_domicilio:   userData.referencia_domicilio   ?? null,
      sector_barrio:          userData.sector_barrio          ?? null,
      codigo_postal:          userData.codigo_postal          ?? null,

      // Estado y control
      status:          userData.status          ?? DEFAULT_STATUS,
      verify_email:    Number(userData.verify_email    ?? userData.verify?.email    ?? 0),
      verify_whatsapp: Number(userData.verify_whatsapp ?? userData.verify?.whatsapp ?? 0),
      photo_url:       userData.photo_url ?? userData.photoUrl ?? null,
      is_active:       userData.is_active ?? 1,
      token:           userData.token,
    };

    if (!payload.token) throw new Error("Token no generado");

    const required = ["cedula", "password_hash", "first_name", "last_name"];
    const missing  = required.filter((f) => !payload[f]);
    if (missing.length) throw new Error(`Datos incompletos: ${missing.join(", ")}`);

    const columns      = Object.keys(payload);
    const values       = columns.map((k) => payload[k]);
    const placeholders = columns.map(() => "?").join(", ");

    const [result] = await this.pool.query(
      `INSERT INTO persons (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return { id: result.insertId, ...payload };
  }

  // ─────────────────────────────────────────────
  // UPDATE (interno — sin whitelist)
  // ─────────────────────────────────────────────

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

    return this.toPublicUser(await this.findById(userId));
  }

  // ─────────────────────────────────────────────
  // UPDATE ME (público — con whitelist TTHH)
  // ─────────────────────────────────────────────

  /**
   * Actualiza los campos del perfil propio del docente.
   * Solo se permiten los campos de esta lista — ningún otro campo
   * (status, password_hash, token, etc.) puede ser modificado por esta vía.
   */
  async updateMe(userId, data) {
    const allowed = [
      // Básicos
      "first_name", "last_name", "email", "whatsapp", "celular",

      // Identidad TTHH
      "fecha_nacimiento", "genero", "etnia", "nacionalidad",
      "estado_civil", "tipo_sangre", "pasaporte", "tipo_visa",

      // Dirección
      "direccion", "pais",
      "provincia_nacimiento", "canton", "parroquia",
      "pais_residencia", "provincia_residencia", "ciudad_residencia",
      "calle_primaria", "calle_secundaria",
      "numero_casa", "referencia_domicilio", "sector_barrio",
      "codigo_postal",
    ];

    const filtered = {};
    allowed.forEach((field) => {
      if (data[field] !== undefined) filtered[field] = data[field];
    });

    return this.update(userId, filtered);
  }

  // ─────────────────────────────────────────────
  // PHOTO
  // ─────────────────────────────────────────────

  async updatePhotoByCedula(cedula, photoUrl) {
    this.ensurePool();
    if (!cedula) throw new Error("La cédula es requerida");

    await this.pool.query(
      "UPDATE persons SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE cedula = ?",
      [photoUrl, cedula]
    );

    return this.toPublicUser(await this.findByCedulaOrEmail({ cedula }));
  }

  // ─────────────────────────────────────────────
  // SERIALIZACIÓN PÚBLICA
  // ─────────────────────────────────────────────

  /**
   * Convierte una fila de `persons` al objeto público que se
   * devuelve en las respuestas de la API.
   *
   * Incluye todos los campos TTHH del refactor.
   */
  toPublicUser(row) {
    if (!row) return null;

    return {
      id:   row.id   ?? row._id,
      _id:  (row.id  ?? row._id)?.toString(),
      cedula: row.cedula,

      // Nombre
      first_name: row.first_name,
      last_name:  row.last_name,

      // Identidad TTHH
      fecha_nacimiento: row.fecha_nacimiento ?? null,
      genero:           row.genero           ?? null,
      etnia:            row.etnia            ?? null,
      nacionalidad:     row.nacionalidad      ?? null,
      estado_civil:     row.estado_civil      ?? null,
      tipo_sangre:      row.tipo_sangre       ?? null,
      pasaporte:        row.pasaporte         ?? null,
      tipo_visa:        row.tipo_visa         ?? null,

      // Contacto
      email:    row.email,
      whatsapp: row.whatsapp ?? null,
      celular:  row.celular  ?? null,

      // Dirección
      direccion:             row.direccion             ?? null,
      pais:                  row.pais                  ?? null,
      provincia_nacimiento:  row.provincia_nacimiento  ?? null,
      canton:                row.canton                ?? null,
      parroquia:             row.parroquia             ?? null,
      pais_residencia:       row.pais_residencia       ?? null,
      provincia_residencia:  row.provincia_residencia  ?? null,
      ciudad_residencia:     row.ciudad_residencia     ?? null,
      calle_primaria:        row.calle_primaria        ?? null,
      calle_secundaria:      row.calle_secundaria      ?? null,
      numero_casa:           row.numero_casa           ?? null,
      referencia_domicilio:  row.referencia_domicilio  ?? null,
      sector_barrio:         row.sector_barrio         ?? null,
      codigo_postal:         row.codigo_postal         ?? null,

      // Foto y estado
      photoUrl: row.photo_url ?? row.photoUrl ?? null,
      status:   row.status    ?? DEFAULT_STATUS,
      verify: {
        email:    Boolean(row.verify_email),
        whatsapp: Boolean(row.verify_whatsapp),
      },
      token:     row.token,
      createdAt: row.created_at ?? row.createdAt ?? null,
      updatedAt: row.updated_at ?? row.updatedAt ?? null,
    };
  }
}