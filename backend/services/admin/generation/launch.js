// LANZAMIENTO de procesos: crear la corrida (process_run), hidratar las tareas de una
// definición en un periodo y exponer el estado de lanzamiento.
// Extraído de TaskGenerationService en la Fase 3. Ver docs/auditoria-refactor-2026-07.md
//
// OJO (bug histórico, ver commit a53a6de): `ensureProcessRun` compara `term_id <=> ?`
// (igualdad NULL-safe de MySQL, porque term_id es nullable). PostgreSQL NO tiene <=>;
// lo traduce config/postgres.js. Sin esa traducción, lanzar un proceso devuelve 400
// ("operator does not exist: integer <=> unknown") y la función queda MUERTA.
import { getPostgresPool } from "../../../config/postgres.js";
import { notFound } from "../../../errors/HttpError.js";
import {
  getTermById,
  getActiveAutomaticDefinitions,
  getTargetRulesMap,
  getExecutableTemplatesMap,
  getExistingAutomaticTasksMap,
  getExistingTasksByUnitForDefinition,
  getActiveRunForDefinitionTerm,
  getPositionsForRule,
  getTaskAssignmentTargets
} from "./queries.js";
import {
  ensureTaskItemsForTask,
  ensureTaskItemsForTaskTargets,
  ensureTaskAssignmentsForDefinition,
  ensureUnitTaskAssignments
} from "./taskitems.js";
// Dependencia unidireccional: el lanzamiento materializa los documentos de la tarea.
import { ensureDocumentsForTask } from "./documents.js";

