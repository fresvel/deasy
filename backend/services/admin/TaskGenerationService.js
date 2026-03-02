import { getMariaDBPool } from "../../config/mariadb.js";

const getTermById = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT id, term_type_id, start_date, end_date
     FROM terms
     WHERE id = ?
     LIMIT 1`,
    [termId]
  );
  return rows[0] || null;
};

const getActiveAutomaticDefinitions = async (connection, term) => {
  const [rows] = await connection.query(
    `SELECT ranked.id, ranked.process_id, ranked.variation_key, ranked.definition_version
     FROM (
       SELECT
         pdv.id,
         pdv.process_id,
         pdv.variation_key,
         pdv.definition_version,
         ROW_NUMBER() OVER (
           PARTITION BY pdv.process_id, pdv.variation_key
           ORDER BY pdv.effective_from DESC, pdv.id DESC
         ) AS rn
       FROM process_definition_versions pdv
       WHERE pdv.status = 'active'
         AND pdv.effective_from <= ?
         AND (pdv.effective_to IS NULL OR pdv.effective_to >= ?)
     ) AS ranked
     INNER JOIN process_definition_triggers pdt
       ON pdt.process_definition_id = ranked.id
      AND pdt.is_active = 1
      AND pdt.trigger_mode = 'automatic_by_term_type'
      AND pdt.term_type_id = ?
     WHERE ranked.rn = 1
     ORDER BY ranked.process_id ASC, ranked.variation_key ASC`,
    [term.end_date, term.start_date, term.term_type_id]
  );
  return rows;
};

const getTargetRulesMap = async (connection, termStart, termEnd) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       process_definition_id,
       unit_scope_type,
       unit_id,
       unit_type_id,
       include_descendants,
       cargo_id,
       position_id,
       recipient_policy,
       priority
     FROM process_target_rules
     WHERE is_active = 1
       AND (effective_from IS NULL OR effective_from <= ?)
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY process_definition_id, priority ASC, id ASC`,
    [termEnd, termStart]
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, []);
    }
    map.get(row.process_definition_id).push(row);
  });
  return map;
};

const getExecutableTemplatesMap = async (connection) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       process_definition_id,
       template_artifact_id,
       usage_role,
       sort_order
     FROM process_definition_templates
     WHERE creates_task = 1
     ORDER BY process_definition_id ASC, sort_order ASC, id ASC`
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, []);
    }
    map.get(row.process_definition_id).push(row);
  });
  return map;
};

const getExistingAutomaticTasksMap = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT id, process_definition_id, parent_task_id
     FROM tasks
     WHERE term_id = ?
       AND launch_mode = 'automatic'`,
    [termId]
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, {
        id: row.id,
        parent_task_id: row.parent_task_id,
        process_definition_id: row.process_definition_id
      });
    }
  });
  return map;
};

const applyRecipientPolicy = (rows, recipientPolicy, exactPositionId = null) => {
  if (!rows.length) {
    return [];
  }
  if (recipientPolicy === "exact_position" || exactPositionId) {
    return rows.slice(0, 1);
  }
  if (recipientPolicy === "one_match_only") {
    return rows.slice(0, 1);
  }
  if (recipientPolicy === "one_per_unit") {
    const seen = new Set();
    return rows.filter((row) => {
      if (seen.has(row.unit_id)) {
        return false;
      }
      seen.add(row.unit_id);
      return true;
    });
  }
  return rows;
};

