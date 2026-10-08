// EXPERIMENTO F7 (2026-10-06) · FLUJO: rehacer un documento desde cero.
// Cruza TRES dominios y por eso no vive en ninguno: cancela el llenado (`plantillas`), cancela la
// firma (`firmas`) y abre una ronda nueva (`tareas`). Todo dentro de la MISMA transaccion, que abre
// quien llama y llega por parametro.
//
// REGLA DEL EXPERIMENTO: aqui NO hay SQL. Cada consulta vive en el `datos/` de su dominio y este
// fichero solo decide el orden y las reglas.
import { conTransaccion } from "../config/postgres.js";
import { ensureFillFlowForDocumentVersion } from "../services/admin/TaskGenerationService.js";
import { transitionDocumentVersionState } from "../services/documents/DocumentStateService.js";
import { ESTADO_RECORRIDO } from "../services/documents/DocumentWorkflowCatalog.js";
import { resolveCurrentSignatureStep } from "../services/documents/DocumentSignatureWorkflowService.js";
import {
  getMaxDocumentVersionForTaskItem,
  insertDocumentVersion,
} from "../dominios/tareas/datos/documentVersions.js";
// La lectura que CRUZA a `procesos` vive aparte, en la subcapa: la comprobación E la sacó de `datos/`
// al integrar este piloto, porque esa regla llegó después de escribirlo.
import { getLatestDocumentVersionForTaskItem } from "../dominios/tareas/datos/consulta/ultimaVersionDelEntregable.js";
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

  // El codigo se pasa tal cual: ya no hay catalogo que resolver (fase 3 del frente 24), asi que
  // tampoco hay un "no existe ese estado" que comprobar. Lo valida el CHECK de la columna.
  await cancelSignatureRequestsOfInstance(connection, instanceId, ESTADO_RECORRIDO.CANCELADO);
  await cancelSignatureInstance(connection, instanceId, ESTADO_RECORRIDO.CANCELADO);
};

const createResetDocumentVersion = async (connection, currentVersion) => {
  // La RONDA siguiente, entera. Reiniciar no es corregir: se cancela el intento anterior con todo lo
  // que llevaba dentro y se abre otro. El segundo digito arranca en 0 y lo mueve la primera subida.
  const nextVersion = (await getMaxDocumentVersionForTaskItem(connection, currentVersion.task_item_id)) + 1;

  const id = await insertDocumentVersion(connection, {
    taskItemId: Number(currentVersion.task_item_id),
    version: nextVersion,
    templateArtifactId: currentVersion.edicion_id ?? null,
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

// REHACER el flujo de un entregable, CON SU TRANSACCIÓN.
//
// ⚠️ ESTO LLEGÓ DESPUÉS DEL PILOTO, y por eso hay que decir de dónde viene: lo añadió F7.2 en el
// servicio que este fichero sustituye, y al integrar el piloto —28 commits más tarde— habría
// desaparecido si se hubiera tomado la rama tal cual. **La frontera de transacción la abrían DOS
// controllers con el mismo código copiado**: el del responsable
// (`user_controler.resetDeliverableWorkflow`) y el del jefe de unidad
// (`supervision_controler.supervisorResetTaskItemWorkflow`). La diferencia real entre ellos es UN
// booleano —`bypassStepOwnership`—, no la atomicidad.
//
// Y encaja con la regla del flujo: la transacción **la abre quien llama**. Aquí «quien llama» es
// esta función, que existe precisamente para que no la abra un controller.
export const rehacerFlujoDelEntregable = async ({
  userId,
  definitionId,
  taskItemId,
  documentId = null,
  bypassStepOwnership = false,
}) =>
  conTransaccion((conexion) =>
    resetDocumentWorkflowForTaskItem({
      connection: conexion,
      userId,
      definitionId,
      taskItemId,
      documentId,
      bypassStepOwnership,
    })
  );
