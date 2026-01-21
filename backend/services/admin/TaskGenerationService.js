import { getMariaDBPool } from "../../config/mariadb.js";

const getActiveProcesses = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id, parent_id, unit_id
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
    `SELECT id, process_id, cargo_id
     FROM (
       SELECT
         id,
         process_id,
         cargo_id,
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
    map.set(row.process_id, { id: row.id, cargo_id: row.cargo_id });
  });
  return map;
};

const getExistingTasksMap = async (connection, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, pv.process_id, t.parent_task_id
     FROM tasks t
     JOIN process_versions pv ON pv.id = t.process_version_id
     WHERE t.term_id = ?`,
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

const getPositionsForProcess = async (connection, { unitId, cargoId }) => {
  const [rows] = await connection.query(
    `SELECT up.id AS position_id, pa.person_id
     FROM unit_positions up
     LEFT JOIN position_assignments pa
       ON pa.position_id = up.id
      AND pa.is_current = 1
     WHERE up.unit_id = ?
       AND up.cargo_id = ?
       AND up.is_active = 1`,
    [unitId, cargoId]
  );
  return rows;
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

      const versionEntry = versionMap.get(processId);
      if (!versionEntry) {
        tasksWithMissingVersion.push(processId);
        return null;
      }

      const [result] = await connection.query(
        `INSERT INTO tasks
         (process_version_id, term_id, parent_task_id, responsible_position_id, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          versionEntry.id,
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
    let assignmentsCreated = 0;
    const processesWithoutAssignees = [];

    for (const processId of processIds) {
      const task = existingTasksMap.get(processId);
      if (!task) {
        continue;
      }
      const process = processById.get(processId);
      const versionEntry = versionMap.get(processId);
      if (!process || !versionEntry) {
        continue;
      }
      const positions = await getPositionsForProcess(connection, {
        unitId: process.unit_id,
        cargoId: versionEntry.cargo_id
      });
      if (!positions.length) {
        processesWithoutAssignees.push(processId);
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
