import { getMariaDBPool } from "../../config/mariadb.js";

/**
 * Repositorio para `person_emergency_contacts`.
 *
 * Relación 1:1 con `persons`. Almacena el contacto de emergencia
 * y las alergias del docente según la sección correspondiente del
 * formulario TTHH de la PUCESE.
 */
export default class PersonEmergencyRepository {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  async findByPersonId(personId) {
    const [rows] = await this.pool.query(
      "SELECT * FROM person_emergency_contacts WHERE person_id = ? LIMIT 1",
      [personId]
    );
    return rows?.[0] ?? null;
  }

  /**
   * Crea o actualiza el contacto de emergencia del docente.
   *
   * @param {number} personId
   * @param {{ nombre, parentesco, telefono, celular, alergias }} data
   */
  async upsert(personId, data) {
    const existing = await this.findByPersonId(personId);

    if (existing) {
      await this.pool.query(
        `UPDATE person_emergency_contacts
         SET nombre = ?, parentesco = ?, telefono = ?, celular = ?, alergias = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.nombre,
          data.parentesco ?? null,
          data.telefono   ?? null,
          data.celular    ?? null,
          data.alergias   ?? null,
          existing.id,
        ]
      );
    } else {
      await this.pool.query(
        `INSERT INTO person_emergency_contacts
           (person_id, nombre, parentesco, telefono, celular, alergias)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          personId,
          data.nombre,
          data.parentesco ?? null,
          data.telefono   ?? null,
          data.celular    ?? null,
          data.alergias   ?? null,
        ]
      );
    }

    return this.findByPersonId(personId);
  }

  toPublic(row) {
    if (!row) return null;
    return {
      nombre:     row.nombre,
      parentesco: row.parentesco ?? null,
      telefono:   row.telefono   ?? null,
      celular:    row.celular    ?? null,
      alergias:   row.alergias   ?? null,
    };
  }
}