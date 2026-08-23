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
        end_date
      ) VALUES (?, ?, ?, 'process_defined', ?, ?, ?)`,
      [
        taskId,
        template.id,
        template.template_artifact_id,
        template.sort_order ?? 1,
        resolvedStart,
        resolvedEnd ?? null
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
      // Misma clave que la identidad del entregable y que el indice unico: plantilla + productor.
      const key = [
        Number(template.id || 0),
        Number(target.position_id || 0)
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
           responsible_position_id,
           assigned_person_id,
           start_date,
           end_date
         ) VALUES (?, ?, ?, 'process_defined', ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          template.id,
          template.template_artifact_id,
          template.sort_order ?? 1,
          target.unit_id,
          // El destinatario ya no se guarda: lo que identifica al entregable es QUIEN LO PRODUCE.
          target.position_id,
          target.person_id,
          resolvedStart,
          resolvedEnd ?? null
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

// Resuelve QUE PUESTOS produce esta definicion en esta tarea, aplicando sus reglas de reparto.
//
// ⚠️ ANTES ESTO ESCRIBIA `task_assignments` Y LUEGO SE RELEIA. La secuencia en `launch.js` era:
// escribir la tabla, volver a consultarla con `getTaskAssignmentTargets`, y alimentar con ESO la
// creacion de los entregables — o sea, una ida y vuelta a la base para recuperar lo que ya estaba
// en memoria. Y la copia que quedaba escrita no la refrescaba **ningun** camino de relevo, asi que
// desde el primer cambio de ocupante mentia: por ella, quien dejaba un puesto conservaba acceso al
// entregable para siempre (fuente `puesto_responsable_asignado` del motor de acceso).
//
// Ahora devuelve los puestos y ya esta. Quien responde de cada entregable vive en su tenencia
// (`task_item_tenures`), que si tiene un solo escritor y si sabe guardar una sucesion.
export const resolveTaskTargetsForDefinition = async (connection, taskId, processDefinitionId, targetRulesMap) => {
  const rules = targetRulesMap.get(processDefinitionId) || [];
  if (!rules.length) {
    return { targets: [], hasRules: false, hasAssignees: false };
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

  return {
    targets: scopedPositions,
    hasRules: true,
    hasAssignees: scopedPositions.length > 0,
  };
};
