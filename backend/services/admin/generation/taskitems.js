// Materialización de TASK_ITEMS y de las asignaciones de una tarea.
// Extraído de TaskGenerationService en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// Aquí se decide qué entregables (task_items) existen en una tarea y a qué posiciones se
// asigna, aplicando las reglas de reparto (process_target_rules) del proceso.
import {
  getPositionsForRule,
  getExistingTaskItemTemplateIds,
  getExistingTaskItemTargetKeys
} from "./queries.js";

export const ensureTaskItemsForTask = async (connection, taskId, processDefinitionId, executableTemplatesMap, startDate = null, endDate = null) => {
  // Solo las plantillas en modo `single` auto-generan su entregable de proceso.
  // `replicated`/`routed` no siembran ítem: el usuario crea réplicas/instancias on-demand.
  const templates = (executableTemplatesMap.get(processDefinitionId) || [])
    .filter((template) => String(template.item_mode || "single") === "single");
  if (!templates.length) {
    return { inserted: 0, total: 0 };
  }

  // Resolve dates from the task if not provided
  let resolvedStart = startDate;
  let resolvedEnd = endDate;
  if (resolvedStart === null && resolvedEnd === null) {
    const [taskRows] = await connection.query(
      `SELECT start_date, end_date FROM tasks WHERE id = ? LIMIT 1`,
      [taskId]
    );
    resolvedStart = taskRows?.[0]?.start_date ?? null;
    resolvedEnd = taskRows?.[0]?.end_date ?? null;
  }

  const existingTemplateIds = await getExistingTaskItemTemplateIds(connection, taskId);
  let inserted = 0;
  for (const template of templates) {
    if (existingTemplateIds.has(Number(template.id))) {
      continue;
    }
    await connection.query(
      `INSERT INTO task_items (
        task_id,
        process_definition_template_id,
        template_artifact_id,
        origin_kind,
        sort_order,
        start_date,
        end_date,
        status
      ) VALUES (?, ?, ?, 'process_defined', ?, ?, ?, ?)`,
      [
        taskId,
        template.id,
        template.template_artifact_id,
        template.sort_order ?? 1,
        resolvedStart,
        resolvedEnd ?? null,
        "pendiente"
      ]
    );
    inserted += 1;
  }

  return {
    inserted,
    total: templates.length
  };
};

export const ensureTaskItemsForTaskTargets = async (
  connection,
  taskId,
  processDefinitionId,
  executableTemplatesMap,
  targetPositions = [],
  startDate = null,
  endDate = null
) => {
  // Igual que en ensureTaskItemsForTask: solo `single` auto-genera entregable.
  const templates = (executableTemplatesMap.get(processDefinitionId) || [])
    .filter((template) => String(template.item_mode || "single") === "single");
  if (!templates.length) {
    return { inserted: 0, total: 0 };
  }

  const normalizedTargets = targetPositions
    .map((position) => ({
      unit_id: Number(position.unit_id || 0) || null,
      position_id: Number(position.position_id || 0) || null,
      person_id: Number(position.person_id || position.assigned_person_id || 0) || null
    }))
    .filter((position) => position.position_id || position.person_id);

  if (!normalizedTargets.length) {
    return await ensureTaskItemsForTask(
      connection,
      taskId,
      processDefinitionId,
      executableTemplatesMap,
      startDate,
      endDate
    );
  }

  let resolvedStart = startDate;
  let resolvedEnd = endDate;
  if (resolvedStart === null && resolvedEnd === null) {
    const [taskRows] = await connection.query(
      `SELECT start_date, end_date FROM tasks WHERE id = ? LIMIT 1`,
      [taskId]
    );
    resolvedStart = taskRows?.[0]?.start_date ?? null;
    resolvedEnd = taskRows?.[0]?.end_date ?? null;
  }

  const existingTargetKeys = await getExistingTaskItemTargetKeys(connection, taskId);
  let inserted = 0;

  for (const template of templates) {
    for (const target of normalizedTargets) {
      const key = [
        Number(template.id || 0),
        Number(target.position_id || 0),
        Number(target.person_id || 0)
      ].join(":");
      if (existingTargetKeys.has(key)) {
        continue;
      }

      await connection.query(
        `INSERT INTO task_items (
           task_id,
           process_definition_template_id,
           template_artifact_id,
           origin_kind,
           sort_order,
           target_unit_id,
           target_position_id,
           target_person_id,
           responsible_position_id,
           assigned_person_id,
           start_date,
           end_date,
           status
         ) VALUES (?, ?, ?, 'process_defined', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          template.id,
          template.template_artifact_id,
          template.sort_order ?? 1,
          target.unit_id,
          target.position_id,
          target.person_id,
          target.position_id,
          target.person_id,
          resolvedStart,
          resolvedEnd ?? null,
          "pendiente"
        ]
      );
      existingTargetKeys.add(key);
      inserted += 1;
    }
  }

  return {
    inserted,
    total: templates.length * normalizedTargets.length
  };
};

export const ensureTaskAssignmentsForDefinition = async (connection, taskId, processDefinitionId, targetRulesMap) => {
  const rules = targetRulesMap.get(processDefinitionId) || [];
  if (!rules.length) {
    return {
      created: 0,
      hasRules: false,
      hasAssignees: false,
      responsiblePositionId: null
    };
  }

  const positions = [];
  for (const rule of rules) {
    const matched = await getPositionsForRule(connection, rule);
    positions.push(...matched);
  }

  const [taskScopeRows] = await connection.query(
    `SELECT scope_unit_id
     FROM tasks
     WHERE id = ?
     LIMIT 1`,
    [taskId]
  );
  const scopeUnitId = Number(taskScopeRows?.[0]?.scope_unit_id || 0) || null;
  const scopedPositions = scopeUnitId
    ? positions.filter((position) => Number(position.unit_id || 0) === scopeUnitId)
    : positions;

  if (!scopedPositions.length) {
    return {
      created: 0,
      hasRules: true,
      hasAssignees: false,
      responsiblePositionId: null
    };
  }

  const values = scopedPositions.map((row) => [taskId, row.position_id, row.person_id ?? null]);
  const placeholders = values.map(() => "(?, ?, ?)").join(", ");
  const flatValues = values.flat();
  const [insertResult] = await connection.query(
    `INSERT IGNORE INTO task_assignments (task_id, position_id, assigned_person_id)
     VALUES ${placeholders}`,
    flatValues
  );

  const responsiblePositionId = scopedPositions[0]?.position_id || null;
  if (responsiblePositionId) {
    await connection.query(
      `UPDATE tasks
       SET responsible_position_id = COALESCE(responsible_position_id, ?)
       WHERE id = ?`,
      [responsiblePositionId, taskId]
    );
  }

  return {
    created: insertResult?.affectedRows || 0,
    hasRules: true,
    hasAssignees: true,
    responsiblePositionId
  };
};

export const ensureUnitTaskAssignments = async (connection, taskId, positions, responsiblePositionId) => {
  if (!positions.length) return 0;
  const values = positions.map((pos) => [taskId, pos.position_id, pos.person_id ?? null]);
  const placeholders = values.map(() => "(?, ?, ?)").join(", ");
  const [result] = await connection.query(
    `INSERT IGNORE INTO task_assignments (task_id, position_id, assigned_person_id) VALUES ${placeholders}`,
    values.flat()
  );
  if (responsiblePositionId) {
    await connection.query(
      `UPDATE tasks SET responsible_position_id = COALESCE(responsible_position_id, ?) WHERE id = ?`,
      [responsiblePositionId, taskId]
    );
  }
  return result?.affectedRows || 0;
};
