import {
  transitionDocumentVersionState,
  normalizeDocumentVersionStatus,
} from "./DocumentStateService.js";
import { ensureSignatureFlowForDocumentVersion } from "../admin/TaskGenerationService.js";
import {
  SIGNATURE_REQUEST_STATUS,
  SIGNATURE_STATUS,
} from "./DocumentWorkflowCatalog.js";

const normalizeCode = (value) => String(value || "").trim().toLowerCase();

const FILL_PENDING = new Set(["pending"]);
const FILL_ACTIVE = new Set(["in_progress"]);
const FILL_APPROVED = new Set(["approved"]);
const FILL_REJECTED = new Set(["rejected", "returned"]);

const SIGN_PENDING = new Set([SIGNATURE_REQUEST_STATUS.PENDING]);
const SIGN_ACTIVE = new Set([SIGNATURE_REQUEST_STATUS.IN_PROGRESS]);
const SIGN_APPROVED = new Set([SIGNATURE_REQUEST_STATUS.COMPLETED]);
const SIGN_REJECTED = new Set([SIGNATURE_REQUEST_STATUS.REJECTED, SIGNATURE_REQUEST_STATUS.CANCELLED]);

const DOC_SIGNATURE_SUCCESS = new Set([SIGNATURE_STATUS.SIGNED]);

const firstPendingStepOrder = (stepSummaries) => {
  const candidate = stepSummaries.find((item) => !item.approved);
  return candidate ? Number(candidate.stepOrder) : null;
};

const arePreviousStepsApproved = (stepSummaries, stepOrder) =>
  stepSummaries
    .filter((item) => Number(item.stepOrder) < Number(stepOrder))
    .every((item) => item.approved);

const summarizeFillRequests = (rows) => {
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
    const code = normalizeCode(row.request_status);
    if (FILL_APPROVED.has(code)) summary.approvedCount += 1;
    else if (FILL_REJECTED.has(code)) summary.rejectedCount += 1;
    else if (FILL_ACTIVE.has(code)) summary.activeCount += 1;
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

const getCurrentDocumentVersionStatus = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT status
     FROM document_versions
     WHERE id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return normalizeDocumentVersionStatus(rows?.[0]?.status);
};

export const syncDocumentProgressFromFillRequest = async (connection, fillRequestId) => {
  const [contextRows] = await connection.query(
    `SELECT
       fr.id,
       fr.document_fill_flow_id,
       dff.document_version_id
     FROM fill_requests fr
     INNER JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
     WHERE fr.id = ?
     LIMIT 1`,
    [fillRequestId]
  );
  const context = contextRows?.[0];
  if (!context) return null;

  const [rows] = await connection.query(
    `SELECT
       fr.id,
       fr.status AS request_status,
       ffs.step_order
     FROM fill_requests fr
     INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
     WHERE fr.document_fill_flow_id = ?
     ORDER BY ffs.step_order ASC, fr.id ASC`,
    [context.document_fill_flow_id]
  );
  if (!rows.length) return null;

  let stepSummaries = summarizeFillRequests(rows);
  let nextStepOrder = firstPendingStepOrder(stepSummaries);

  if (nextStepOrder && arePreviousStepsApproved(stepSummaries, nextStepOrder)) {
    const currentStepRows = rows.filter((row) => Number(row.step_order) === Number(nextStepOrder));
    const allReturned = currentStepRows.length > 0 && currentStepRows.every((row) => normalizeCode(row.request_status) === "returned");
    if (allReturned) {
      await connection.query(
        `UPDATE fill_requests fr
         INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
         SET fr.status = 'pending',
             fr.responded_at = NULL
         WHERE fr.document_fill_flow_id = ?
           AND ffs.step_order = ?
           AND fr.status = 'returned'`,
        [context.document_fill_flow_id, nextStepOrder]
      );

      const [refreshedRows] = await connection.query(
        `SELECT
           fr.id,
           fr.status AS request_status,
           ffs.step_order
         FROM fill_requests fr
         INNER JOIN fill_flow_steps ffs ON ffs.id = fr.fill_flow_step_id
         WHERE fr.document_fill_flow_id = ?
         ORDER BY ffs.step_order ASC, fr.id ASC`,
        [context.document_fill_flow_id]
      );
      rows.splice(0, rows.length, ...refreshedRows);
      stepSummaries = summarizeFillRequests(rows);
      nextStepOrder = firstPendingStepOrder(stepSummaries);
    }
  }

  const effectiveStepSummaries = nextStepOrder
    ? stepSummaries.filter((item) => Number(item.stepOrder) <= Number(nextStepOrder))
    : stepSummaries;

  const anyRejected = effectiveStepSummaries.some((item) => item.hasRejected);
  const allApproved = stepSummaries.length > 0 && stepSummaries.every((item) => item.approved);
  const anyActive = effectiveStepSummaries.some((item) => item.hasActive);

  let flowStatus = "pending";
  if (anyRejected) flowStatus = "rejected";
  else if (allApproved) flowStatus = "approved";
  else if (anyActive) flowStatus = "in_progress";

  await connection.query(
    `UPDATE document_fill_flows
     SET status = ?,
         current_step_order = ?
     WHERE id = ?`,
    [flowStatus, nextStepOrder, context.document_fill_flow_id]
  );

  if (anyRejected) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Observado");
  } else if (allApproved) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Listo para firma");
    await ensureSignatureFlowForDocumentVersion(connection, Number(context.document_version_id));
  } else if (anyActive) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "En llenado");
  } else {
    const currentStatus = await getCurrentDocumentVersionStatus(connection, Number(context.document_version_id));
    if (!["En llenado", "En revisión de llenado"].includes(currentStatus)) {
      await transitionDocumentVersionState(connection, Number(context.document_version_id), "Pendiente de llenado");
    }
  }

  return {
    documentVersionId: Number(context.document_version_id),
    documentFillFlowId: Number(context.document_fill_flow_id),
    flowStatus,
    nextStepOrder,
  };
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
  } else if (anyApproved || anyActive) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Firmado parcial");
  } else {
    const current = await getCurrentDocumentVersionStatus(connection, Number(context.document_version_id));
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
  } else {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado parcial");
  }

  return {
    documentVersionId: Number(documentVersionId),
    successCount,
    totalRequests,
  };
};
