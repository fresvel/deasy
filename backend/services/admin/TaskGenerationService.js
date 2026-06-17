import { getMariaDBPool } from "../../config/mariadb.js";
import {
  transitionDocumentState,
  transitionDocumentVersionState,
} from "../documents/DocumentStateService.js";
import { SIGNATURE_REQUEST_STATUS } from "../documents/DocumentWorkflowCatalog.js";
import { ensureSignatureFlowForDocumentVersion as ensureDocumentSignatureWorkflowForDocumentVersion } from "../documents/DocumentSignatureWorkflowService.js";

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
     INNER JOIN process_definition_period_types pdp
       ON pdp.process_definition_id = ranked.id
      AND pdp.is_active = 1
      AND pdp.term_type_id = ?
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
       pdt.id,
       pdt.process_definition_id,
       pdt.template_artifact_id,
       pdt.sort_order
     FROM process_definition_templates pdt
     WHERE pdt.creates_task = 1
     ORDER BY pdt.process_definition_id ASC, pdt.sort_order ASC, pdt.id ASC`
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
    `SELECT t.id, t.process_definition_id, t.process_run_id,
            COALESCE(t.scope_unit_id, up.unit_id) AS responsible_unit_id
     FROM tasks t
     LEFT JOIN unit_positions up ON up.id = t.responsible_position_id
     WHERE t.term_id = ?`,
    [termId]
  );
  // Map<def_id, Map<unit_id, task>>  (unit_id=0 for legacy tasks with no responsible position)
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.process_definition_id)) {
      map.set(row.process_definition_id, new Map());
    }
    const unitKey = row.responsible_unit_id ?? 0;
    const byUnit = map.get(row.process_definition_id);
    if (!byUnit.has(unitKey)) {
      byUnit.set(unitKey, {
        id: row.id,
        process_run_id: row.process_run_id,
        process_definition_id: row.process_definition_id
      });
    }
  });
  return map;
};

// Tasks existentes de UNA configuración en UN periodo, indexadas por unidad de alcance.
const getExistingTasksByUnitForDefinition = async (connection, definitionId, termId) => {
  const [rows] = await connection.query(
    `SELECT t.id, t.process_run_id,
            COALESCE(t.scope_unit_id, up.unit_id) AS responsible_unit_id
     FROM tasks t
     LEFT JOIN unit_positions up ON up.id = t.responsible_position_id
     WHERE t.process_definition_id = ? AND t.term_id = ?`,
    [definitionId, termId]
  );
  const byUnit = new Map();
  rows.forEach((row) => {
    const unitKey = row.responsible_unit_id ?? 0;
    if (!byUnit.has(unitKey)) {
      byUnit.set(unitKey, { id: row.id, process_run_id: row.process_run_id });
    }
  });
  return byUnit;
};

// Corrida activa de (configuración, periodo), si existe.
const getActiveRunForDefinitionTerm = async (connection, definitionId, termId) => {
  const [rows] = await connection.query(
    `SELECT id, run_mode
     FROM process_runs
     WHERE process_definition_id = ? AND term_id <=> ? AND status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
    [definitionId, termId]
  );
  return rows?.[0] || null;
};

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

const getDocumentVersionFillContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.document_id,
       dv.status AS document_version_status,
       d.owner_person_id,
       d.status AS document_status,
       d.task_item_id,
       ti.process_definition_template_id,
       ti.assigned_person_id AS task_item_assigned_person_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       t.created_by_user_id AS task_created_by_user_id,
       t.responsible_position_id AS task_responsible_position_id,
       COALESCE(ti.target_unit_id, up_item.unit_id, t.scope_unit_id, up_task.unit_id) AS scope_unit_id,
       COALESCE(u_target.unit_type_id, u_item.unit_type_id, u_task_scope.unit_type_id, u_task.unit_type_id) AS scope_unit_type_id
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     LEFT JOIN units u_item ON u_item.id = up_item.unit_id
     LEFT JOIN units u_target ON u_target.id = ti.target_unit_id
     LEFT JOIN units u_task_scope ON u_task_scope.id = t.scope_unit_id
     LEFT JOIN unit_positions up_task ON up_task.id = t.responsible_position_id
     LEFT JOIN units u_task ON u_task.id = up_task.unit_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

const getDocumentVersionSignatureContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.document_id,
       dv.status AS document_version_status,
       d.owner_person_id,
       d.status AS document_status,
       d.task_item_id,
       ti.task_id,
       ti.process_definition_template_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       t.process_definition_id,
       t.responsible_position_id,
       COALESCE(ti.target_unit_id, up_item.unit_id, t.scope_unit_id, up_task.unit_id) AS scope_unit_id,
       COALESCE(u_target.unit_type_id, u_item.unit_type_id, u_task_scope.unit_type_id, u_task.unit_type_id) AS scope_unit_type_id
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     LEFT JOIN template_artifacts tar ON tar.id = dv.template_artifact_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     LEFT JOIN units u_item ON u_item.id = up_item.unit_id
     LEFT JOIN units u_target ON u_target.id = ti.target_unit_id
     LEFT JOIN units u_task_scope ON u_task_scope.id = t.scope_unit_id
     LEFT JOIN unit_positions up_task ON up_task.id = t.responsible_position_id
     LEFT JOIN units u_task ON u_task.id = up_task.unit_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

const getActiveFillFlowTemplateForDefinitionTemplate = async (
  connection,
  processDefinitionTemplateId
) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM fill_flow_templates
     WHERE process_definition_template_id = ?
       AND is_active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [processDefinitionTemplateId]
  );
  return rows?.[0] || null;
};

const getActiveSignatureFlowTemplateForDefinitionTemplate = async (
  connection,
  processDefinitionTemplateId
) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_flow_templates
     WHERE process_definition_template_id = ?
       AND is_active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [processDefinitionTemplateId]
  );
  return rows?.[0] || null;
};

const getFillFlowSteps = async (connection, fillFlowTemplateId) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       step_order,
       resolver_type,
       assigned_person_id,
       unit_scope_type,
       unit_id,
       unit_type_id,
       cargo_id,
       position_id,
       selection_mode
     FROM fill_flow_steps
     WHERE fill_flow_template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [fillFlowTemplateId]
  );
  return rows;
};

const getSignatureFlowSteps = async (connection, signatureFlowTemplateId) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       step_order,
       resolver_type,
       assigned_person_id,
       unit_scope_type,
       unit_id,
       unit_type_id,
       position_id,
       step_type_id,
       required_cargo_id,
       selection_mode,
       approval_mode,
       required_signers_min,
       required_signers_max,
       is_required
     FROM signature_flow_steps
     WHERE template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [signatureFlowTemplateId]
  );
  return rows;
};

const getSignaturePendingStatusId = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_request_statuses
     WHERE LOWER(code) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [SIGNATURE_REQUEST_STATUS.PENDING]
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};

const resolveCurrentPersonsForPosition = async (connection, positionId) => {
  if (!positionId) {
    return [];
  }
  const [rows] = await connection.query(
    `SELECT DISTINCT pa.person_id
     FROM position_assignments pa
     WHERE pa.position_id = ?
       AND pa.is_current = 1
       AND pa.person_id IS NOT NULL
     ORDER BY pa.person_id ASC`,
    [positionId]
  );
  return rows.map((row) => Number(row.person_id)).filter(Boolean);
};

const resolveScopeForStep = (step, context) => {
  const unitScopeType = String(step?.unit_scope_type || "context_exact");
  return {
    unitScopeType,
    unitId:
      (step?.unit_id ? Number(step.unit_id) : null)
      || (unitScopeType === "context_exact" || unitScopeType === "context_subtree" || unitScopeType === "context_ancestor_type"
        ? (context?.scope_unit_id ? Number(context.scope_unit_id) : null)
        : null),
    unitTypeId:
      (step?.unit_type_id ? Number(step.unit_type_id) : null)
      || (unitScopeType === "unit_type" ? (context?.scope_unit_type_id ? Number(context.scope_unit_type_id) : null) : null)
  };
};