const getPositionsForRule = async (connection, rule) => {
  const useExactPosition = rule.position_id || rule.recipient_policy === "exact_position";
  if (useExactPosition && !rule.position_id) {
    return [];
  }

  const params = [];
  let query = `
    SELECT DISTINCT
      up.id AS position_id,
      up.unit_id,
      pa.person_id,
      up.slot_no
    FROM unit_positions up
    INNER JOIN units u ON u.id = up.unit_id
    LEFT JOIN position_assignments pa
      ON pa.position_id = up.id
     AND pa.is_current = 1
    WHERE up.is_active = 1
      AND u.is_active = 1`;

  if (useExactPosition) {
    query += "\n      AND up.id = ?";
    params.push(rule.position_id);
  } else {
    if (rule.cargo_id) {
      query += "\n      AND up.cargo_id = ?";
      params.push(rule.cargo_id);
    }

    const useSubtree = rule.unit_scope_type === "unit_subtree"
      || (rule.unit_scope_type === "unit_exact" && Number(rule.include_descendants) === 1);

    if (useSubtree) {
      if (!rule.unit_id) {
        return [];
      }
      query = `
        WITH RECURSIVE scoped_units AS (
          SELECT id
          FROM units
          WHERE id = ?
          UNION ALL
          SELECT ur.child_unit_id
          FROM unit_relations ur
          INNER JOIN relation_unit_types rt
            ON rt.id = ur.relation_type_id
           AND rt.code = 'org'
          INNER JOIN scoped_units su ON su.id = ur.parent_unit_id
        )
        ${query}
          AND up.unit_id IN (SELECT id FROM scoped_units)`;
      params.unshift(rule.unit_id);
    } else if (rule.unit_scope_type === "unit_exact") {
      if (!rule.unit_id) {
        return [];
      }
      query += "\n      AND up.unit_id = ?";
      params.push(rule.unit_id);
    } else if (rule.unit_scope_type === "unit_type") {
      if (!rule.unit_type_id) {
        return [];
      }
      query += "\n      AND u.unit_type_id = ?";
      params.push(rule.unit_type_id);
    }
  }

  query += "\n    ORDER BY up.unit_id ASC, up.slot_no ASC, up.id ASC";
  const [rows] = await connection.query(query, params);
  return applyRecipientPolicy(rows, rule.recipient_policy, rule.position_id);
};

const getTaskById = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT id, process_definition_id, term_id
     FROM tasks
     WHERE id = ?
     LIMIT 1`,
    [taskId]
  );
  return rows[0] || null;
};

const getExistingTaskItemTemplateIds = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT process_definition_template_id
     FROM task_items
     WHERE task_id = ?`,
    [taskId]
  );
  return new Set(rows.map((row) => Number(row.process_definition_template_id)));
};

