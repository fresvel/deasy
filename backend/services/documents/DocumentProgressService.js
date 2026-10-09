import {
  transitionDocumentVersionState,
  normalizeDocumentVersionStatus,
} from "./DocumentStateService.js";
import { ensureSignatureFlowForDocumentVersion } from "./DocumentSignatureWorkflowService.js";
import {
  actualizarAvanceDelRecorrido,
  idsDeTurnosDelPaso,
  leerTurnosDelRecorrido,
  reabrirTurnos,
} from "../../dominios/tareas/index.js";
export {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromDocumentVersionSignatureSummary,
  syncDocumentProgressFromSignatureRequest,
} from "./DocumentSignatureWorkflowService.js";

const normalizeCode = (value) => String(value || "").trim().toLowerCase();

const FILL_PENDING = new Set(["pendiente"]);
const FILL_ACTIVE = new Set(["en_progreso"]);
const FILL_APPROVED = new Set(["completado"]);
const FILL_REJECTED = new Set(["rechazado", "devuelto"]);

const firstPendingStepOrder = (stepSummaries) => {
  const candidate = stepSummaries.find((item) => !item.approved);
  return candidate ? Number(candidate.stepOrder) : null;
};

const arePreviousStepsApproved = (stepSummaries, stepOrder) =>
  stepSummaries
    .filter((item) => Number(item.stepOrder) < Number(stepOrder))
    .every((item) => item.approved);

// El resumen POR PASO: cuantos turnos lleva y como van. Lee `turnos` --la tabla unificada-- y el
// orden lo trae el paso declarado, no la solicitud.
const summarizeFillRequests = (rows) => {
  const byStep = new Map();
  for (const row of rows) {
    const stepOrder = Number(row.paso_orden);
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
    const code = normalizeCode(row.estado);
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

export const syncDocumentProgressFromFillRequest = async (connection, turnoId) => {
  const [contextRows] = await connection.query(
    `SELECT t.id, t.recorrido_id, r.document_version_id
       FROM turnos t
       INNER JOIN recorridos r ON r.id = t.recorrido_id
      WHERE t.id = ?
      LIMIT 1`,
    [turnoId]
  );
  const context = contextRows?.[0];
  if (!context) return null;

  let rows = await leerTurnosDelRecorrido(connection, Number(context.recorrido_id));
  if (!rows.length) return null;

  let stepSummaries = summarizeFillRequests(rows);
  let nextStepOrder = firstPendingStepOrder(stepSummaries);

  if (nextStepOrder && arePreviousStepsApproved(stepSummaries, nextStepOrder)) {
    const currentStepRows = rows.filter((row) => Number(row.paso_orden) === Number(nextStepOrder));
    const allReturned = currentStepRows.length > 0 && currentStepRows.every((row) => normalizeCode(row.estado) === "devuelto");
    if (allReturned) {
      // Dos pasos: los ids los resuelve la consulta que cruza, la escritura recibe ids.
      await reabrirTurnos(
        connection,
        await idsDeTurnosDelPaso(connection, Number(context.recorrido_id), nextStepOrder, { soloDevueltos: true }),
        // La nota se CONSERVA: es el motivo por el que el paso volvio, y quien lo rehaga lo necesita.
        { conservarNota: true }
      );
      rows = await leerTurnosDelRecorrido(connection, Number(context.recorrido_id));
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

  let flowStatus = "pendiente";
  if (anyRejected) flowStatus = "rechazado";
  else if (allApproved) flowStatus = "completado";
  else if (anyActive) flowStatus = "en_progreso";

  await actualizarAvanceDelRecorrido(connection, Number(context.recorrido_id), flowStatus, nextStepOrder);

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
    recorridoId: Number(context.recorrido_id),
    flowStatus,
    nextStepOrder,
  };
};
