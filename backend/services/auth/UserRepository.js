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
      `SELECT * FROM users WHERE ${conditions.join(" OR ")} LIMIT 1`,
      params
    );

    return rows?.[0] ?? null;
  }

  async findAll() {
    this.ensurePool();
    const [rows] = await this.pool.query("SELECT * FROM users ORDER BY created_at DESC");
    return rows;
  }

  async create(userData) {
    this.ensurePool();

    const payload = {
      mongo_id: userData.mongo_id ?? null,
      cedula: userData.cedula,
      email: userData.email,
      password_hash: userData.password_hash ?? userData.password,
      nombre: userData.nombre,
      apellido: userData.apellido,
      whatsapp: userData.whatsapp ?? null,
      direccion: userData.direccion ?? null,
      pais: userData.pais ?? null,
      status: userData.status ?? DEFAULT_STATUS,
      verify_email: Number(
        userData.verify_email ??
        userData.verify?.email ??
        0
      ),
      verify_whatsapp: Number(
        userData.verify_whatsapp ??
        userData.verify?.whatsapp ??
        0
      ),
      photo_url: userData.photo_url ?? userData.photoUrl ?? null
    };

    const requiredFields = ["cedula", "email", "password_hash", "nombre", "apellido"];
    const missingFields = requiredFields.filter((field) => !payload[field]);

    if (missingFields.length) {
      throw new Error(`Datos incompletos del usuario: ${missingFields.join(", ")}`);
    }

    const columns = Object.keys(payload);
    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");

    const [result] = await this.pool.query(
      `INSERT INTO users (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return {
      id: result.insertId,
      ...payload
    };
  }

  toPublicUser(userRow) {
    if (!userRow) {
      return null;
    }

    return {
      id: userRow.id ?? userRow._id,
      _id: (userRow.id ?? userRow._id)?.toString(),
      cedula: userRow.cedula,
      nombre: userRow.nombre,
      apellido: userRow.apellido,
      email: userRow.email,
      whatsapp: userRow.whatsapp,
      direccion: userRow.direccion,
      pais: userRow.pais,
      photoUrl: userRow.photo_url ?? userRow.photoUrl ?? null,
      status: userRow.status ?? DEFAULT_STATUS,
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
      "UPDATE users SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE cedula = ?",
      [photoUrl, cedula]
    );

    const updated = await this.findByCedulaOrEmail({ cedula });
    return this.toPublicUser(updated);
  }
}