// EXPERIMENTO F7 (2026-10-06) · FLUJO: rehacer un documento desde cero.
// Cruza TRES dominios y por eso no vive en ninguno: cancela el llenado (`plantillas`), cancela la
// firma (`firmas`) y abre una ronda nueva (`tareas`). Todo dentro de la MISMA transaccion, que abre
// quien llama y llega por parametro.
//
// REGLA DEL EXPERIMENTO: aqui NO hay SQL. Cada consulta vive en el `datos/` de su dominio y este
// fichero solo decide el orden y las reglas.
import { ensureFillFlowForDocumentVersion } from "../services/admin/TaskGenerationService.js";
import { transitionDocumentVersionState } from "../services/documents/DocumentStateService.js";
import {
  getSignatureRequestStatusIdByCode,
  SIGNATURE_REQUEST_STATUS,
} from "../services/documents/DocumentWorkflowCatalog.js";
import { resolveCurrentSignatureStep } from "../services/documents/DocumentSignatureWorkflowService.js";
import {
  getLatestDocumentVersionForTaskItem,
  getMaxDocumentVersionForTaskItem,
  insertDocumentVersion,
} from "../dominios/tareas/datos/documentVersions.js";
import {
  cancelFillFlow,
  cancelFillRequestsOfFlow,
  findFillFlowIdByDocumentVersion,
  getCurrentFillOwnership,
} from "../dominios/plantillas/datos/flujoDeLlenado.js";
import {
  cancelSignatureInstance,
  cancelSignatureRequestsOfInstance,
  findSignatureInstanceIdByDocumentVersion,
  getSignatureOwnershipAtStep,
} from "../dominios/firmas/datos/flujoDeFirma.js";

const RESET_NOTE = "Reset manual del flujo";

const getCurrentSignatureOwnership = async (connection, documentVersionId, userId) => {
  const currentStep = await resolveCurrentSignatureStep(connection, documentVersionId);
  if (!currentStep?.stepOrder) {
    return null;
  }
  return getSignatureOwnershipAtStep(connection, documentVersionId, Number(currentStep.stepOrder), userId);
};

const cancelOpenFillRequests = async (connection, documentVersionId) => {
  const flowId = await findFillFlowIdByDocumentVersion(connection, documentVersionId);
  if (!flowId) {
    return;
  }
  await cancelFillRequestsOfFlow(connection, flowId, RESET_NOTE);
  await cancelFillFlow(connection, flowId);
};

const cancelOpenSignatureRequests = async (connection, documentVersionId) => {
  const instanceId = await findSignatureInstanceIdByDocumentVersion(connection, documentVersionId);
  if (!instanceId) {
    return;
  }

  const cancelledStatusId = await getSignatureRequestStatusIdByCode(
    connection,
    SIGNATURE_REQUEST_STATUS.CANCELLED
  );
  if (!cancelledStatusId) {
    throw new Error("No existe el estado cancelado para solicitudes de firma.");
  }

  await cancelSignatureRequestsOfInstance(connection, instanceId, cancelledStatusId);
  await cancelSignatureInstance(connection, instanceId, cancelledStatusId);
};

const createResetDocumentVersion = async (connection, currentVersion) => {
  // La RONDA siguiente, entera. Reiniciar no es corregir: se cancela el intento anterior con todo lo
  // que llevaba dentro y se abre otro. El segundo digito arranca en 0 y lo mueve la primera subida.
  const nextVersion = (await getMaxDocumentVersionForTaskItem(connection, currentVersion.task_item_id)) + 1;

  const id = await insertDocumentVersion(connection, {
    taskItemId: Number(currentVersion.task_item_id),
    version: nextVersion,
    templateArtifactId: currentVersion.template_artifact_id ?? null,
    payloadHash: currentVersion.payload_hash ?? null,
    payloadObjectPath: currentVersion.payload_object_path ?? null,
    workingFilePath: null,
    finalFilePath: null,
    format: currentVersion.format ?? null,
    renderEngine: currentVersion.render_engine ?? null,
    status: "Borrador",
  });

  return { id, version: nextVersion };
};

export const resetDocumentWorkflowForTaskItem = async ({
  connection,
  userId,
  definitionId,
  taskItemId,
  documentId = null,
  bypassStepOwnership = false,
}) => {
  const currentVersion = await getLatestDocumentVersionForTaskItem(connection, definitionId, taskItemId, documentId);
  if (!currentVersion?.document_version_id) {
    const error = new Error("No se encontró una versión documental activa para ese entregable.");
    error.statusCode = 404;
    throw error;
  }

  const documentVersionId = Number(currentVersion.document_version_id);
  // ⚠️ `bypassStepOwnership` LO USA UNA SOLA COSA: el panel de supervision del jefe de unidad, y
  // existe porque este guard tiene un punto ciego que se midio (DR1, 2026-08-23).
  //
  // El guard exige ser EL TITULAR DEL PASO ACTUAL, y lo comprueba contra QUIEN LLAMA. Asi que si la
  // persona que se fue es justo quien tenia el paso, no puede reiniciar NADIE: ni el relevo lo mueve
  // (esta en fase de firma) ni el reset lo abre. Ni un administrador, porque la ruta admite roles
  // elevados pero el servicio sigue mirando al que llama. El entregable queda parado para siempre.
  //
  // Quien lo desatasca es el jefe de la unidad, y su legitimidad NO es este guard sino el alcance:
  // `assertSupervisesTaskItem` ya comprobo que el entregable cae en una unidad que encabeza. Por eso
  // se salta este y no se relaja: son dos permisos distintos, no uno mas laxo.
  const fillOwnership = bypassStepOwnership
    ? null
    : await getCurrentFillOwnership(connection, documentVersionId, userId);
  const signatureOwnership = bypassStepOwnership
    ? null
    : await getCurrentSignatureOwnership(connection, documentVersionId, userId);
  if (!bypassStepOwnership && !fillOwnership && !signatureOwnership) {
    const error = new Error(
      "Solo el responsable del paso actual de entrega o firma puede resetear este flujo."
    );
    error.statusCode = 403;
    throw error;
  }

  await cancelOpenFillRequests(connection, documentVersionId);
  await cancelOpenSignatureRequests(connection, documentVersionId);
  await transitionDocumentVersionState(connection, documentVersionId, "Cancelado");

  const nextVersion = await createResetDocumentVersion(connection, currentVersion);
  await ensureFillFlowForDocumentVersion(connection, nextVersion.id);

  return {
    documentId: Number(currentVersion.task_item_id),
    previousDocumentVersionId: documentVersionId,
    previousDocumentVersion: Number(currentVersion.document_version || 0),
    newDocumentVersionId: nextVersion.id,
    newDocumentVersion: nextVersion.version,
    resetBy: fillOwnership ? "fill" : "signature",
  };
};