const resolvePersonsForCargoInScope = async (connection, step, context = null) => {
  if (!step?.cargo_id) {
    return [];
  }

  const scope = resolveScopeForStep(step, context);
  const params = [step.cargo_id];
  let query = `
    SELECT DISTINCT pa.person_id
    FROM unit_positions up
    INNER JOIN units u ON u.id = up.unit_id
    INNER JOIN position_assignments pa
      ON pa.position_id = up.id
     AND pa.is_current = 1
    WHERE up.is_active = 1
      AND pa.person_id IS NOT NULL
      AND up.cargo_id = ?`;

  if (scope.unitScopeType === "unit_subtree") {
    if (!scope.unitId) {
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
    params.unshift(scope.unitId);
  } else if (scope.unitScopeType === "unit_exact") {
    if (!scope.unitId) {
      return [];
    }
    query += "\n      AND up.unit_id = ?";
    params.push(scope.unitId);
  } else if (scope.unitScopeType === "unit_type") {
    if (!scope.unitTypeId) {
      return [];
    }
    query += "\n      AND u.unit_type_id = ?";
    params.push(scope.unitTypeId);
  } else if (scope.unitScopeType === "context_subtree") {
    if (!scope.unitId) {
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
    params.unshift(scope.unitId);
  } else if (scope.unitScopeType === "context_ancestor_type") {
    if (!scope.unitId || !scope.unitTypeId) {
      return [];
    }
    query = `
      WITH RECURSIVE ancestor_units AS (
        SELECT id, unit_type_id
        FROM units
        WHERE id = ?
        UNION ALL
        SELECT parent_u.id, parent_u.unit_type_id
        FROM unit_relations ur
        INNER JOIN relation_unit_types rt
          ON rt.id = ur.relation_type_id
         AND rt.code = 'org'
        INNER JOIN ancestor_units au ON au.id = ur.child_unit_id
        INNER JOIN units parent_u ON parent_u.id = ur.parent_unit_id
      )
      ${query}
        AND up.unit_id IN (
          SELECT id
          FROM ancestor_units
          WHERE unit_type_id = ?
        )`;
    params.unshift(scope.unitTypeId);
    params.unshift(scope.unitId);
  } else if (scope.unitScopeType === "context_exact") {
    if (!scope.unitId) {
      return [];
    }
    query += "\n      AND up.unit_id = ?";
    params.push(scope.unitId);
  }

  query += "\n    ORDER BY pa.person_id ASC";

  const [rows] = await connection.query(query, params);
  const people = rows.map((row) => Number(row.person_id)).filter(Boolean);
  if (step.selection_mode === "auto_one") {
    return people.slice(0, 1);
  }
  return people;
};

const resolveFillStepAssignees = async (connection, step, context) => {
  if (!step || !context) {
    return [];
  }

  switch (step.resolver_type) {
    case "specific_person":
      return step.assigned_person_id ? [Number(step.assigned_person_id)] : [];
    case "document_owner":
      return context.owner_person_id ? [Number(context.owner_person_id)] : [];
    case "task_assignee": {
      const assignee = context.task_item_assigned_person_id || context.task_created_by_user_id;
      return assignee ? [Number(assignee)] : [];
    }
    case "position": {
      const people = await resolveCurrentPersonsForPosition(connection, step.position_id);
      return step.selection_mode === "auto_one" ? people.slice(0, 1) : people;
    }
    case "cargo_in_scope":
      return resolvePersonsForCargoInScope(connection, step, context);
    case "manual_pick":
    default:
      return [];
  }
};

const shouldInferSignatureFlowForContext = (context) => {
  if (!context?.process_definition_template_id) {
    return false;
  }

  // usage_role attachment/support deprecado (toda adjunción ad-hoc va por document_attachments, que no
  // genera task_items); y el gate por artifact_origin también se deprecó. Todo entregable de proceso
  // (siempre usage_role='primary') participa del ciclo de entrega/firma.
  return true;
};

const resolveSignatureStepAssignees = async (connection, step, context) => {
  if (!step || !context?.task_id) {
    return [];
  }

  if (String(step.selection_mode || "auto_all") === "manual") {
    return [];
  }

  switch (String(step.resolver_type || "cargo_in_scope")) {
    case "specific_person":
      return step.assigned_person_id ? [Number(step.assigned_person_id)] : [];
    case "document_owner":
      return context.owner_person_id ? [Number(context.owner_person_id)] : [];
    case "task_assignee": {
      const assignee = context.task_item_assigned_person_id || context.task_created_by_user_id;
      return assignee ? [Number(assignee)] : [];
    }
    case "position": {
      const people = await resolveCurrentPersonsForPosition(connection, step.position_id);
      return String(step.selection_mode || "auto_all") === "auto_one" ? people.slice(0, 1) : people;
    }
    case "cargo_in_scope":
    default: {
      if (!step.required_cargo_id) {
        return [];
      }
      const assignees = await resolvePersonsForCargoInScope(
        connection,
        {
          cargo_id: step.required_cargo_id,
          unit_scope_type: step.unit_scope_type,
          unit_id: step.unit_id,
          unit_type_id: step.unit_type_id,
          selection_mode: step.selection_mode
        },
        context
      );
      if (String(step.selection_mode || "auto_all") === "auto_one") {
        return assignees.slice(0, 1);
      }
      return assignees;
    }
  }
};

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  return ensureDocumentSignatureWorkflowForDocumentVersion(connection, documentVersionId);
};

const repairFillRequestsForFlow = async (connection, documentFillFlowId, steps, context) => {
  const [existingRows] = await connection.query(
    `SELECT
       fr.id,
       fr.fill_flow_step_id,
       fr.assigned_person_id,
       fr.status,
       fr.is_manual
     FROM fill_requests fr
     WHERE fr.document_fill_flow_id = ?
     ORDER BY fr.fill_flow_step_id ASC, fr.id ASC`,
    [documentFillFlowId]
  );

  const existingByStepId = new Map();
  existingRows.forEach((row) => {
    const key = Number(row.fill_flow_step_id);
    if (!existingByStepId.has(key)) {
      existingByStepId.set(key, []);
    }
    existingByStepId.get(key).push(row);
  });

  for (const step of steps) {
    const stepId = Number(step.id);
    const existingForStep = existingByStepId.get(stepId) || [];
    const manualRows = existingForStep.filter((row) => Number(row.is_manual) === 1);
    const resolvedRows = existingForStep.filter((row) => Number(row.assigned_person_id) > 0);
    const assignees = [...new Set((await resolveFillStepAssignees(connection, step, context)).map(Number).filter(Boolean))];

    if (!assignees.length) {
      if (!existingForStep.length) {
        await connection.query(
          `INSERT INTO fill_requests (
             document_fill_flow_id,
             fill_flow_step_id,
             assigned_person_id,
             status,
             is_manual
           ) VALUES (?, ?, ?, ?, ?)`,
          [documentFillFlowId, stepId, null, "pending", 1]
        );
      }
      continue;
    }

    const existingAssignedIds = new Set(resolvedRows.map((row) => Number(row.assigned_person_id)).filter(Boolean));
    const replaceableRows = [
      ...manualRows,
      ...resolvedRows.filter((row) => !assignees.includes(Number(row.assigned_person_id))),
    ];
    const usedReplaceableIds = new Set();

    for (const assignedPersonId of assignees) {
      if (existingAssignedIds.has(assignedPersonId)) {
        continue;
      }
      const rowToPromote = replaceableRows.find((row) => !usedReplaceableIds.has(Number(row.id)));
      if (rowToPromote) {
        usedReplaceableIds.add(Number(rowToPromote.id));
        await connection.query(
          `UPDATE fill_requests
           SET assigned_person_id = ?,
               is_manual = 0,
               status = 'pending',
               responded_at = NULL,
               response_note = NULL
           WHERE id = ?`,
          [assignedPersonId, Number(rowToPromote.id)]
        );
      } else {
        await connection.query(
          `INSERT INTO fill_requests (
             document_fill_flow_id,
             fill_flow_step_id,
             assigned_person_id,
             status,
             is_manual
           ) VALUES (?, ?, ?, ?, ?)`,
          [documentFillFlowId, stepId, assignedPersonId, "pending", 0]
        );
      }
    }

    if (assignees.length > 0) {
      const [currentRows] = await connection.query(
        `SELECT id, assigned_person_id, is_manual
         FROM fill_requests
         WHERE document_fill_flow_id = ?
           AND fill_flow_step_id = ?`,
        [documentFillFlowId, stepId]
      );

      const staleIds = currentRows
        .filter((row) => {
          const assignedPersonId = Number(row.assigned_person_id || 0);
          const isManual = Number(row.is_manual) === 1;
          if (!isManual) {
            return false;
          }
          if (!assignedPersonId) {
            return true;
          }
          return !assignees.includes(assignedPersonId);
        })
        .map((row) => Number(row.id))
        .filter(Boolean);

      if (staleIds.length) {
        await connection.query(
          `DELETE FROM fill_requests
           WHERE id IN (${staleIds.map(() => "?").join(", ")})`,
          staleIds
        );
      }
    }
  }
};

export const ensureFillFlowForDocumentVersion = async (connection, documentVersionId) => {
  const context = await getDocumentVersionFillContext(connection, documentVersionId);
  if (!context?.process_definition_template_id) {
    return null;
  }

  const existingFlow = await connection.query(
    `SELECT id
     FROM document_fill_flows
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  if (existingFlow?.[0]?.length) {
    const flowId = Number(existingFlow[0][0].id);
    const fillFlowTemplate = await getActiveFillFlowTemplateForDefinitionTemplate(
      connection,
      context.process_definition_template_id
    );
    if (fillFlowTemplate?.id) {
      const steps = await getFillFlowSteps(connection, fillFlowTemplate.id);
      await repairFillRequestsForFlow(connection, flowId, steps, context);
    }
    await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
    return flowId;
  }

  const fillFlowTemplate = await getActiveFillFlowTemplateForDefinitionTemplate(
    connection,
    context.process_definition_template_id
  );

  if (!fillFlowTemplate?.id) {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Listo para firma");
    await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
    return null;
  }

  const steps = await getFillFlowSteps(connection, fillFlowTemplate.id);
  const firstStepOrder = steps.length ? Number(steps[0].step_order) : null;

  const [insertFlowResult] = await connection.query(
    `INSERT INTO document_fill_flows (
       fill_flow_template_id,
       document_version_id,
       status,
       current_step_order
     ) VALUES (?, ?, ?, ?)`,
    [
      fillFlowTemplate.id,
      documentVersionId,
      "pending",
      firstStepOrder
    ]
  );

  const documentFillFlowId = Number(insertFlowResult.insertId);

  for (const step of steps) {
    const assignees = await resolveFillStepAssignees(connection, step, context);
    if (!assignees.length) {
      await connection.query(
        `INSERT INTO fill_requests (
           document_fill_flow_id,
           fill_flow_step_id,
           assigned_person_id,
           status,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [documentFillFlowId, step.id, null, "pending", 1]
      );
      continue;
    }

    for (const assignedPersonId of assignees) {
      await connection.query(
        `INSERT INTO fill_requests (
           document_fill_flow_id,
           fill_flow_step_id,
           assigned_person_id,
           status,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [documentFillFlowId, step.id, assignedPersonId, "pending", 0]
      );
    }
  }

  await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de llenado");
  await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);

  return documentFillFlowId;
};

const applyRecipientPolicy = (rows, recipientPolicy, exactPositionId = null) => {
  if (!rows.length) {
    return [];
  }
  if (recipientPolicy === "exact_position" || exactPositionId) {
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

    const useSubtree = rule.unit_scope_type === "unit_subtree";

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

const getExistingTaskItemTemplateIds = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT process_definition_template_id
     FROM task_items
     WHERE task_id = ?
       AND origin_kind = 'process_defined'
       AND target_position_id IS NULL
       AND target_person_id IS NULL`,
    [taskId]
  );
  return new Set(rows.map((row) => Number(row.process_definition_template_id)));
};

const getExistingTaskItemTargetKeys = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT
       process_definition_template_id,
       COALESCE(target_position_id, 0) AS target_position_id,
       COALESCE(target_person_id, 0) AS target_person_id
     FROM task_items
     WHERE task_id = ?
       AND origin_kind = 'process_defined'`,
    [taskId]
  );
  return new Set(rows.map((row) => [
    Number(row.process_definition_template_id || 0),
    Number(row.target_position_id || 0),
    Number(row.target_person_id || 0)
  ].join(":")));
};

const getTaskItemsForDocumentMaterialization = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.process_definition_template_id,
       ti.template_artifact_id,
       ti.assigned_person_id,
       ti.target_unit_id,
       ti.target_position_id,
       ti.target_person_id,
       t.responsible_position_id,
       tar.display_name AS template_artifact_name,
       pdt.instance_mode
     FROM task_items ti
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN process_definition_templates pdt ON pdt.id = ti.process_definition_template_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     WHERE ti.task_id = ?
     ORDER BY ti.sort_order ASC, ti.id ASC`,
    [taskId]
  );
  return rows;
};

