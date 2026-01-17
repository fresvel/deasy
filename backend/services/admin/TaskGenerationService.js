import { getMariaDBPool } from "../../config/mariadb.js";

const getActiveProcesses = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id, parent_id, unit_id, program_id
     FROM processes
     WHERE is_active = 1`
  );
  return rows;
};

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

const getProcessVersionMap = async (connection, termStart, termEnd) => {
  const [rows] = await connection.query(
    `SELECT id, process_id
     FROM (
       SELECT
         id,
         process_id,
         ROW_NUMBER() OVER (
           PARTITION BY process_id
           ORDER BY effective_from DESC, id DESC
         ) AS rn
       FROM process_versions
       WHERE is_active = 1
         AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to >= ?)
     ) AS ranked
     WHERE rn = 1`,
    [termEnd, termStart]
  );
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.process_id, row.id);
  });
  return map;
};

const getExistingTasksMap = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT id, process_id, parent_task_id
     FROM tasks
     WHERE term_id = ?`,
    [termId]
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_id)) {
      map.set(row.process_id, { id: row.id, parent_task_id: row.parent_task_id });
    }
  });
  return map;
};

const getAssigneesByProcess = async (connection, processIds) => {
  if (!processIds.length) {
    return new Map();
  }
  const placeholders = processIds.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT DISTINCT pc.process_id, pca.person_id
     FROM process_cargos pc
     JOIN person_cargos pca
       ON pca.cargo_id = pc.cargo_id
      AND pca.is_current = 1
      AND (pc.unit_id IS NULL OR pca.unit_id = pc.unit_id)
      AND (pc.program_id IS NULL OR pca.program_id = pc.program_id)
     WHERE pc.process_id IN (${placeholders})`,
    processIds
  );
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_id)) {
      map.set(row.process_id, []);
    }
    map.get(row.process_id).push(row.person_id);
  });
  return map;
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

    const processes = await getActiveProcesses(connection);
    const processById = new Map(processes.map((process) => [process.id, process]));
    const versionMap = await getProcessVersionMap(connection, term.start_date, term.end_date);
    const existingTasksMap = await getExistingTasksMap(connection, term.id);
    const createdTaskIds = [];
    const tasksWithMissingVersion = [];
    const updatedParents = [];
    const processing = new Set();

    const ensureTask = async (processId) => {
      if (!processById.has(processId)) {
        return null;
      }
      if (processing.has(processId)) {
        return existingTasksMap.get(processId)?.id || null;
      }
      processing.add(processId);

      const process = processById.get(processId);
      let parentTaskId = null;
      if (process.parent_id) {
        parentTaskId = await ensureTask(process.parent_id);
      }

      const existing = existingTasksMap.get(processId);
      if (existing) {
        if (parentTaskId && existing.parent_task_id !== parentTaskId) {
          await connection.query(
            "UPDATE tasks SET parent_task_id = ? WHERE id = ?",
            [parentTaskId, existing.id]
          );
          existing.parent_task_id = parentTaskId;
          updatedParents.push(existing.id);
        }
        return existing.id;
      }

      const processVersionId = versionMap.get(processId);
      if (!processVersionId) {
        tasksWithMissingVersion.push(processId);
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO tasks
         (process_id, process_version_id, term_id, parent_task_id, responsible_person_id, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          processId,
          processVersionId,
          term.id,
          parentTaskId,
          null,
          term.start_date,
          term.end_date,
          "pendiente"
        ]
      );
      const insertedId = result.insertId;
      existingTasksMap.set(processId, { id: insertedId, parent_task_id: parentTaskId });
      createdTaskIds.push(insertedId);
      return insertedId;
    };

    for (const process of processes) {
      await ensureTask(process.id);
    }

    const processIds = Array.from(existingTasksMap.keys());
    const assigneesByProcess = await getAssigneesByProcess(connection, processIds);
    let assignmentsCreated = 0;
    const processesWithoutAssignees = [];

    for (const processId of processIds) {
      const task = existingTasksMap.get(processId);
      if (!task) {
        continue;
      }
      const personIds = assigneesByProcess.get(processId) || [];
      if (!personIds.length) {
        processesWithoutAssignees.push(processId);
        continue;
      }
      const values = personIds.map((personId) => [task.id, personId]);
      const placeholders = values.map(() => "(?, ?)").join(", ");
      const flatValues = values.flat();
      const [result] = await connection.query(
        `INSERT IGNORE INTO task_assignments (task_id, person_id)
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
      tasks_with_missing_version: tasksWithMissingVersion,
      tasks_parent_updated: updatedParents,
      processes_without_assignees: processesWithoutAssignees
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
