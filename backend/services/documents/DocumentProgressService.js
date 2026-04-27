import {
  transitionDocumentVersionState,
  normalizeDocumentVersionStatus,
} from "./DocumentStateService.js";
import { ensureSignatureFlowForDocumentVersion } from "./DocumentSignatureWorkflowService.js";
export {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromDocumentVersionSignatureSummary,
  syncDocumentProgressFromSignatureRequest,
} from "./DocumentSignatureWorkflowService.js";

const normalizeCode = (value) => String(value || "").trim().toLowerCase();

const FILL_PENDING = new Set(["pending"]);
const FILL_ACTIVE = new Set(["in_progress"]);
const FILL_APPROVED = new Set(["approved"]);
const FILL_REJECTED = new Set(["rejected", "returned"]);

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
    const signatureFlowResult = await ensureSignatureFlowForDocumentVersion(
      connection,
      Number(context.document_version_id)
    );
    if (signatureFlowResult && !signatureFlowResult.ok) {
      console.info(
        `[DocumentProgressService] DocumentVersion ${context.document_version_id} cannot enter signature: ${signatureFlowResult.reason}`
      );
    }
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