export const resolveOwnerPersonIdForTaskItem = async (connection, taskItem) => {
  if (taskItem?.target_person_id) {
    return Number(taskItem.target_person_id);
  }

  if (taskItem?.assigned_person_id) {
    return Number(taskItem.assigned_person_id);
  }

  if (taskItem?.task_id && taskItem?.responsible_position_id) {
    const [rows] = await connection.query(
      `SELECT assigned_person_id
       FROM task_assignments
       WHERE task_id = ?
         AND position_id = ?
         AND assigned_person_id IS NOT NULL
       ORDER BY id ASC
       LIMIT 1`,
      [taskItem.task_id, taskItem.responsible_position_id]
    );
    if (rows?.[0]?.assigned_person_id) {
      return Number(rows[0].assigned_person_id);
    }
  }

  if (taskItem?.task_id) {
    const [rows] = await connection.query(
      `SELECT assigned_person_id
       FROM task_assignments
       WHERE task_id = ?
         AND assigned_person_id IS NOT NULL
       ORDER BY id ASC
       LIMIT 1`,
      [taskItem.task_id]
    );
    if (rows?.[0]?.assigned_person_id) {
      return Number(rows[0].assigned_person_id);
    }
  }

  return null;
};

export const resolveOriginUnitIdForTaskItem = async (connection, taskItem, ownerPersonId = null) => {
  if (taskItem?.target_unit_id) {
    return Number(taskItem.target_unit_id);
  }

  // 1. Posición explícita del task_item (más específica)
  if (taskItem?.responsible_position_id) {
    const [rows] = await connection.query(
      `SELECT unit_id FROM unit_positions WHERE id = ? AND unit_id IS NOT NULL LIMIT 1`,
      [taskItem.responsible_position_id]
    );
    if (rows?.[0]?.unit_id) return Number(rows[0].unit_id);
  }

  // 2. Posición del task padre (contexto de la unidad que generó el task)
  if (taskItem?.task_id) {
    const [rows] = await connection.query(
      `SELECT COALESCE(t.scope_unit_id, up.unit_id) AS unit_id
       FROM tasks t
       LEFT JOIN unit_positions up ON up.id = t.responsible_position_id
       WHERE t.id = ? AND COALESCE(t.scope_unit_id, up.unit_id) IS NOT NULL
       LIMIT 1`,
      [taskItem.task_id]
    );
    if (rows?.[0]?.unit_id) return Number(rows[0].unit_id);
  }

  // 3. Última opción: primera posición activa del owner (solo cuando no hay contexto de task)
  const normalizedOwnerPersonId = Number(ownerPersonId || 0) || null;
  if (normalizedOwnerPersonId) {
    const [ownerRows] = await connection.query(
      `SELECT up.unit_id
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND up.unit_id IS NOT NULL
       ORDER BY pa.id ASC, up.id ASC
       LIMIT 1`,
      [normalizedOwnerPersonId]
    );
    if (ownerRows?.[0]?.unit_id) return Number(ownerRows[0].unit_id);
  }

  return null;
};

