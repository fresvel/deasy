import { getMariaDBPool } from "../../config/mariadb.js";

/**
 * Repositorio para `person_bank_accounts`.
 *
 * Actualmente el docente registra una sola cuenta bancaria principal
 * (Opción A: el docente la llena en su perfil). La tabla admite
 * múltiples cuentas en el futuro si TTHH lo requiere.
 */
export default class PersonBankRepository {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  async findPrimaryByPersonId(personId) {
    const [rows] = await this.pool.query(
      "SELECT * FROM person_bank_accounts WHERE person_id = ? AND es_principal = 1 LIMIT 1",
      [personId]
    );
    return rows?.[0] ?? null;
  }

  async findAllByPersonId(personId) {
    const [rows] = await this.pool.query(
      "SELECT * FROM person_bank_accounts WHERE person_id = ? ORDER BY es_principal DESC, created_at ASC",
      [personId]
    );
    return rows;
  }

  /**
   * Crea o actualiza la cuenta bancaria principal del docente.
   *
   * @param {number} personId
   * @param {{ banco, numero_cuenta, tipo_cuenta }} data
   */
  async upsertPrimary(personId, data) {
    const existing = await this.findPrimaryByPersonId(personId);

    if (existing) {
      await this.pool.query(
        `UPDATE person_bank_accounts
         SET banco = ?, numero_cuenta = ?, tipo_cuenta = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [data.banco, data.numero_cuenta, data.tipo_cuenta ?? "Ahorro", existing.id]
      );
    } else {
      await this.pool.query(
        `INSERT INTO person_bank_accounts (person_id, banco, numero_cuenta, tipo_cuenta, es_principal)
         VALUES (?, ?, ?, ?, 1)`,
        [personId, data.banco, data.numero_cuenta, data.tipo_cuenta ?? "Ahorro"]
      );
    }

    return this.findPrimaryByPersonId(personId);
  }

  toPublic(row) {
    if (!row) return null;
    return {
      id:            row.id,
      banco:         row.banco,
      numero_cuenta: row.numero_cuenta,
      tipo_cuenta:   row.tipo_cuenta,
      es_principal:  Boolean(row.es_principal),
    };
  }
}