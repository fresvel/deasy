// EXPERIMENTO F7 (2026-10-06) · FLUJO: rehacer un documento desde cero.
//
// ⚠️ NACIO CRUZANDO TRES DOMINIOS --`plantillas` por el llenado, `firmas` por la firma y `tareas`
// por la ronda nueva-- Y HOY CRUZA UNO. No se arreglo nada aqui: la fase 4 del frente 24 unifico las
// dos EJECUCIONES en `recorridos` y `turnos`, que son de `tareas`, asi que lo que antes eran dos
// mecanismos de dos dominios es ahora el mismo mecanismo con dos valores de `accion`.
//
// Por la regla del mapa, un flujo que escribe un solo dominio deja de ser un flujo y se mueve a el
// --y la puerta lo avisa--. DONDE va es la decision de F7.5, que es la que mueve `tareas` a su
// dominio; mientras tanto se queda aqui y la declaracion de `_flujos` dice la verdad.
//
// Todo dentro de la MISMA transaccion, que abre quien llama y llega por parametro.
//
// REGLA DEL EXPERIMENTO: aqui NO hay SQL. Cada consulta vive en el `datos/` de su dominio y este
// fichero solo decide el orden y las reglas.
import { conTransaccion } from "../config/postgres.js";
import { ensureFillFlowForDocumentVersion } from "../services/admin/TaskGenerationService.js";
import { transitionDocumentVersionState } from "../services/documents/DocumentStateService.js";
import { ESTADO_RECORRIDO } from "../services/documents/DocumentWorkflowCatalog.js";
import {
  getMaxDocumentVersionForTaskItem,
  insertDocumentVersion,
} from "../dominios/tareas/datos/documentVersions.js";
// La lectura que CRUZA a `procesos` vive aparte, en la subcapa: la comprobación E la sacó de `datos/`
// al integrar este piloto, porque esa regla llegó después de escribirlo.
import { getLatestDocumentVersionForTaskItem } from "../dominios/tareas/datos/consulta/ultimaVersionDelEntregable.js";
import {
  buscarRecorrido,
  cancelarRecorrido,
  cancelarTurnosAbiertos,
  turnoAbiertoDelUsuarioEnPasoActual,
} from "../dominios/tareas/index.js";
// AQUI SE IMPORTABA `dominios/firmas/datos/flujoDeFirma.js`, con las cuatro funciones de la
// ejecucion de FIRMA. Se disolvio en el paso 3b de la fase 4: la ejecucion ya no es de ese dominio
// --`recorridos` y `turnos` son de `tareas`-- y sus cuatro preguntas eran las mismas que las de
// entrega. Viven una sola vez, arriba.
//
// Y con eso este flujo deja de cruzar `firmas`: cancela DOS RECORRIDOS del mismo dominio.

const RESET_NOTE = "Reset manual del flujo";

// UNA FUNCION PARA LOS DOS LADOS desde la fase 4 del frente 24: cancelar un recorrido es cancelar
// sus turnos abiertos y marcarlo. Eran dos, una por mitad, con el mismo cuerpo.
const cancelarRecorridoAbierto = async (connection, documentVersionId, accion) => {
  const recorrido = await buscarRecorrido(connection, documentVersionId, accion);
  if (!recorrido) {
    return;
  }
  await cancelarTurnosAbiertos(connection, Number(recorrido.id), ESTADO_RECORRIDO.CANCELADO, RESET_NOTE);
  await cancelarRecorrido(connection, Number(recorrido.id), ESTADO_RECORRIDO.CANCELADO);
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
    : await turnoAbiertoDelUsuarioEnPasoActual(connection, documentVersionId, "entrega", userId);
  // MISMA FUNCION QUE LA DE ENTREGA, con otra accion. Antes la de firma era un ayudante local que
  // resolvia el paso actual a mano porque la instancia de firma no guardaba `paso_actual`; el
  // recorrido unificado lleva esa columna en los dos lados, asi que la pregunta es una.
  const signatureOwnership = bypassStepOwnership
    ? null
    : await turnoAbiertoDelUsuarioEnPasoActual(connection, documentVersionId, "firma", userId);
  if (!bypassStepOwnership && !fillOwnership && !signatureOwnership) {
    const error = new Error(
      "Solo el responsable del paso actual de entrega o firma puede resetear este flujo."
    );
    error.statusCode = 403;
    throw error;
  }

  await cancelarRecorridoAbierto(connection, documentVersionId, "entrega");
  await cancelarRecorridoAbierto(connection, documentVersionId, "firma");
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
