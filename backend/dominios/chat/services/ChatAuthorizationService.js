import { listProcessParticipants } from "../../../services/documents/DeliverableAccessService.js";
import { getPostgresPool } from "../../../config/postgres.js";
import {
  etiquetasDelHilo,
  moderadoresDelHilo,
  tareasAccesiblesDelProceso,
} from "../datos/consulta/accesoAlHilo.js";

const normalizeNumericId = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const buildStableKey = (processId, scopeUnitId) => `process:${processId}:unit:${scopeUnitId}`;

export default class ChatAuthorizationService {
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

  async resolveProcessThreadContext({ personId, processId, scopeUnitId = null }) {
    this.ensurePool();

    const normalizedPersonId = normalizeNumericId(personId);
    const normalizedProcessId = normalizeNumericId(processId);
    const normalizedScopeUnitId = normalizeNumericId(scopeUnitId);

    if (!normalizedPersonId || !normalizedProcessId) {
      const error = new Error("personId o processId inválidos.");
      error.status = 400;
      throw error;
    }

    // El predicado de participación, la decisión del IDOR y el SQL entero viven en
    // `datos/consulta/accesoAlHilo.js`: aquí sólo se decide qué hacer con las filas.
    const accessRows = await tareasAccesiblesDelProceso(this.pool, normalizedProcessId, normalizedPersonId);

    const scopedRows = accessRows
      .map((row) => ({
        ...row,
        scope_unit_id: normalizeNumericId(row.scope_unit_id),
        process_definition_id: normalizeNumericId(row.process_definition_id),
        task_id: normalizeNumericId(row.task_id)
      }))
      .filter((row) => row.scope_unit_id);

    if (!scopedRows.length) {
      const error = new Error("No tienes acceso operativo a este proceso.");
      error.status = 403;
      throw error;
    }

    const uniqueScopeUnitIds = Array.from(new Set(scopedRows.map((row) => row.scope_unit_id)));
    let selectedScopeUnitId = normalizedScopeUnitId;

    if (!selectedScopeUnitId) {
      if (uniqueScopeUnitIds.length > 1) {
        const error = new Error("Este proceso tiene más de una unidad accesible. Debes indicar scope_unit_id.");
        error.status = 409;
        error.details = { scope_unit_ids: uniqueScopeUnitIds };
        throw error;
      }
      selectedScopeUnitId = uniqueScopeUnitIds[0];
    }

    const selectedRows = scopedRows.filter((row) => row.scope_unit_id === selectedScopeUnitId);
    if (!selectedRows.length) {
      const error = new Error("No tienes acceso al thread del proceso en la unidad solicitada.");
      error.status = 403;
      throw error;
    }

    const processDefinitionIds = Array.from(
      new Set(selectedRows.map((row) => row.process_definition_id).filter(Boolean))
    );
    const taskIds = Array.from(new Set(selectedRows.map((row) => row.task_id).filter(Boolean)));

    const adminRows = await moderadoresDelHilo(this.pool, normalizedProcessId, selectedScopeUnitId);

    // La lista de participantes del hilo. Era la sexta reimplementacion del conjunto —cinco
    // ramas UNION escritas a mano— y ahora es la misma tabla de fuentes que usa todo lo demas,
    // pedida al nivel ANCHO porque un hilo de proceso es mas ancho que un documento.
    //
    // ⚠️ Cambio latente, y se deja escrito: las ramas viejas de entrega y firma miraban SOLO la
    // ULTIMA version del documento. Las fuentes miran todas, asi que quien participo en la v1
    // conserva el hilo cuando aparece la v2. Es lo que dice el modelo -quien participo, participa-
    // y hoy es inerte: cero documentos con mas de una version en la base. El dia que los haya,
    // este parrafo explica por que.
    const participantRows = await listProcessParticipants(this.pool, {
      processId: normalizedProcessId,
      scopeUnitId: selectedScopeUnitId,
    });

    const participantIds = new Set([normalizedPersonId]);
    participantRows.forEach((row) => {
      const id = normalizeNumericId(row.person_id);
      if (id) participantIds.add(id);
    });

    adminRows.forEach((row) => {
      const id = normalizeNumericId(row.person_id);
      if (id) participantIds.add(id);
    });

    const adminIds = Array.from(
      new Set(adminRows.map((row) => normalizeNumericId(row.person_id)).filter(Boolean))
    );

    const scopeRow = await etiquetasDelHilo(this.pool, normalizedProcessId, selectedScopeUnitId);

    const currentDefinitionId = processDefinitionIds.length ? Math.max(...processDefinitionIds) : null;
    const originDefinitionId = processDefinitionIds.length ? Math.min(...processDefinitionIds) : null;

    return {
      processId: normalizedProcessId,
      scopeUnitId: selectedScopeUnitId,
      stableKey: buildStableKey(normalizedProcessId, selectedScopeUnitId),
      accessibleScopeUnitIds: uniqueScopeUnitIds,
      processDefinitionIds,
      currentDefinitionId,
      originDefinitionId,
      processName: scopeRow?.process_name || null,
      scopeUnitLabel: scopeRow?.scope_unit_label || null,
      taskIds,
      participantIds: Array.from(participantIds),
      adminIds
    };
  }
}