export const ensureProcessRun = async ({
  connection,
  processDefinitionId,
  termId = null,
  runMode = "manual",
  createdByUserId = null,
  sourceRunId = null,
  reason = null,
  status = "active"
}) => {
  const normalizedProcessDefinitionId = Number(processDefinitionId);
  const normalizedTermId = termId === null || termId === undefined || termId === "" ? null : Number(termId);
  const normalizedCreatedBy = createdByUserId === null || createdByUserId === undefined || createdByUserId === ""
    ? null
    : Number(createdByUserId);
  const normalizedSourceRunId = sourceRunId === null || sourceRunId === undefined || sourceRunId === ""
    ? null
    : Number(sourceRunId);

  // Primer lanzamiento / auto-disparo: reusa la corrida ACTIVA de (proceso, periodo) si ya existe
  // (idempotente; evita doble disparo). El relanzamiento es una corrida nueva y NO pasa por aquí
  // (lo maneja la lógica de lanzamiento explícito en Fase 2). Por eso no se deduplica por usuario
  // ni por run_mode: a lo sumo hay una corrida activa por (proceso, periodo).
  const [existingRows] = await connection.query(
    `SELECT id
     FROM process_runs
     WHERE process_definition_id = ?
       AND term_id <=> ?
       AND status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
    [normalizedProcessDefinitionId, normalizedTermId]
  );
  if (existingRows?.length) {
    return Number(existingRows[0].id);
  }

  const [insertResult] = await connection.query(
    `INSERT INTO process_runs (
       process_definition_id,
       term_id,
       run_mode,
       source_run_id,
       created_by_user_id,
       reason,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedProcessDefinitionId,
      normalizedTermId,
      runMode,
      normalizedSourceRunId,
      normalizedCreatedBy,
      reason,
      status
    ]
  );

  return Number(insertResult.insertId);
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
    throw notFound("Periodo no encontrado.");
  }

  const templatesMap = executableTemplatesMap || await getExecutableTemplatesMap(connection);
  const rulesMap = targetRulesMap || await getTargetRulesMap(connection, term.start_date, term.end_date);

  const assignments = await ensureTaskAssignmentsForDefinition(connection, taskId, processDefinitionId, rulesMap);
  const targets = await getTaskAssignmentTargets(connection, taskId);
  const taskItems = await ensureTaskItemsForTaskTargets(
    connection,
    taskId,
    processDefinitionId,
    templatesMap,
    targets
  );
  await ensureDocumentsForTask(connection, taskId);

  return {
    task_items_inserted: taskItems.inserted,
    task_items_total: taskItems.total,
    assignments_created: assignments.created,
    has_rules: assignments.hasRules,
    has_assignees: assignments.hasAssignees,
    responsible_position_id: assignments.responsiblePositionId
  };
};
export const hydrateGeneralTask = async ({
  connection,
  taskId,
  processDefinitionId,
  responsiblePositionId,
  startDate = null,
  endDate = null,
}) => {
  const templatesMap = await getExecutableTemplatesMap(connection);
  const taskItems = await ensureTaskItemsForTask(
    connection, taskId, processDefinitionId, templatesMap, startDate, endDate
  );
  let assignmentsCreated = 0;
  if (responsiblePositionId) {
    assignmentsCreated = await ensureUnitTaskAssignments(
      connection,
      taskId,
      [{ position_id: responsiblePositionId, person_id: null }],
      responsiblePositionId
    );
  }
  await ensureDocumentsForTask(connection, taskId);
  return {
    task_items_inserted: taskItems.inserted,
    task_items_total: taskItems.total,
    assignments_created: assignmentsCreated,
  };
};
export const launchDefinitionInTerm = async (connection, {
  definition,
  term,
  executableTemplatesMap = null,
  targetRulesMap = null,
  existingByUnit = null,
  runMode = "manual",
  relaunch = false,
  createdByUserId = null,
  reason = null
}) => {
  const empty = {
    tasks_created: 0,
    task_items_created: 0,
    assignments_created: 0,
    process_run_id: null,
    relaunched: false
  };

  const templatesMap = executableTemplatesMap || await getExecutableTemplatesMap(connection);
  const definitionTemplates = templatesMap.get(definition.id) || [];
  if (!definitionTemplates.length) {
    return { ...empty, status: "no_task_items" };
  }

  const rulesMap = targetRulesMap || await getTargetRulesMap(connection, term.start_date, term.end_date);
  const rules = rulesMap.get(definition.id) || [];
  if (!rules.length) {
    return { ...empty, status: "no_target_rules" };
  }

  // Posiciones objetivo (deduplicadas por position_id), agrupadas por unidad.
  const allPositions = [];
  const seenPositionIds = new Set();
  for (const rule of rules) {
    const matched = await getPositionsForRule(connection, rule);
    for (const pos of matched) {
      if (!seenPositionIds.has(pos.position_id)) {
        seenPositionIds.add(pos.position_id);
        allPositions.push(pos);
      }
    }
  }
  if (!allPositions.length) {
    return { ...empty, status: "no_assignees" };
  }

  const byUnit = new Map();
  allPositions.forEach((pos) => {
    if (!byUnit.has(pos.unit_id)) byUnit.set(pos.unit_id, []);
    byUnit.get(pos.unit_id).push(pos);
  });

  // --- gestión de la corrida ---
  let processRunId;
  let relaunched = false;
  const activeRun = await getActiveRunForDefinitionTerm(connection, definition.id, term.id);
  if (relaunch && activeRun) {
    await connection.query("UPDATE process_runs SET status = 'completed' WHERE id = ?", [activeRun.id]);
    const [ins] = await connection.query(
      `INSERT INTO process_runs
        (process_definition_id, term_id, run_mode, source_run_id, created_by_user_id, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [definition.id, term.id, runMode, activeRun.id, createdByUserId, reason]
    );
    processRunId = Number(ins.insertId);
    relaunched = true;
    // Opción X: conserva las tasks existentes y las repunta a la nueva corrida.
    await connection.query(
      "UPDATE tasks SET process_run_id = ? WHERE process_definition_id = ? AND term_id = ?",
      [processRunId, definition.id, term.id]
    );
  } else {
    processRunId = await ensureProcessRun({
      connection,
      processDefinitionId: definition.id,
      termId: term.id,
      runMode,
      createdByUserId,
      status: "active"
    });
  }

  const existing = existingByUnit || await getExistingTasksByUnitForDefinition(connection, definition.id, term.id);

  let tasksCreated = 0;
  let taskItemsCreated = 0;
  let assignmentsCreated = 0;

  for (const [unitId, unitPositions] of byUnit) {
    const responsiblePositionId = unitPositions[0].position_id;

    let task = existing.get(unitId) || null;
    if (!task) {
      const [result] = await connection.query(
        `INSERT INTO tasks
         (process_definition_id, process_run_id, term_id, scope_unit_id,
          responsible_position_id, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
        [definition.id, processRunId, term.id, unitId, responsiblePositionId,
         term.start_date, term.end_date]
      );
      task = { id: result.insertId, process_run_id: processRunId };
      existing.set(unitId, task);
      tasksCreated += 1;
    } else if (task.process_run_id !== processRunId) {
      await connection.query("UPDATE tasks SET process_run_id = ? WHERE id = ?", [processRunId, task.id]);
      task.process_run_id = processRunId;
    }

    const items = await ensureTaskItemsForTaskTargets(
      connection,
      task.id,
      definition.id,
      templatesMap,
      unitPositions,
      term.start_date,
      term.end_date
    );
    taskItemsCreated += items.inserted;

    assignmentsCreated += await ensureUnitTaskAssignments(
      connection, task.id, unitPositions, responsiblePositionId
    );

    await ensureDocumentsForTask(connection, task.id);
  }

  return {
    status: "ok",
    relaunched,
    process_run_id: processRunId,
    tasks_created: tasksCreated,
    task_items_created: taskItemsCreated,
    assignments_created: assignmentsCreated
  };
};
export const generateTasksForTerm = async (termId) => {
  const pool = getPostgresPool();
  if (!pool) throw new Error("La conexion con PostgreSQL no esta disponible.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const term = await getTermById(connection, termId);
    if (!term) throw notFound("Periodo no encontrado.");

    const activeDefinitions = await getActiveAutomaticDefinitions(connection, term);
    const targetRulesMap = await getTargetRulesMap(connection, term.start_date, term.end_date);
    // artifact_origin deprecado: la generación automática toma todas las plantillas vinculadas a la
    // configuración (toda plantilla materializa un entregable), sin filtrar por process/general.
    const executableTemplatesMap = await getExecutableTemplatesMap(connection);
    const existingTasksMap = await getExistingAutomaticTasksMap(connection, term.id);

    let tasksCreated = 0;
    let taskItemsCreated = 0;
    let assignmentsCreated = 0;
    const definitionsWithoutTaskItems = [];
    const definitionsWithoutTargetRules = [];
    const definitionsWithoutAssignees = [];

    for (const definition of activeDefinitions) {
      const result = await launchDefinitionInTerm(connection, {
        definition,
        term,
        executableTemplatesMap,
        targetRulesMap,
        existingByUnit: existingTasksMap.get(definition.id) || new Map(),
        runMode: "automatic",
        relaunch: false
      });
      tasksCreated += result.tasks_created;
      taskItemsCreated += result.task_items_created;
      assignmentsCreated += result.assignments_created;
      if (result.status === "no_task_items") definitionsWithoutTaskItems.push(definition.id);
      else if (result.status === "no_target_rules") definitionsWithoutTargetRules.push(definition.id);
      else if (result.status === "no_assignees") definitionsWithoutAssignees.push(definition.id);
    }

    await connection.commit();

    return {
      term_id: term.id,
      tasks_created: tasksCreated,
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
export const launchProcessDefinitionInTerm = async (definitionId, termId, {
  createdByUserId = null,
  relaunch = false,
  reason = null
} = {}) => {
  const pool = getPostgresPool();
  if (!pool) throw new Error("La conexion con PostgreSQL no esta disponible.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const term = await getTermById(connection, termId);
    if (!term) throw notFound("Periodo no encontrado.");

    const [defRows] = await connection.query(
      `SELECT pdv.id, pdv.status
       FROM process_definition_versions pdv
       WHERE pdv.id = ?
       LIMIT 1`,
      [definitionId]
    );
    const definition = defRows?.[0];
    if (!definition) throw notFound("La configuracion de proceso no existe.");
    if (String(definition.status || "") !== "active") {
      throw new Error("Solo se pueden lanzar configuraciones activas.");
    }

    // La configuración debe correr en el tipo de periodo del term elegido.
    const [periodTypeRows] = await connection.query(
      `SELECT id FROM process_definition_period_types
       WHERE process_definition_id = ? AND term_type_id = ? AND is_active = 1
       LIMIT 1`,
      [definitionId, term.term_type_id]
    );
    if (!periodTypeRows?.length) {
      throw new Error("La configuracion no corre en el tipo de periodo seleccionado (revisa Periodos del proceso).");
    }

    const result = await launchDefinitionInTerm(connection, {
      definition,
      term,
      runMode: "manual",
      relaunch,
      createdByUserId,
      reason
    });

    await connection.commit();
    return { term_id: term.id, definition_id: Number(definitionId), ...result };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
export const getTermLaunchStatus = async (termId) => {
  const pool = getPostgresPool();
  if (!pool) throw new Error("La conexion con PostgreSQL no esta disponible.");

  const connection = await pool.getConnection();
  try {
    const term = await getTermById(connection, termId);
    if (!term) throw notFound("Periodo no encontrado.");

    const [defs] = await connection.query(
      `SELECT pdv.id, pdv.name
       FROM process_definition_versions pdv
       INNER JOIN process_definition_period_types pdp
         ON pdp.process_definition_id = pdv.id
        AND pdp.is_active = 1
        AND pdp.term_type_id = ?
       WHERE pdv.status = 'active'
       GROUP BY pdv.id, pdv.name
       ORDER BY pdv.name ASC`,
      [term.term_type_id]
    );

    const [runs] = await connection.query(
      `SELECT process_definition_id,
              COUNT(*) AS run_count,
              MAX(CASE WHEN status = 'active' THEN id END) AS active_run_id
       FROM process_runs
       WHERE term_id = ?
       GROUP BY process_definition_id`,
      [term.id]
    );
    const runMap = new Map(runs.map((r) => [r.process_definition_id, r]));

    const definitions = defs.map((d) => {
      const r = runMap.get(d.id);
      const runCount = Number(r?.run_count || 0);
      return {
        definition_id: d.id,
        name: d.name,
        launched: runCount > 0,
        relaunched: runCount > 1,
        run_count: runCount,
        active_run_id: r?.active_run_id || null
      };
    });

    return {
      term_id: term.id,
      term_type_id: term.term_type_id,
      definitions,
      pending: definitions.filter((d) => !d.launched).map((d) => d.definition_id)
    };
  } finally {
    connection.release();
  }
};
export const getDefinitionLaunchInfo = async (definitionId) => {
  const pool = getPostgresPool();
  if (!pool) throw new Error("La conexion con PostgreSQL no esta disponible.");

  const connection = await pool.getConnection();
  try {
    const [[definition]] = await connection.query(
      "SELECT id, name, status FROM process_definition_versions WHERE id = ? LIMIT 1",
      [definitionId]
    );
    if (!definition) throw notFound("La configuracion de proceso no existe.");

    const [periodTypes] = await connection.query(
      `SELECT pdp.term_type_id, tt.code AS term_type_code, tt.name AS term_type_name
       FROM process_definition_period_types pdp
       INNER JOIN term_types tt ON tt.id = pdp.term_type_id
       WHERE pdp.process_definition_id = ? AND pdp.is_active = 1
       ORDER BY tt.code ASC`,
      [definitionId]
    );
    const typeIds = periodTypes.map((p) => p.term_type_id);

    // Corridas de la configuración (historial), con periodo.
    const [runs] = await connection.query(
      `SELECT pr.id, pr.term_id, t.name AS term_name, pr.run_mode, pr.status,
              pr.source_run_id, pr.reason, pr.created_at
       FROM process_runs pr
       LEFT JOIN terms t ON t.id = pr.term_id
       WHERE pr.process_definition_id = ?
       ORDER BY pr.id DESC`,
      [definitionId]
    );
    const activeTermIds = new Set(
      runs.filter((r) => r.status === "active" && r.term_id != null).map((r) => Number(r.term_id))
    );

    // Periodos disponibles de los tipos en que corre la configuración.
    let terms = [];
    if (typeIds.length) {
      const placeholders = typeIds.map(() => "?").join(",");
      const [termRows] = await connection.query(
        `SELECT t.id, t.name, t.term_type_id, t.start_date, t.end_date
         FROM terms t
         WHERE t.term_type_id IN (${placeholders}) AND t.is_active = 1
         ORDER BY t.start_date DESC, t.id DESC`,
        typeIds
      );
      terms = termRows.map((t) => ({ ...t, launched: activeTermIds.has(Number(t.id)) }));
    }

    return { definition, period_types: periodTypes, terms, runs };
  } finally {
    connection.release();
  }
};
