import { getMariaDBPool } from "../../config/mariadb.js";

const getTermById = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT id, start_date, end_date
     FROM terms
     WHERE id = ?
     LIMIT 1`,
    [termId]
  );
  return rows[0] || null;
};

const getActiveDefinitions = async (connection, termStart, termEnd) => {
  const [rows] = await connection.query(
    `SELECT id, process_id, variation_key, definition_version
     FROM (
       SELECT
         id,
         process_id,
         variation_key,
         definition_version,
         ROW_NUMBER() OVER (
           PARTITION BY process_id, variation_key
           ORDER BY effective_from DESC, id DESC
         ) AS rn
       FROM process_definition_versions
       WHERE status = 'active'
         AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to >= ?)
     ) AS ranked
     WHERE rn = 1
     ORDER BY process_id ASC, variation_key ASC`,
    [termEnd, termStart]
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

const getExistingTasksMap = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, t.process_definition_template_id, t.process_definition_id, t.parent_task_id
     FROM tasks t
     WHERE t.term_id = ?`,
    [termId]
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_template_id)) {
      map.set(row.process_definition_template_id, {
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

    const activeDefinitions = await getActiveDefinitions(connection, term.start_date, term.end_date);
    const definitionById = new Map(activeDefinitions.map((definition) => [definition.id, definition]));
    const targetRulesMap = await getTargetRulesMap(connection, term.start_date, term.end_date);
    const executableTemplatesMap = await getExecutableTemplatesMap(connection);
    const existingTasksMap = await getExistingTasksMap(connection, term.id);
    const createdTaskIds = [];
    const definitionsWithoutTaskTemplates = [];
    const processing = new Set();

    const ensureTask = async (definition, template) => {
      if (!definition || !template) {
        return null;
      }
      if (processing.has(template.id)) {
        return existingTasksMap.get(template.id)?.id || null;
      }
      processing.add(template.id);

      const existing = existingTasksMap.get(template.id);
      if (existing) {
        return existing.id;
      }

      const [result] = await connection.query(
        `INSERT INTO tasks
         (
           process_definition_template_id,
           process_definition_id,
           term_id,
           parent_task_id,
           responsible_position_id,
           start_date,
           end_date,
           status
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          template.id,
          definition.id,
          term.id,
          null,
          null,
          term.start_date,
          term.end_date,
          "pendiente"
        ]
      );
      const insertedId = result.insertId;
      existingTasksMap.set(template.id, {
        id: insertedId,
        parent_task_id: null,
        process_definition_id: definition.id
      });
      createdTaskIds.push(insertedId);
      return insertedId;
    };

    for (const definition of activeDefinitions) {
      const templates = executableTemplatesMap.get(definition.id) || [];
      if (!templates.length) {
        definitionsWithoutTaskTemplates.push(definition.id);
        continue;
      }
      for (const template of templates) {
        await ensureTask(definition, template);
      }
    }

    let assignmentsCreated = 0;
    const definitionsWithoutTargetRules = [];
    const definitionsWithoutAssignees = [];

    for (const task of existingTasksMap.values()) {
      if (!task) {
        continue;
      }
      const definitionEntry = definitionById.get(task.process_definition_id);
      if (!definitionEntry) {
        continue;
      }
      const rules = targetRulesMap.get(definitionEntry.id) || [];
      if (!rules.length) {
        definitionsWithoutTargetRules.push(definitionEntry.id);
        continue;
      }
      const positions = [];
      for (const rule of rules) {
        const matched = await getPositionsForRule(connection, rule);
        positions.push(...matched);
      }
      if (!positions.length) {
        definitionsWithoutAssignees.push(definitionEntry.id);
        continue;
      }
      const values = positions.map((row) => [task.id, row.position_id, row.person_id ?? null]);
      const placeholders = values.map(() => "(?, ?, ?)").join(", ");
      const flatValues = values.flat();
      const [result] = await connection.query(
        `INSERT IGNORE INTO task_assignments (task_id, position_id, assigned_person_id)
         VALUES ${placeholders}`,
        flatValues
      );
      assignmentsCreated += result.affectedRows || 0;
    }

    await connection.commit();

    return {
      term_id: term.id,
      tasks_created: createdTaskIds.length,
      tasks_existing: existingTasksMap.size,
      assignments_created: assignmentsCreated,
      definitions_without_task_templates: definitionsWithoutTaskTemplates,
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
    const [taskRows] = await connection.query(
      `SELECT id, parent_task_id, term_id
       FROM tasks
       WHERE id = ?
       LIMIT 1`,
      [currentTaskId]
    );
    if (!taskRows.length) {
      break;
    }
    const parentId = taskRows[0].parent_task_id;
    if (!parentId) {
      break;
    }

    const termId = taskRows[0].term_id;
    const [childRows] = await connection.query(
      `SELECT status, COUNT(*) AS count
       FROM tasks
       WHERE parent_task_id = ? AND term_id = ?
       GROUP BY status`,
      [parentId, termId]
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