const ensureTaskItemsForTask = async (connection, taskId, processDefinitionId, executableTemplatesMap) => {
  const templates = executableTemplatesMap.get(processDefinitionId) || [];
  if (!templates.length) {
    return { inserted: 0, total: 0 };
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
        template_usage_role,
        sort_order,
        status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        template.id,
        template.template_artifact_id,
        template.usage_role || "manual_fill",
        template.sort_order ?? 1,
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

const ensureTaskAssignmentsForDefinition = async (connection, taskId, processDefinitionId, targetRulesMap) => {
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

  if (!positions.length) {
    return {
      created: 0,
      hasRules: true,
      hasAssignees: false,
      responsiblePositionId: null
    };
  }

  const values = positions.map((row) => [taskId, row.position_id, row.person_id ?? null]);
  const placeholders = values.map(() => "(?, ?, ?)").join(", ");
  const flatValues = values.flat();
  const [insertResult] = await connection.query(
    `INSERT IGNORE INTO task_assignments (task_id, position_id, assigned_person_id)
     VALUES ${placeholders}`,
    flatValues
  );

  const responsiblePositionId = positions[0]?.position_id || null;
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

export const hydrateTaskFromDefinition = async ({
  connection,
  taskId,
  processDefinitionId,
  termId,
  executableTemplatesMap = null,
  targetRulesMap = null
}) => {
  const term = await getTermById(connection, termId);
  if (!term) {
    throw new Error("Periodo no encontrado.");
  }

  const templatesMap = executableTemplatesMap || await getExecutableTemplatesMap(connection);
  const rulesMap = targetRulesMap || await getTargetRulesMap(connection, term.start_date, term.end_date);

  const taskItems = await ensureTaskItemsForTask(connection, taskId, processDefinitionId, templatesMap);
  const assignments = await ensureTaskAssignmentsForDefinition(connection, taskId, processDefinitionId, rulesMap);

  return {
    task_items_inserted: taskItems.inserted,
    task_items_total: taskItems.total,
    assignments_created: assignments.created,
    has_rules: assignments.hasRules,
    has_assignees: assignments.hasAssignees,
    responsible_position_id: assignments.responsiblePositionId
  };
};

export const generateTasksForTerm = async (termId) => {
  const pool = getMariaDBPool();
  if (!pool) {
    throw new Error("La conexion con MariaDB no esta disponible.");
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const term = await getTermById(connection, termId);
    if (!term) {
      throw new Error("Periodo no encontrado.");
    }

    const activeDefinitions = await getActiveAutomaticDefinitions(connection, term);
    const targetRulesMap = await getTargetRulesMap(connection, term.start_date, term.end_date);
    const executableTemplatesMap = await getExecutableTemplatesMap(connection);
    const existingTasksMap = await getExistingAutomaticTasksMap(connection, term.id);

    const createdTaskIds = [];
    let taskItemsCreated = 0;
    let assignmentsCreated = 0;
    const definitionsWithoutTaskItems = [];
    const definitionsWithoutTargetRules = [];
    const definitionsWithoutAssignees = [];

    for (const definition of activeDefinitions) {
      let task = existingTasksMap.get(definition.id) || null;
      if (!task) {
        const [result] = await connection.query(
          `INSERT INTO tasks
           (
             process_definition_id,
             term_id,
             launch_mode,
             parent_task_id,
             responsible_position_id,
             start_date,
             end_date,
             status
          )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            definition.id,
            term.id,
            "automatic",
            null,
            null,
            term.start_date,
            term.end_date,
            "pendiente"
          ]
        );
        task = {
          id: result.insertId,
          parent_task_id: null,
          process_definition_id: definition.id
        };
        existingTasksMap.set(definition.id, task);
        createdTaskIds.push(task.id);
      }

      const hydrated = await hydrateTaskFromDefinition({
        connection,
        taskId: task.id,
        processDefinitionId: definition.id,
        termId: term.id,
        executableTemplatesMap,
        targetRulesMap
      });

      taskItemsCreated += hydrated.task_items_inserted;
      assignmentsCreated += hydrated.assignments_created;

      if (hydrated.task_items_total < 1) {
        definitionsWithoutTaskItems.push(definition.id);
      }
      if (!hydrated.has_rules) {
        definitionsWithoutTargetRules.push(definition.id);
      } else if (!hydrated.has_assignees) {
        definitionsWithoutAssignees.push(definition.id);
      }
    }

    await connection.commit();

    return {
      term_id: term.id,
      tasks_created: createdTaskIds.length,
      tasks_existing: existingTasksMap.size,
      task_items_created: taskItemsCreated,
      assignments_created: assignmentsCreated,
      definitions_without_task_items: definitionsWithoutTaskItems,
      definitions_without_target_rules: definitionsWithoutTargetRules,
      definitions_without_assignees: definitionsWithoutAssignees
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateParentTaskStatusForTask = async (taskId, externalConnection = null) => {
  const pool = getMariaDBPool();
  if (!pool) {
    throw new Error("La conexion con MariaDB no esta disponible.");
  }
  const connection = externalConnection || pool;
  let currentTaskId = taskId;

  while (currentTaskId) {
    const task = await getTaskById(connection, currentTaskId);
    if (!task) {
      break;
    }
    const parentId = task.parent_task_id;
    if (!parentId) {
      break;
    }

    const [childRows] = await connection.query(
      `SELECT status, COUNT(*) AS count
       FROM tasks
       WHERE parent_task_id = ? AND term_id = ?
       GROUP BY status`,
      [parentId, task.term_id]
    );

    if (!childRows.length) {
      currentTaskId = parentId;
      continue;
    }

    const statusCounts = new Map();
    let total = 0;
    childRows.forEach((row) => {
      statusCounts.set(row.status, Number(row.count));
      total += Number(row.count);
    });

    let nextStatus = "pendiente";
    if ((statusCounts.get("en_proceso") || 0) > 0) {
      nextStatus = "en_proceso";
    } else if ((statusCounts.get("pendiente") || 0) > 0) {
      nextStatus = "pendiente";
    } else if ((statusCounts.get("completada") || 0) === total) {
      nextStatus = "completada";
    } else if ((statusCounts.get("cancelada") || 0) === total) {
      nextStatus = "cancelada";
    } else {
      nextStatus = "en_proceso";
    }

    await connection.query(
      "UPDATE tasks SET status = ? WHERE id = ? AND status <> ?",
      [nextStatus, parentId, nextStatus]
    );

    currentTaskId = parentId;
  }
};
