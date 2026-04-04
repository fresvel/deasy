import { getMariaDBPool } from "../../config/mariadb.js";

const normalizeNumericId = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const buildStableKey = (processId, scopeUnitId) => `process:${processId}:unit:${scopeUnitId}`;

export default class ChatAuthorizationService {
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

    const [accessRows] = await this.pool.query(
      `SELECT DISTINCT
         t.id AS task_id,
         t.process_definition_id,
         pdv.process_id,
         COALESCE(task_pos.unit_id, item_pos.unit_id, owner_pos.unit_id) AS scope_unit_id,
         t.responsible_position_id AS task_responsible_position_id,
         ti.responsible_position_id AS task_item_responsible_position_id,
         t.created_by_user_id,
         d.owner_person_id
       FROM tasks t
       INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       LEFT JOIN task_items ti ON ti.task_id = t.id
       LEFT JOIN documents d ON d.task_item_id = ti.id
       LEFT JOIN unit_positions task_pos ON task_pos.id = t.responsible_position_id
       LEFT JOIN unit_positions item_pos ON item_pos.id = ti.responsible_position_id
       LEFT JOIN position_assignments owner_pa
         ON owner_pa.person_id = d.owner_person_id
        AND owner_pa.is_current = 1
       LEFT JOIN unit_positions owner_pos ON owner_pos.id = owner_pa.position_id
       WHERE pdv.process_id = ?
         AND (
           t.created_by_user_id = ?
           OR d.owner_person_id = ?
           OR ti.assigned_person_id = ?
           OR EXISTS (
             SELECT 1
             FROM task_assignments ta
             LEFT JOIN position_assignments pa
               ON pa.position_id = ta.position_id
              AND pa.is_current = 1
              AND pa.person_id = ?
             WHERE ta.task_id = t.id
               AND (
                 ta.assigned_person_id = ?
                 OR (ta.assigned_person_id IS NULL AND pa.person_id = ?)
               )
           )
           OR EXISTS (
             SELECT 1
             FROM document_versions dv
             INNER JOIN (
               SELECT document_id, MAX(version) AS max_version
               FROM document_versions
               GROUP BY document_id
             ) latest_dv
               ON latest_dv.document_id = dv.document_id
              AND latest_dv.max_version = dv.version
             INNER JOIN document_fill_flows dff ON dff.document_version_id = dv.id
             INNER JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
             WHERE dv.document_id = d.id
               AND fr.assigned_person_id = ?
           )
           OR EXISTS (
             SELECT 1
             FROM document_versions dv
             INNER JOIN (
               SELECT document_id, MAX(version) AS max_version
               FROM document_versions
               GROUP BY document_id
             ) latest_dv
               ON latest_dv.document_id = dv.document_id
              AND latest_dv.max_version = dv.version
             INNER JOIN signature_flow_instances sfi ON sfi.document_version_id = dv.id
             INNER JOIN signature_requests sr ON sr.instance_id = sfi.id
             WHERE dv.document_id = d.id
               AND sr.assigned_person_id = ?
           )
         )`,
      [
        normalizedProcessId,
        normalizedPersonId,
        normalizedPersonId,
        normalizedPersonId,
        normalizedPersonId,
        normalizedPersonId,
        normalizedPersonId,
        normalizedPersonId,
        normalizedPersonId
      ]
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
         SELECT pa.person_id
         FROM tasks t
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         INNER JOIN position_assignments pa
           ON pa.position_id = up.id
          AND pa.is_current = 1
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
         UNION
         SELECT t.created_by_user_id AS person_id
         FROM tasks t
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
           AND t.created_by_user_id IS NOT NULL
       ) admins
       WHERE person_id IS NOT NULL`,
      [normalizedProcessId, selectedScopeUnitId, normalizedProcessId, selectedScopeUnitId]
    );

    const [participantRows] = await this.pool.query(
      `SELECT DISTINCT person_id, source_type
       FROM (
         SELECT ta.assigned_person_id AS person_id, 'task_assignment' AS source_type
         FROM task_assignments ta
         INNER JOIN tasks t ON t.id = ta.task_id
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
           AND ta.assigned_person_id IS NOT NULL

         UNION

         SELECT ti.assigned_person_id AS person_id, 'task_item_assignee' AS source_type
         FROM task_items ti
         INNER JOIN tasks t ON t.id = ti.task_id
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
           AND ti.assigned_person_id IS NOT NULL

         UNION

         SELECT d.owner_person_id AS person_id, 'document_owner' AS source_type
         FROM documents d
         INNER JOIN task_items ti ON ti.id = d.task_item_id
         INNER JOIN tasks t ON t.id = ti.task_id
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
           AND d.owner_person_id IS NOT NULL

         UNION

         SELECT fr.assigned_person_id AS person_id, 'fill_request' AS source_type
         FROM fill_requests fr
         INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
         INNER JOIN document_versions dv ON dv.id = dff.document_version_id
         INNER JOIN documents d ON d.id = dv.document_id
         INNER JOIN task_items ti ON ti.id = d.task_item_id
         INNER JOIN tasks t ON t.id = ti.task_id
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
           AND fr.assigned_person_id IS NOT NULL

         UNION

         SELECT sr.assigned_person_id AS person_id, 'signature_request' AS source_type
         FROM signature_requests sr
         INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
         INNER JOIN document_versions dv ON dv.id = sfi.document_version_id
         INNER JOIN documents d ON d.id = dv.document_id
         INNER JOIN task_items ti ON ti.id = d.task_item_id
         INNER JOIN tasks t ON t.id = ti.task_id
         INNER JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
         INNER JOIN unit_positions up ON up.id = t.responsible_position_id
         WHERE pdv.process_id = ?
           AND up.unit_id = ?
           AND sr.assigned_person_id IS NOT NULL
       ) participants
       WHERE person_id IS NOT NULL`,
      [
        normalizedProcessId,
        selectedScopeUnitId,
        normalizedProcessId,
        selectedScopeUnitId,
        normalizedProcessId,
        selectedScopeUnitId,
        normalizedProcessId,
        selectedScopeUnitId,
        normalizedProcessId,
        selectedScopeUnitId
      ]
    );

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
       INNER JOIN unit_positions up ON up.id = t.responsible_position_id
       INNER JOIN units u ON u.id = up.unit_id
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
