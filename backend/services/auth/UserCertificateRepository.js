import { getMariaDBPool } from "../../config/mariadb.js";

export default class UserCertificateRepository {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con MariaDB no está disponible.");
    }
  }

  async listByPersonId(personId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT *
       FROM person_certificates
       WHERE person_id = ?
       ORDER BY is_default DESC, created_at DESC, id DESC`,
      [personId]
    );
    return rows;
  }

  async findById(id) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      "SELECT * FROM person_certificates WHERE id = ? LIMIT 1",
      [id]
    );
    return rows?.[0] ?? null;
  }

  async findOwnedById(personId, certificateId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT *
       FROM person_certificates
       WHERE id = ? AND person_id = ?
       LIMIT 1`,
      [certificateId, personId]
    );
    return rows?.[0] ?? null;
  }

  async create(payload) {
    this.ensurePool();
    const columns = Object.keys(payload);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((key) => payload[key]);
    const [result] = await this.pool.query(
      `INSERT INTO person_certificates (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );
    return this.findById(result.insertId);
  }

  async delete(certificateId, personId) {
    this.ensurePool();
    const [result] = await this.pool.query(
      "DELETE FROM person_certificates WHERE id = ? AND person_id = ?",
      [certificateId, personId]
    );
    return result.affectedRows > 0;
  }

  async clearDefaultForPerson(personId) {
    this.ensurePool();
    await this.pool.query(
      "UPDATE person_certificates SET is_default = 0 WHERE person_id = ?",
      [personId]
    );
  }

  async setDefault(certificateId, personId) {
    this.ensurePool();
    await this.clearDefaultForPerson(personId);
    await this.pool.query(
      "UPDATE person_certificates SET is_default = 1 WHERE id = ? AND person_id = ?",
      [certificateId, personId]
    );
    return this.findOwnedById(personId, certificateId);
  }

  toPublic(row) {
    if (!row) return null;
    return {
      id: row.id,
      person_id: row.person_id,
      label: row.label,
      original_filename: row.original_filename,
      bucket: row.bucket,
      object_name: row.object_name,
      is_default: Boolean(row.is_default),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
