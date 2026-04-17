import { getMariaDBPool } from "../../config/mariadb.js";

/**
 * Repositorio para `person_health`.
 *
 * Gestiona los datos de salud del docente: discapacidad y
 * enfermedad catastrófica. Es una relación 1:1 con `persons`.
 */
export default class PersonHealthRepository {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  async findByPersonId(personId) {
    const [rows] = await this.pool.query(
      "SELECT * FROM person_health WHERE person_id = ? LIMIT 1",
      [personId]
    );
    return rows?.[0] ?? null;
  }

  /**
   * Crea o actualiza (upsert) el registro de salud del docente.
   *
   * @param {number} personId
   * @param {{ tiene_discapacidad, tipo_discapacidad, porcentaje_discapacidad, enfermedad_catastrofica }} data
   */
  async upsert(personId, data) {
    const payload = {
      person_id:                personId,
      tiene_discapacidad:       data.tiene_discapacidad        ? 1 : 0,
      tipo_discapacidad:        data.tipo_discapacidad         ?? null,
      porcentaje_discapacidad:  data.porcentaje_discapacidad   ?? null,
      enfermedad_catastrofica:  data.enfermedad_catastrofica   ? 1 : 0,
    };

    await this.pool.query(
      `INSERT INTO person_health
         (person_id, tiene_discapacidad, tipo_discapacidad, porcentaje_discapacidad, enfermedad_catastrofica)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tiene_discapacidad       = VALUES(tiene_discapacidad),
         tipo_discapacidad        = VALUES(tipo_discapacidad),
         porcentaje_discapacidad  = VALUES(porcentaje_discapacidad),
         enfermedad_catastrofica  = VALUES(enfermedad_catastrofica),
         updated_at               = CURRENT_TIMESTAMP`,
      [
        payload.person_id,
        payload.tiene_discapacidad,
        payload.tipo_discapacidad,
        payload.porcentaje_discapacidad,
        payload.enfermedad_catastrofica,
      ]
    );

    return this.findByPersonId(personId);
  }

  toPublic(row) {
    if (!row) return null;
    return {
      tiene_discapacidad:      Boolean(row.tiene_discapacidad),
      tipo_discapacidad:       row.tipo_discapacidad      ?? null,
      porcentaje_discapacidad: row.porcentaje_discapacidad ?? null,
      enfermedad_catastrofica: Boolean(row.enfermedad_catastrofica),
    };
  }
}