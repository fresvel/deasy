import {
  normalizeDocumentVersionStatus,
  transitionDocumentVersionState,
} from "./DocumentStateService.js";
import {
  SIGNATURE_REQUEST_STATUS,
  SIGNATURE_STATUS,
  getSignatureStatusIdByCode,
  getSignatureRequestStatusIdByCode,
  getDefaultSignatureTypeId,
} from "./DocumentWorkflowCatalog.js";

const normalizeCode = (value) => String(value || "").trim().toLowerCase();
const SIGN_ACTIVE = new Set([SIGNATURE_REQUEST_STATUS.IN_PROGRESS]);
const SIGN_APPROVED = new Set([SIGNATURE_REQUEST_STATUS.COMPLETED]);
const SIGN_REJECTED = new Set([SIGNATURE_REQUEST_STATUS.REJECTED, SIGNATURE_REQUEST_STATUS.CANCELLED]);
const DOC_SIGNATURE_SUCCESS = new Set([SIGNATURE_STATUS.SIGNED]);

const parseSignatureStepAnchorRefs = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean);
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return [];
};

const getDocumentVersionSignatureContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.status AS document_version_status,
       dv.working_file_path,
       d.owner_person_id,
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

const shouldInferSignatureFlowForContext = (context) => {
  if (!context?.process_definition_template_id) {
    return false;
  }

  const usageRole = String(context.template_usage_role || "manual_fill");
  if (usageRole === "attachment" || usageRole === "support") {
    return false;
  }

  return String(context.artifact_origin || "") === "system";
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

const getSignatureFlowSteps = async (connection, signatureFlowTemplateId) => {
  const [rows] = await connection.query(
    `SELECT
       id,
       step_order,
       code,
       name,
       slot,
       step_type_id,
       required_cargo_id,
       selection_mode,
       required_signers_min,
       required_signers_max,
       is_required,
       anchor_refs
     FROM signature_flow_steps
     WHERE template_id = ?
     ORDER BY step_order ASC, id ASC`,
    [signatureFlowTemplateId]
  );
  return rows.map((row) => ({
    id: row.id,
    stepOrder: Number(row.step_order || 0),
    code: String(row.code || "").trim() || null,
    name: String(row.name || "").trim() || null,
    slot: String(row.slot || "").trim() || null,
    stepTypeId: row.step_type_id ? Number(row.step_type_id) : null,
    requiredCargoId: row.required_cargo_id ? Number(row.required_cargo_id) : null,
    selectionMode: String(row.selection_mode || "auto_all").trim() || "auto_all",
    requiredSignersMin: row.required_signers_min !== null && row.required_signers_min !== undefined
      ? Number(row.required_signers_min)
      : null,
    requiredSignersMax: row.required_signers_max !== null && row.required_signers_max !== undefined
      ? Number(row.required_signers_max)
      : null,
    isRequired: row.is_required ? Number(row.is_required) : 0,
    anchorRefs: parseSignatureStepAnchorRefs(row.anchor_refs)
  }));
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

const resolveScopeForStep = (step, context) => ({
  unitScopeType: String(step?.unit_scope_type || "unit_exact"),
  unitId: step?.unit_id ? Number(step.unit_id) : (context?.scope_unit_id ? Number(context.scope_unit_id) : null),
  unitTypeId: step?.unit_type_id
    ? Number(step.unit_type_id)
    : (context?.scope_unit_type_id ? Number(context.scope_unit_type_id) : null),
  cargoId: step?.required_cargo_id ? Number(step.required_cargo_id) : null,
});

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

const resolvePersonsForCargoInScope = async (connection, step, context = null) => {
  const scope = resolveScopeForStep(step, context);
  if (!scope.cargoId) {
    return [];
  }

  const params = [scope.cargoId];
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
  if (String(step.selection_mode || "auto_all") === "auto_one") {
    return people.slice(0, 1);
  }
  return people;
};

const collectAssignees = (...sources) => {
  const seen = new Set();
  const result = [];
  for (const id of sources.flat()) {
    const candidate = Number(id || 0);
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    result.push(candidate);
  }
  return result;
};

const resolveSpecificPersonAssignees = (step) => {
  if (!step?.assigned_person_id) {
    return [];
  }
  return [Number(step.assigned_person_id)];
};

const resolveDocumentOwnerAssignee = (context) => (context?.owner_person_id ? [Number(context.owner_person_id)] : []);

const resolveTaskAssignee = (context) => {
  const assignees = [];
  if (context?.task_item_assigned_person_id) {
    assignees.push(Number(context.task_item_assigned_person_id));
  }
  if (context?.task_created_by_user_id) {
    assignees.push(Number(context.task_created_by_user_id));
  }
  return assignees;
};

const resolvePositionAssignees = async (connection, step, context) => {
  return resolveCurrentPersonsForPosition(
    connection,
    Number(step?.position_id || context?.task_item_responsible_position_id || context?.task_responsible_position_id)
  );
};

const resolveSignatureStepAssignees = async (connection, step, context) => {
  if (!step || step.is_manual === 1 || String(step.selection_mode || "auto_all") === "manual") {
    return [];
  }

  const resolverType = String(step.resolver_type || step.selection_mode || "cargo_in_scope").trim();
  switch (resolverType) {
    case "specific_person":
      return collectAssignees(resolveSpecificPersonAssignees(step));
    case "document_owner":
      return collectAssignees(resolveDocumentOwnerAssignee(context));
    case "task_assignee":
      return collectAssignees(resolveTaskAssignee(context));
    case "position":
      return collectAssignees(await resolvePositionAssignees(connection, step, context));
    case "cargo_in_scope":
    default:
      return collectAssignees(await resolvePersonsForCargoInScope(connection, step, context));
  }
};

const deriveSignatureStatusCode = (result) => {
  const validation = result?.validation || {};
  if (validation?.performed && validation?.bottomLine === true) {
    return SIGNATURE_STATUS.SIGNED;
  }
  if (validation?.performed && validation?.bottomLine === false) {
    return SIGNATURE_STATUS.INVALID;
  }
  return SIGNATURE_STATUS.FAILED;
};

const deriveSignatureRequestStatusCode = (signatureStatusCode) =>
  signatureStatusCode === SIGNATURE_STATUS.SIGNED
    ? SIGNATURE_REQUEST_STATUS.COMPLETED
    : SIGNATURE_REQUEST_STATUS.REJECTED;

const truncateNote = (value, max = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const getSignatureRequestContext = async (connection, signatureRequestId) => {
  const [rows] = await connection.query(
    `SELECT
       sr.id,
       sr.assigned_person_id,
       sr.instance_id,
       sr.step_id,
       sfi.document_version_id,
       sfs.step_type_id
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     WHERE sr.id = ?
     LIMIT 1`,
    [signatureRequestId]
  );
  return rows?.[0] || null;
};

const getExistingSignatureFlowInstance = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT id
     FROM signature_flow_instances
     WHERE document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] ? Number(rows[0].id) : null;
};

const summarizeSignatureRequests = (rows) => {
  const byStep = new Map();
  for (const row of rows) {
    const stepOrder = Number(row.step_order);
    if (!byStep.has(stepOrder)) {
      byStep.set(stepOrder, {
        stepOrder,
        total: 0,
        approvedCount: 0,
        rejectedCount: 0,
        activeCount: 0,
        pendingCount: 0,
      });
    }
    const summary = byStep.get(stepOrder);
    summary.total += 1;
    const code = normalizeCode(row.request_status_code);
    const signatureCode = normalizeCode(row.signature_status_code);
    if (SIGN_APPROVED.has(code)) {
      if (signatureCode && !DOC_SIGNATURE_SUCCESS.has(signatureCode)) summary.rejectedCount += 1;
      else summary.approvedCount += 1;
    } else if (SIGN_REJECTED.has(code)) summary.rejectedCount += 1;
    else if (SIGN_ACTIVE.has(code)) summary.activeCount += 1;
    else summary.pendingCount += 1;
  }
  return Array.from(byStep.values())
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((item) => ({
      ...item,
      approved: item.total > 0 && item.approvedCount === item.total,
      hasRejected: item.rejectedCount > 0,
      hasActive: item.activeCount > 0,
      hasPending: item.pendingCount > 0,
    }));
};

export const inspectDocumentVersionSignatureReadiness = async (connection, documentVersionId) => {
  const context = await getDocumentVersionSignatureContext(connection, documentVersionId);
  if (!context) {
    return { ok: false, reason: "document_version_not_found" };
  }
  if (!shouldInferSignatureFlowForContext(context)) {
    return { ok: false, reason: "signature_flow_not_applicable", context };
  }

  const currentStatus = normalizeDocumentVersionStatus(context.document_version_status);
  if (currentStatus !== "Listo para firma") {
    return { ok: false, reason: "document_not_ready_for_signature", context, currentStatus };
  }

  const workingPath = String(context.working_file_path || "").trim().toLowerCase();
  if (!workingPath.endsWith(".pdf")) {
    return { ok: false, reason: "working_pdf_missing", context, currentStatus };
  }

  const signatureFlowTemplate = await getActiveSignatureFlowTemplateForDefinitionTemplate(
    connection,
    context.process_definition_template_id
  );
  if (!signatureFlowTemplate?.id) {
    return { ok: false, reason: "signature_template_missing", context, currentStatus };
  }

  const steps = await getSignatureFlowSteps(connection, signatureFlowTemplate.id);
  if (!steps.length) {
    return { ok: false, reason: "signature_steps_missing", context, currentStatus, signatureFlowTemplate };
  }

  const unresolvedRequiredSteps = [];
  const resolvedSteps = [];
  for (const step of steps) {
    const resolverType = String(step.resolver_type || step.selection_mode || "cargo_in_scope").trim();
    const assignees = await resolveSignatureStepAssignees(connection, step, context);
    if (
      Number(step.is_required) === 1
      && !assignees.length
      && resolverType !== "manual_pick"
      && resolverType !== "manual"
    ) {
      unresolvedRequiredSteps.push({
        stepOrder: Number(step.step_order),
        resolverType,
        reason: "no_assignees",
      });
    }
    resolvedSteps.push({
      ...step,
      resolverType,
      assignees,
    });
  }

  if (unresolvedRequiredSteps.length) {
      return {
        ok: false,
        reason: "required_signers_unresolved",
        context,
        currentStatus,
        signatureFlowTemplate,
        steps: resolvedSteps,
        unresolvedRequiredSteps,
      };
  }

  return {
    ok: true,
    context,
    currentStatus,
    signatureFlowTemplate,
    steps: resolvedSteps,
  };
};

export const resolveCurrentSignatureStep = async (connection, documentVersionId) => {
  const instanceId = await getExistingSignatureFlowInstance(connection, documentVersionId);
  if (!instanceId) {
    return null;
  }

  const [rows] = await connection.query(
    `SELECT
       sfs.id AS step_id,
       sfs.step_order,
       COUNT(sr.id) AS total_requests,
       SUM(CASE WHEN srs.code = 'completado' THEN 1 ELSE 0 END) AS completed_requests,
       SUM(CASE WHEN srs.code = 'rechazado' THEN 1 ELSE 0 END) AS rejected_requests,
       SUM(CASE WHEN srs.code = 'cancelado' THEN 1 ELSE 0 END) AS cancelled_requests
     FROM signature_flow_steps sfs
     INNER JOIN signature_requests sr ON sr.step_id = sfs.id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     WHERE sr.instance_id = ?
     GROUP BY sfs.id, sfs.step_order
     ORDER BY sfs.step_order ASC`,
    [instanceId]
  );

  return rows.find((row) => Number(row.completed_requests || 0) < Number(row.total_requests || 0)) || null;
};

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  const existingInstanceId = await getExistingSignatureFlowInstance(connection, documentVersionId);
  if (existingInstanceId) {
    return {
      ok: true,
      alreadyExists: true,
      signatureFlowInstanceId: existingInstanceId,
    };
  }

  const readiness = await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
  if (!readiness.ok) {
    return {
      ok: false,
      reason: readiness.reason,
      readiness,
    };
  }

  const pendingStatusId = await getSignaturePendingStatusId(connection);
  if (!pendingStatusId) {
    throw new Error("No existe el estado Pendiente en signature_request_statuses.");
  }

  const [insertInstanceResult] = await connection.query(
    `INSERT INTO signature_flow_instances (
       template_id,
       document_version_id,
       status_id
     ) VALUES (?, ?, ?)`,
    [readiness.signatureFlowTemplate.id, documentVersionId, pendingStatusId]
  );
  const signatureFlowInstanceId = Number(insertInstanceResult.insertId);

  for (const step of readiness.steps) {
    if (!step.assignees.length) {
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

    for (const assignedPersonId of step.assignees) {
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

  await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de firma");
  return {
    ok: true,
    signatureFlowInstanceId,
    readiness,
  };
};

export const registerSignatureEvidence = async ({ connection, context, result }) => {
  if (!context?.user?.id) {
    throw new Error("Usuario autenticado inválido para registrar la firma.");
  }

  let signatureRequest = null;
  if (context.signatureRequestId) {
    signatureRequest = await getSignatureRequestContext(connection, Number(context.signatureRequestId));
    if (!signatureRequest) {
      throw new Error("La solicitud de firma indicada no existe.");
    }
    if (Number(signatureRequest.assigned_person_id || 0) !== Number(context.user.id)) {
      throw new Error("No puedes registrar una firma para una solicitud asignada a otro usuario.");
    }
    if (
      context.documentVersionId
      && Number(signatureRequest.document_version_id) !== Number(context.documentVersionId)
    ) {
      throw new Error("La solicitud de firma no pertenece a la versión documental indicada.");
    }
  }

  const documentVersionId = Number(
    context.documentVersionId || signatureRequest?.document_version_id || 0
  );
  if (!documentVersionId) {
    throw new Error("No se pudo determinar la versión documental firmada.");
  }

  const signatureStatusCode = deriveSignatureStatusCode(result);
  const signatureStatusId = await getSignatureStatusIdByCode(connection, signatureStatusCode);
  if (!signatureStatusId) {
    throw new Error(`No existe el estado técnico de firma '${signatureStatusCode}'.`);
  }

  const signatureTypeId = signatureRequest?.step_type_id
    ? Number(signatureRequest.step_type_id)
    : await getDefaultSignatureTypeId(connection);
  if (!signatureTypeId) {
    throw new Error("No existe un tipo de firma disponible para registrar la evidencia.");
  }

  if (result?.finalPath) {
    await connection.query(
      `UPDATE document_versions
       SET final_file_path = ?
       WHERE id = ?`,
      [String(result.finalPath), documentVersionId]
    );
  }

  if (signatureRequest?.id) {
    const requestStatusCode = deriveSignatureRequestStatusCode(signatureStatusCode);
    const requestStatusId = await getSignatureRequestStatusIdByCode(connection, requestStatusCode);
    if (!requestStatusId) {
      throw new Error(`No existe el estado de solicitud de firma '${requestStatusCode}'.`);
    }
    await connection.query(
      `UPDATE signature_requests
       SET status_id = ?,
           responded_at = ?
       WHERE id = ?`,
      [requestStatusId, new Date(), Number(signatureRequest.id)]
    );
  }

  const noteShort = truncateNote(
    result?.validation?.warning
    || result?.validation?.details
    || result?.message
  );

  const [insertResult] = await connection.query(
    `INSERT INTO document_signatures (
       signature_request_id,
       document_version_id,
       signer_user_id,
       signature_type_id,
       signature_status_id,
       note_short,
       signed_file_path,
       signed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signatureRequest?.id ? Number(signatureRequest.id) : null,
      documentVersionId,
      Number(context.user.id),
      Number(signatureTypeId),
      Number(signatureStatusId),
      noteShort,
      result?.finalPath ? String(result.finalPath) : null,
      new Date(),
    ]
  );

  await syncDocumentProgressFromDocumentSignature(connection, Number(insertResult.insertId));

  return {
    documentSignatureId: Number(insertResult.insertId),
    documentVersionId,
    signatureRequestId: signatureRequest?.id ? Number(signatureRequest.id) : null,
    signatureStatusCode,
  };
};

export const getSignatureFlowSnapshot = async ({ connection, documentVersionId, userId }) => {
  const readiness = await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
  const snapshot = {
    documentVersionId,
    readiness,
    signatureFlow: null,
    signatureSteps: readiness.steps,
    signatureRequests: [],
    currentSignatureStepOrder: null,
    responsableActual: null,
    canOperate: false,
  };

  const [instanceRows] = await connection.query(
    `SELECT
       sfi.id,
       sfi.template_id,
       srs.code AS status_code,
       sfi.created_at
     FROM signature_flow_instances sfi
     INNER JOIN signature_request_statuses srs ON srs.id = sfi.status_id
     WHERE sfi.document_version_id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  if (!instanceRows.length) {
    return snapshot;
  }

  const instance = instanceRows[0];
  snapshot.signatureFlow = {
    id: Number(instance.id),
    templateId: Number(instance.template_id),
    statusCode: instance.status_code,
    createdAt: instance.created_at,
  };

  const [requestRows] = await connection.query(
    `SELECT
       sr.id,
       sr.assigned_person_id,
       sr.is_manual,
       sr.requested_at,
       sr.responded_at,
       sfs.id AS step_id,
       sfs.step_order,
       sfs.required_cargo_id,
       srs.code AS request_status_code,
       ss.code AS signature_status_code,
       p.first_name,
       p.last_name,
       c.name AS cargo_name
     FROM signature_requests sr
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = sr.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     LEFT JOIN persons p ON p.id = sr.assigned_person_id
     LEFT JOIN cargos c ON c.id = sfs.required_cargo_id
     WHERE sr.instance_id = ?
     ORDER BY sfs.step_order ASC, sr.id ASC`,
    [Number(instance.id)]
  );

  const pendingStatusCodes = new Set([
    SIGNATURE_REQUEST_STATUS.PENDING,
    SIGNATURE_REQUEST_STATUS.IN_PROGRESS,
  ]);
  const completedStatusCode = SIGNATURE_REQUEST_STATUS.COMPLETED;

  for (const row of requestRows) {
    const assignedPersonId = Number(row.assigned_person_id || 0);
    const assignedPerson = assignedPersonId
      ? {
        id: assignedPersonId,
        firstName: String(row.first_name || "").trim() || null,
        lastName: String(row.last_name || "").trim() || null,
      }
      : null;
    const requestStatusCode = String(row.request_status_code || "").trim().toLowerCase();
    snapshot.signatureRequests.push({
      id: Number(row.id),
      stepId: Number(row.step_id),
      stepOrder: Number(row.step_order),
      requestStatusCode,
      signatureStatusCode: String(row.signature_status_code || "").trim() || null,
      isManual: Boolean(Number(row.is_manual || 0)),
      assignedPerson,
      cargoName: String(row.cargo_name || "").trim() || null,
      requestedAt: row.requested_at,
      respondedAt: row.responded_at,
    });

    if (snapshot.currentSignatureStepOrder === null && requestStatusCode !== completedStatusCode) {
      snapshot.currentSignatureStepOrder = Number(row.step_order);
    }

    if (
      !snapshot.responsableActual
      && pendingStatusCodes.has(requestStatusCode)
      && assignedPerson
    ) {
      snapshot.responsableActual = assignedPerson;
    }

    if (pendingStatusCodes.has(requestStatusCode) && Number(userId || 0) === assignedPersonId) {
      snapshot.canOperate = true;
    }
  }

  return snapshot;
};

export const syncDocumentProgressFromSignatureRequest = async (connection, signatureRequestId) => {
  const [contextRows] = await connection.query(
    `SELECT
       sr.id,
       sr.instance_id,
       sfi.document_version_id
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     WHERE sr.id = ?
     LIMIT 1`,
    [signatureRequestId]
  );
  const context = contextRows?.[0];
  if (!context) return null;

  const [rows] = await connection.query(
    `SELECT
       sr.id,
       sfs.step_order,
       srs.code AS request_status_code,
       ss.code AS signature_status_code
     FROM signature_requests sr
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     INNER JOIN signature_request_statuses srs ON srs.id = sr.status_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = sr.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     WHERE sr.instance_id = ?
     ORDER BY sfs.step_order ASC, sr.id ASC`,
    [context.instance_id]
  );
  if (!rows.length) return null;

  const stepSummaries = summarizeSignatureRequests(rows);
  const anyRejected = stepSummaries.some((item) => item.hasRejected);
  const allApproved = stepSummaries.length > 0 && stepSummaries.every((item) => item.approved);
  const anyApproved = stepSummaries.some((item) => item.approved);
  const anyActive = stepSummaries.some((item) => item.hasActive);

  let instanceStatusCode = SIGNATURE_REQUEST_STATUS.PENDING;
  if (allApproved) instanceStatusCode = SIGNATURE_REQUEST_STATUS.COMPLETED;
  else if (anyActive || anyApproved) instanceStatusCode = SIGNATURE_REQUEST_STATUS.IN_PROGRESS;
  else if (anyRejected) instanceStatusCode = SIGNATURE_REQUEST_STATUS.REJECTED;

  const [statusRows] = await connection.query(
    `SELECT id
     FROM signature_request_statuses
     WHERE LOWER(code) = ?
     ORDER BY id ASC
     LIMIT 1`,
    [normalizeCode(instanceStatusCode)]
  );
  if (statusRows?.[0]?.id) {
    await connection.query(
      `UPDATE signature_flow_instances
       SET status_id = ?
       WHERE id = ?`,
      [Number(statusRows[0].id), context.instance_id]
    );
  }

  if (allApproved) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Firmado completo");
    await finalizeDocumentVersionIfComplete(connection, Number(context.document_version_id));
  } else if (anyApproved || anyActive) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Firmado parcial");
  } else {
    const current = await getDocumentVersionCurrentStatus(connection, Number(context.document_version_id));
    if (current === "Listo para firma") {
      await transitionDocumentVersionState(connection, Number(context.document_version_id), "Pendiente de firma");
    }
  }

  return {
    documentVersionId: Number(context.document_version_id),
    signatureFlowInstanceId: Number(context.instance_id),
    instanceStatusCode,
  };
};

const getDocumentVersionCurrentStatus = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT status
     FROM document_versions
     WHERE id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return normalizeDocumentVersionStatus(rows?.[0]?.status);
};

const finalizeDocumentVersionIfComplete = async (connection, documentVersionId) => {
  const currentStatus = await getDocumentVersionCurrentStatus(connection, documentVersionId);
  if (currentStatus === "Firmado completo") {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Final");
    return true;
  }
  return false;
};

export const syncDocumentProgressFromDocumentVersionSignatureSummary = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       ds.id,
       ss.code AS signature_status_code
     FROM document_signatures ds
     LEFT JOIN signature_statuses ss ON ss.id = ds.signature_status_id
     WHERE ds.document_version_id = ?
     ORDER BY ds.id ASC`,
    [documentVersionId]
  );

  const successCount = rows.filter((row) => DOC_SIGNATURE_SUCCESS.has(normalizeCode(row.signature_status_code))).length;
  if (!successCount) {
    return null;
  }

  const [requestRows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     WHERE sfi.document_version_id = ?`,
    [documentVersionId]
  );
  const totalRequests = Number(requestRows?.[0]?.total || 0);

  if (totalRequests > 0 && successCount >= totalRequests) {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado completo");
    await finalizeDocumentVersionIfComplete(connection, Number(documentVersionId));
  } else {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado parcial");
  }

  return {
    documentVersionId: Number(documentVersionId),
    successCount,
    totalRequests,
  };
};

export const syncDocumentProgressFromDocumentSignature = async (connection, documentSignatureId) => {
  const [rows] = await connection.query(
    `SELECT
       ds.id,
       ds.document_version_id,
       ds.signature_request_id,
       ss.code AS signature_status_code
     FROM document_signatures ds
     LEFT JOIN signature_statuses ss ON ss.id = ds.signature_status_id
     WHERE ds.id = ?
     LIMIT 1`,
    [documentSignatureId]
  );
  const signature = rows?.[0];
  if (!signature) return null;

  if (signature.signature_request_id) {
    await syncDocumentProgressFromSignatureRequest(connection, Number(signature.signature_request_id));
  }

  if (DOC_SIGNATURE_SUCCESS.has(normalizeCode(signature.signature_status_code))) {
    await syncDocumentProgressFromDocumentVersionSignatureSummary(connection, Number(signature.document_version_id));
  }

  return {
    documentVersionId: Number(signature.document_version_id),
    signatureRequestId: signature.signature_request_id ? Number(signature.signature_request_id) : null,
  };
};
