import { getPostgresPool } from "../../../config/postgres.js";
import {
  etiquetaDeUnidadActiva,
  miembrosDeUnidad,
  unidadesDeLaPersona,
} from "../datos/consulta/directorioDeUnidades.js";

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
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      const error = new Error("Conexión PostgreSQL no disponible.");
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

    const rows = await unidadesDeLaPersona(this.pool, normalizedPersonId);

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

    const etiqueta = await etiquetaDeUnidadActiva(this.pool, normalizedUnitId);

    if (!etiqueta) {
      const error = new Error("Unidad no encontrada o inactiva.");
      error.status = 404;
      throw error;
    }

    const unitLabel = etiqueta;

    const memberRows = await miembrosDeUnidad(this.pool, normalizedUnitId);

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
