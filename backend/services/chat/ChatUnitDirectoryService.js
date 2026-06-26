import { getMariaDBPool } from "../../config/mariadb.js";

const normalizeNumericId = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const buildUnitStableKey = (unitId) => `unit:${unitId}`;

/**
 * Resuelve la membresía de unidades para el chat de unidad.
 *
 * Membresía: una persona pertenece a una unidad si tiene una asignación de
 * puesto vigente (position_assignments.is_current = 1) sobre un puesto de esa
 * unidad (unit_positions.unit_id). Los participantes del chat de unidad son
 * todas las personas con asignación vigente en la unidad; el/los ocupante(s)
 * del puesto cabeza (unit_positions.is_unit_head = 1) quedan como admin.
 */
export default class ChatUnitDirectoryService {
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      const error = new Error("Conexión MariaDB no disponible.");
      error.status = 500;
      throw error;
    }
  }

  async listUnitsForPerson(personId) {
    this.ensurePool();

    const normalizedPersonId = normalizeNumericId(personId);
    if (!normalizedPersonId) {
      const error = new Error("personId inválido.");
      error.status = 400;
      throw error;
    }

    const [rows] = await this.pool.query(
      `SELECT
         u.id AS unit_id,
         COALESCE(u.label, u.name) AS unit_label,
         (
           SELECT COUNT(DISTINCT pa2.person_id)
           FROM position_assignments pa2
           INNER JOIN unit_positions up2 ON up2.id = pa2.position_id
           WHERE up2.unit_id = u.id
             AND pa2.is_current = 1
         ) AS member_count
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       INNER JOIN units u ON u.id = up.unit_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND u.is_active = 1
       GROUP BY u.id, unit_label
       ORDER BY unit_label`,
      [normalizedPersonId]
    );

    return rows
      .map((row) => {
        const unitId = normalizeNumericId(row.unit_id);
        return {
          unitId,
          stableKey: unitId ? buildUnitStableKey(unitId) : null,
          label: row.unit_label || `Unidad #${row.unit_id}`,
          memberCount: Number(row.member_count || 0)
        };
      })
      .filter((row) => row.unitId);
  }

  async resolveUnitThreadContext({ personId, unitId }) {
    this.ensurePool();

    const normalizedPersonId = normalizeNumericId(personId);
    const normalizedUnitId = normalizeNumericId(unitId);

    if (!normalizedPersonId || !normalizedUnitId) {
      const error = new Error("personId o unitId inválidos.");
      error.status = 400;
      throw error;
    }

    const [unitRows] = await this.pool.query(
      `SELECT COALESCE(u.label, u.name) AS unit_label
       FROM units u
       WHERE u.id = ?
         AND u.is_active = 1
       LIMIT 1`,
      [normalizedUnitId]
    );

    if (!unitRows.length) {
      const error = new Error("Unidad no encontrada o inactiva.");
      error.status = 404;
      throw error;
    }

    const unitLabel = unitRows[0].unit_label || `Unidad #${normalizedUnitId}`;

    const [memberRows] = await this.pool.query(
      `SELECT pa.person_id, MAX(up.is_unit_head) AS is_unit_head
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       WHERE up.unit_id = ?
         AND pa.is_current = 1
       GROUP BY pa.person_id`,
      [normalizedUnitId]
    );

    const participantIds = [];
    const adminIds = [];
    memberRows.forEach((row) => {
      const id = normalizeNumericId(row.person_id);
      if (!id) return;
      participantIds.push(id);
      if (Number(row.is_unit_head) === 1) {
        adminIds.push(id);
      }
    });

    if (!participantIds.includes(normalizedPersonId)) {
      const error = new Error("No perteneces a esta unidad.");
      error.status = 403;
      throw error;
    }

    return {
      unitId: normalizedUnitId,
      unitLabel,
      stableKey: buildUnitStableKey(normalizedUnitId),
      participantIds: Array.from(new Set(participantIds)),
      adminIds: Array.from(new Set(adminIds))
    };
  }
}