export const ensureDocumentForTaskItem = async (connection, taskItem) => {
  const ownerPersonId = await resolveOwnerPersonIdForTaskItem(connection, taskItem);
  const originUnitId = await resolveOriginUnitIdForTaskItem(connection, taskItem, ownerPersonId);

  const [existingRows] = await connection.query(
    `SELECT id
     FROM documents
     WHERE task_item_id = ?
     LIMIT 1`,
    [taskItem.id]
  );

  let documentId = Number(existingRows?.[0]?.id || 0);
  if (!documentId) {
    const [insertResult] = await connection.query(
      `INSERT INTO documents (
         task_item_id,
         owner_person_id,
         origin_unit_id,
         origin_type,
         title,
         status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        taskItem.id,
        ownerPersonId,
        originUnitId,
        "task_item",
        taskItem.template_artifact_name || `Documento ${taskItem.id}`,
        "Inicial"
      ]
    );
    documentId = Number(insertResult.insertId);
  } else if (ownerPersonId) {
    await connection.query(
      `UPDATE documents
       SET owner_person_id = COALESCE(owner_person_id, ?),
           origin_unit_id = COALESCE(origin_unit_id, ?)
       WHERE id = ?`,
      [ownerPersonId, originUnitId, documentId]
    );
  } else if (originUnitId) {
    await connection.query(
      `UPDATE documents
       SET origin_unit_id = COALESCE(origin_unit_id, ?)
       WHERE id = ?`,
      [originUnitId, documentId]
    );
  }

  const [versionRows] = await connection.query(
    `SELECT id
     FROM document_versions
     WHERE document_id = ?
     ORDER BY version ASC, id ASC
     LIMIT 1`,
    [documentId]
  );

  if (!versionRows?.length) {
    const [insertResult] = await connection.query(
      `INSERT INTO document_versions (
         document_id,
         version,
         template_artifact_id,
         status
       ) VALUES (?, ?, ?, ?)`,
      [
        documentId,
        0.1,
        taskItem.template_artifact_id ?? null,
        "Borrador"
      ]
    );
    await ensureFillFlowForDocumentVersion(connection, Number(insertResult.insertId));
  } else {
    await ensureFillFlowForDocumentVersion(connection, Number(versionRows[0].id));
  }

  return documentId;
};

const getNextTaskItemDocumentInstanceNo = async (connection, taskItemId) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(instance_no), 0) AS max_instance_no
     FROM documents
     WHERE task_item_id = ?`,
    [taskItemId]
  );
  return Number(rows?.[0]?.max_instance_no || 0) + 1;
};

export const createDocumentInstanceForTaskItem = async (
  connection,
  taskItem,
  {
    title = null,
    forceOwnerPersonId = null,
  } = {}
) => {
  if (!taskItem?.id) {
    throw new Error("Se requiere un task_item válido para crear la instancia documental.");
  }

  const ownerPersonId = Number(forceOwnerPersonId || 0) || await resolveOwnerPersonIdForTaskItem(connection, taskItem);
  const originUnitId = await resolveOriginUnitIdForTaskItem(connection, taskItem, ownerPersonId);
  const instanceNo = await getNextTaskItemDocumentInstanceNo(connection, taskItem.id);
  const normalizedTitle = String(title || taskItem.template_artifact_name || `Documento ${taskItem.id}`).trim();

  const [insertResult] = await connection.query(
    `INSERT INTO documents (
       task_item_id,
       instance_no,
       owner_person_id,
       origin_unit_id,
       origin_type,
       title,
       status
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      taskItem.id,
      instanceNo,
      ownerPersonId || null,
      originUnitId || null,
      "task_item",
      normalizedTitle,
      "Inicial"
    ]
  );
  const documentId = Number(insertResult.insertId);

  const [versionInsertResult] = await connection.query(
    `INSERT INTO document_versions (
       document_id,
       version,
       template_artifact_id,
       status
     ) VALUES (?, ?, ?, ?)`,
    [
      documentId,
      0.1,
      taskItem.template_artifact_id ?? null,
      "Borrador"
    ]
  );
  const documentVersionId = Number(versionInsertResult.insertId);
  await ensureFillFlowForDocumentVersion(connection, documentVersionId);

  return {
    document_id: documentId,
    document_version_id: documentVersionId,
    instance_no: instanceNo,
    owner_person_id: ownerPersonId || null,
    origin_unit_id: originUnitId || null,
    title: normalizedTitle,
  };
};

export const ensureDocumentsForTask = async (connection, taskId) => {
  const taskItems = await getTaskItemsForDocumentMaterialization(connection, taskId);
  let createdOrEnsured = 0;
  for (const taskItem of taskItems) {
    if (String(taskItem.instance_mode || "single_document") === "owner_many_documents") {
      continue;
    }
    await ensureDocumentForTaskItem(connection, taskItem);
    createdOrEnsured += 1;
  }
  return createdOrEnsured;
};

const ensureTaskItemsForTask = async (connection, taskId, processDefinitionId, executableTemplatesMap, startDate = null, endDate = null) => {
  const templates = executableTemplatesMap.get(processDefinitionId) || [];
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

const ensureTaskItemsForTaskTargets = async (
  connection,
  taskId,
  processDefinitionId,
  executableTemplatesMap,
  targetPositions = [],
  startDate = null,
  endDate = null
) => {
  const templates = executableTemplatesMap.get(processDefinitionId) || [];
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

const ensureUnitTaskAssignments = async (connection, taskId, positions, responsiblePositionId) => {
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

const getTaskAssignmentTargets = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT
       ta.position_id,
       ta.assigned_person_id AS person_id,
       up.unit_id
     FROM task_assignments ta
     INNER JOIN unit_positions up ON up.id = ta.position_id
     WHERE ta.task_id = ?
     ORDER BY up.unit_id ASC, ta.position_id ASC, ta.assigned_person_id ASC`,
    [taskId]
  );
  return rows;
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

// Materializa una tarea del proceso General (libre/derivada) SIN aplicar target rules:
// crea el task_item contenedor, su documento/versión (para anexos) y asigna ÚNICAMENTE
// a la posición del creador. Así la tarea es privada de quien la crea, no de toda la unidad.
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

// Lanza/actualiza las tasks+task_items de UNA configuración en UN periodo, gestionando la corrida.
//   runMode: 'automatic' (auto-disparo al instanciar el periodo) | 'manual' (acción explícita).
//   relaunch: si true y hay corrida activa, la supersede (status 'completed', historial vía
//     source_run_id) y crea una corrida nueva; las tasks/items existentes se conservan y actualizan
//     (Opción X) y se repuntan a la nueva corrida. Si false, reusa la corrida activa o crea la primera.
// Las maps (templates/rules/existingByUnit) pueden inyectarse para lotes (generateTasksForTerm) o
// resolverse aquí para una llamada suelta. No abre transacción: el llamador la controla.
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
  const pool = getMariaDBPool();
  if (!pool) throw new Error("La conexion con MariaDB no esta disponible.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const term = await getTermById(connection, termId);
    if (!term) throw new Error("Periodo no encontrado.");

    const activeDefinitions = await getActiveAutomaticDefinitions(connection, term);
    const targetRulesMap = await getTargetRulesMap(connection, term.start_date, term.end_date);
    // artifact_origin deprecado: la generación automática toma todas las plantillas ejecutables
    // (creates_task=1), sin filtrar por process/general.
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

// Lanzamiento explícito de UNA configuración en UN periodo (acción "Lanzar proceso").
// Abre su propia transacción. relaunch=true crea una corrida nueva superseiendo la activa.
export const launchProcessDefinitionInTerm = async (definitionId, termId, {
  createdByUserId = null,
  relaunch = false,
  reason = null
} = {}) => {
  const pool = getMariaDBPool();
  if (!pool) throw new Error("La conexion con MariaDB no esta disponible.");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const term = await getTermById(connection, termId);
    if (!term) throw new Error("Periodo no encontrado.");

    const [defRows] = await connection.query(
      `SELECT pdv.id, pdv.status
       FROM process_definition_versions pdv
       WHERE pdv.id = ?
       LIMIT 1`,
      [definitionId]
    );
    const definition = defRows?.[0];
    if (!definition) throw new Error("La configuracion de proceso no existe.");
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

// Estado de lanzamiento de un periodo: para cada configuración activa vinculada al tipo de periodo
// del term, indica si está lanzada (hay corrida) y/o relanzada (más de una corrida), y lista las
// pendientes de lanzar. Alimenta la UI de "Lanzar proceso" / "lanzar pendientes" (Fase 3).
export const getTermLaunchStatus = async (termId) => {
  const pool = getMariaDBPool();
  if (!pool) throw new Error("La conexion con MariaDB no esta disponible.");

  const connection = await pool.getConnection();
  try {
    const term = await getTermById(connection, termId);
    if (!term) throw new Error("Periodo no encontrado.");

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

// Info de lanzamiento de UNA configuración (vista process-centric): tipos de periodo en que corre,
// periodos disponibles de esos tipos (con marca de si ya tienen corrida) e historial de corridas.
export const getDefinitionLaunchInfo = async (definitionId) => {
  const pool = getMariaDBPool();
  if (!pool) throw new Error("La conexion con MariaDB no esta disponible.");

  const connection = await pool.getConnection();
  try {
    const [[definition]] = await connection.query(
      "SELECT id, name, status FROM process_definition_versions WHERE id = ? LIMIT 1",
      [definitionId]
    );
    if (!definition) throw new Error("La configuracion de proceso no existe.");

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

