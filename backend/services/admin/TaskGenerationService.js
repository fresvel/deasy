import { getMariaDBPool } from "../../config/mariadb.js";
import {
  transitionDocumentState,
  transitionDocumentVersionState,
} from "../documents/DocumentStateService.js";
import { SIGNATURE_REQUEST_STATUS } from "../documents/DocumentWorkflowCatalog.js";

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
    `SELECT id, process_definition_id, process_run_id, parent_task_id
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
        process_run_id: row.process_run_id,
        parent_task_id: row.parent_task_id,
        process_definition_id: row.process_definition_id
      });
    }
  });
  return map;
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

  let selectQuery = `
    SELECT id
    FROM process_runs
    WHERE process_definition_id = ?
      AND term_id <=> ?
      AND run_mode = ?`;
  const selectParams = [normalizedProcessDefinitionId, normalizedTermId, runMode];

  if (runMode === "manual") {
    selectQuery += "\n      AND created_by_user_id <=> ?";
    selectParams.push(normalizedCreatedBy);
  }

  selectQuery += "\n    ORDER BY id DESC LIMIT 1";

  const [existingRows] = await connection.query(selectQuery, selectParams);
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
       COALESCE(up_item.unit_id, up_task.unit_id) AS scope_unit_id,
       COALESCE(u_item.unit_type_id, u_task.unit_type_id) AS scope_unit_type_id
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     LEFT JOIN units u_item ON u_item.id = up_item.unit_id
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
       ti.template_usage_role,
       ti.responsible_position_id AS task_item_responsible_position_id,
       t.process_definition_id,
       t.responsible_position_id,
       pdv.execution_mode,
       tar.artifact_origin,
       COALESCE(up_item.unit_id, up_task.unit_id) AS scope_unit_id,
       COALESCE(u_item.unit_type_id, u_task.unit_type_id) AS scope_unit_type_id
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN task_items ti ON ti.id = d.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
     LEFT JOIN template_artifacts tar ON tar.id = dv.template_artifact_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     LEFT JOIN units u_item ON u_item.id = up_item.unit_id
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
       step_type_id,
       required_cargo_id,
       selection_mode,
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
  const unitScopeType = String(step?.unit_scope_type || "unit_exact");
  return {
    unitScopeType,
    unitId: step?.unit_id ? Number(step.unit_id) : (context?.scope_unit_id ? Number(context.scope_unit_id) : null),
    unitTypeId: step?.unit_type_id
      ? Number(step.unit_type_id)
      : (context?.scope_unit_type_id ? Number(context.scope_unit_type_id) : null)
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

  const usageRole = String(context.template_usage_role || "manual_fill");
  if (usageRole === "attachment" || usageRole === "support") {
    return false;
  }

  const artifactOrigin = String(context.artifact_origin || "");
  if (artifactOrigin !== "system") {
    return false;
  }

  return true;
};

const resolveSignatureStepAssignees = async (connection, step, context) => {
  if (!step?.required_cargo_id || !context?.task_id) {
    return [];
  }

  if (String(step.selection_mode || "auto_all") === "manual") {
    return [];
  }

  const assignees = await resolvePersonsForCargoInScope(
    connection,
    {
      cargo_id: step.required_cargo_id,
      unit_scope_type: "unit_exact",
      unit_id: context.scope_unit_id,
      unit_type_id: context.scope_unit_type_id,
      selection_mode: step.selection_mode
    },
    context
  );
  if (String(step.selection_mode || "auto_all") === "auto_one") {
    return assignees.slice(0, 1);
  }
  return assignees;
};

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  const context = await getDocumentVersionSignatureContext(connection, documentVersionId);
  if (!shouldInferSignatureFlowForContext(context)) {
    return null;
  }

  const [existingRows] = await connection.query(
    `SELECT id
     FROM signature_flow_instances
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  if (existingRows?.length) {
    return Number(existingRows[0].id);
  }

  const signatureFlowTemplate = await getActiveSignatureFlowTemplateForDefinitionTemplate(
    connection,
    context.process_definition_template_id
  );
  if (!signatureFlowTemplate?.id) {
    return null;
  }

  const pendingStatusId = await getSignaturePendingStatusId(connection);
  if (!pendingStatusId) {
    throw new Error("No existe el estado Pendiente en signature_request_statuses.");
  }

  const steps = await getSignatureFlowSteps(connection, signatureFlowTemplate.id);
  if (!steps.length) {
    return null;
  }

  const [insertInstanceResult] = await connection.query(
    `INSERT INTO signature_flow_instances (
       template_id,
       document_version_id,
       status_id
     ) VALUES (?, ?, ?)`,
    [signatureFlowTemplate.id, documentVersionId, pendingStatusId]
  );
  const signatureFlowInstanceId = Number(insertInstanceResult.insertId);

  for (const step of steps) {
    const assignees = await resolveSignatureStepAssignees(connection, step, context);
    if (!assignees.length) {
      await connection.query(
        `INSERT INTO signature_requests (
           instance_id,
           step_id,
           assigned_person_id,
           status_id,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [signatureFlowInstanceId, step.id, null, pendingStatusId, 1]
      );
      continue;
    }

    for (const assignedPersonId of assignees) {
      await connection.query(
        `INSERT INTO signature_requests (
           instance_id,
           step_id,
           assigned_person_id,
           status_id,
           is_manual
         ) VALUES (?, ?, ?, ?, ?)`,
        [signatureFlowInstanceId, step.id, assignedPersonId, pendingStatusId, 0]
      );
    }
  }

  if (String(context.document_version_status || "").trim().toLowerCase() === "listo para firma") {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de firma");
  }

  return signatureFlowInstanceId;
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

const getTaskItemsForDocumentMaterialization = async (connection, taskId) => {
  const [rows] = await connection.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.template_artifact_id,
       ti.assigned_person_id,
       t.responsible_position_id,
       tar.display_name AS template_artifact_name
     FROM task_items ti
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     WHERE ti.task_id = ?
     ORDER BY ti.sort_order ASC, ti.id ASC`,
    [taskId]
  );
  return rows;
};

const resolveOwnerPersonIdForTaskItem = async (connection, taskItem) => {
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

export const ensureDocumentForTaskItem = async (connection, taskItem) => {
  const ownerPersonId = await resolveOwnerPersonIdForTaskItem(connection, taskItem);

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
         origin_type,
         title,
         status
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        taskItem.id,
        ownerPersonId,
        "task_item",
        taskItem.template_artifact_name || `Documento ${taskItem.id}`,
        "Inicial"
      ]
    );
    documentId = Number(insertResult.insertId);
  } else if (ownerPersonId) {
    await connection.query(
      `UPDATE documents
       SET owner_person_id = COALESCE(owner_person_id, ?)
       WHERE id = ?`,
      [ownerPersonId, documentId]
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

export const ensureDocumentsForTask = async (connection, taskId) => {
  const taskItems = await getTaskItemsForDocumentMaterialization(connection, taskId);
  let createdOrEnsured = 0;
  for (const taskItem of taskItems) {
    await ensureDocumentForTaskItem(connection, taskItem);
    createdOrEnsured += 1;
  }
  return createdOrEnsured;
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
  await ensureDocumentsForTask(connection, taskId);
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
      const processRunId = await ensureProcessRun({
        connection,
        processDefinitionId: definition.id,
        termId: term.id,
        runMode: "automatic_term",
        status: "active"
      });

      let task = existingTasksMap.get(definition.id) || null;
      if (!task) {
        const [result] = await connection.query(
          `INSERT INTO tasks
           (
             process_definition_id,
             process_run_id,
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
            processRunId,
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
          process_run_id: processRunId,
          parent_task_id: null,
          process_definition_id: definition.id
        };
        existingTasksMap.set(definition.id, task);
        createdTaskIds.push(task.id);
      } else if (!task.process_run_id) {
        await connection.query(
          `UPDATE tasks
           SET process_run_id = ?
           WHERE id = ?`,
          [processRunId, task.id]
        );
        task.process_run_id = processRunId;
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
