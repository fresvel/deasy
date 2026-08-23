import {
  ACCESS_LEVELS,
  accessSubqueryCorrelated,
  listProcessParticipants,
} from "../documents/DeliverableAccessService.js";
import { getPostgresPool } from "../../config/postgres.js";

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

    // AQUÍ NO VA el guard del IDOR de entregables
    // (`AND (ti.responsible_position_id IS NULL OR ta.position_id = ti.responsible_position_id)`,
    // ver `controllers/users/user_controler.queries.js:124`). No es una copia que se quedó atrás:
    // se evaluó el 2026-08-09 (plan maestro 1.9) y se descartó, por tres motivos.
    //
    // 1. Aquel guard responde «¿es TUYO este entregable?» y protege consultas cuya FILA es un
    //    entregable. Esta no lo es: el thread es del PROCESO en una unidad. El `LEFT JOIN
    //    task_items` solo abanica filas, y lo único que se proyecta —`scope_unit_id`— es IDÉNTICO
    //    en todas las filas de una tarea: hoy sale directo de `tasks.scope_unit_id`.
    // 2. La lista de participantes de más abajo mete a TODOS los que responden de algún entregable
    //    de la unidad, sin filtrar por cuál. Añadir el guard SOLO aquí dejaría gente dentro del
    //    hilo (recibe los mensajes) y con 403 al abrirlo.
    // 3. Medido contra la base de dev: no recorta el conjunto de unidades de nadie, lo VACÍA. Ocho
    //    de las diez personas asignadas a la tarea 8 (proceso 1, unidad 8) pasaban de `{8}` a
    //    ninguna unidad accesible. Y el corte dependería de datos ajenos: en la tarea 9 (misma
    //    forma, 10 asignados, 0 entregables) el `LEFT JOIN` deja `ti` a NULL y las diez conservan
    //    el acceso, así que el hilo se le caería a ocho de ellas en cuanto un COMPAÑERO creara el
    //    primer entregable.
    const [accessRows] = await this.pool.query(
      `SELECT DISTINCT
         t.id AS task_id,
         t.process_definition_id,
         pdv.process_id,
         -- La unidad la tiene la tarea directamente. Antes salia de un COALESCE de TRES joins
         -- —el puesto de la tarea, el del entregable, y el del dueño del documento— para acabar
         -- en el mismo valor: medido, coincide en las 13 tareas. El primero de los tres colgaba
         -- de tasks.responsible_position_id, que se retiro el 2026-08-23.
         t.scope_unit_id,
         ti.responsible_position_id AS task_item_responsible_position_id,
         ti.created_by_person_id
       -- El LEFT JOIN documents que habia aqui solo servia para proyectar owner_person_id, que
       -- ni se filtraba ni se leia aguas abajo: quien decide la pertenencia al hilo es
       -- accessSubqueryCorrelated, mas abajo. La columna se retiro el 2026-08-23 y el join con
       -- ella.
       FROM tasks t
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       LEFT JOIN task_items ti ON ti.task_id = t.id
       WHERE pdv.process_id = ?
         -- El conjunto de participantes lo declara DeliverableAccessService, al nivel ANCHO
         -- (conversacion): un hilo de proceso incluye a todos los asignados de la tarea, no
         -- solo al responsable del entregable. Eso NO es el IDOR relajado, es la decision del
         -- defecto 1.9, medida y escrita justo arriba.
         --
         -- El alcance es correlacionado con ti, que el LEFT JOIN de esta consulta ya trae.
         AND EXISTS (
           SELECT 1
           FROM (${accessSubqueryCorrelated("ti", ACCESS_LEVELS.CONVERSACION)}) participantes
           WHERE participantes.person_id = ?
         )`,
      // Ocho `normalizedPersonId` en uno: el resto los absorbio la subconsulta.
      [normalizedProcessId, normalizedPersonId]
    );

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

    const [adminRows] = await this.pool.query(
      `SELECT DISTINCT person_id
       FROM (
         -- Quien MODERA el hilo. Colgaba del puesto responsable de la TAREA, que el lanzamiento
         -- ponia como el puesto de menor slot_no de la unidad: o sea, moderaba quien ocupara un
         -- puesto cualquiera. Con esa columna retirada (2026-08-23) pasa a ser la JEFATURA de la
         -- unidad, que es el mismo criterio ya decidido para el custodio y para unit_head.
         SELECT pa.person_id
         FROM tasks t
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up
           ON up.unit_id = t.scope_unit_id
          AND up.is_unit_head = 1
          AND up.is_active = 1
         INNER JOIN position_assignments pa
           ON pa.position_id = up.id
          AND pa.is_current = 1
         WHERE pdv.process_id = ?
           AND t.scope_unit_id = ?
         UNION
         -- Quien ENCARGO un entregable de esta unidad. Antes salia del creador de la TAREA,
         -- retirado el 2026-08-23 por estar NULL en el camino automatico.
         SELECT ti.created_by_person_id AS person_id
         FROM task_items ti
         INNER JOIN tasks t ON t.id = ti.task_id
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         WHERE pdv.process_id = ?
           AND t.scope_unit_id = ?
           AND ti.created_by_person_id IS NOT NULL
       ) admins
       WHERE person_id IS NOT NULL`,
      [normalizedProcessId, selectedScopeUnitId, normalizedProcessId, selectedScopeUnitId]
    );

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

    const [scopeRows] = await this.pool.query(
      `SELECT DISTINCT
         p.name AS process_name,
         COALESCE(u.label, u.name) AS scope_unit_label
       FROM process_definition_versions pdv
       INNER JOIN processes p ON p.id = pdv.process_id
       INNER JOIN tasks t ON t.process_definition_id = pdv.id
       INNER JOIN units u ON u.id = t.scope_unit_id
       WHERE pdv.process_id = ?
         AND u.id = ?
       LIMIT 1`,
      [normalizedProcessId, selectedScopeUnitId]
    );
    const scopeRow = scopeRows?.[0] || null;

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
