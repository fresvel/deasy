import {
  normalizeDocumentVersionStatus,
  transitionDocumentVersionState,
} from "./DocumentStateService.js";
import { addDocumentObservation } from "./DocumentObservationService.js";
import {
  ESTADO_RECORRIDO,
  SIGNATURE_STATUS,
  getSignatureStatusIdByCode,
} from "./DocumentWorkflowCatalog.js";
import { resolverReceta } from "../../dominios/plantillas/index.js";
import {
  abrirRecorrido,
  abrirTurno,
  actualizarAvanceDelRecorrido,
  actualizarTurno,
  buscarRecorrido,
  reabrirRecorridoRechazado,
} from "../../dominios/tareas/index.js";
import { resolverPasoCompleto } from "../admin/generation/assignees.js";

// ── LA EJECUCION DE LA FIRMA, SOBRE `recorridos` Y `turnos` (frente 24, fase 4, paso 3b) ────────
//
// Este fichero tenia 1.338 lineas y la mitad era un SEGUNDO motor: su propio resolvedor de receta
// por escalones, su propio resolutor de personas con seis ambitos, su propio lector de pasos y su
// propio convertidor del JSONB `signers`. Todo eso existia por duplicado con el lado de entrega.
//
// Ahora la receta la resuelve `resolverReceta` y las personas `resolverParticipante`, los mismos que
// usa la entrega. Lo que queda aqui es lo UNICO que la firma tiene de propio y la entrega no:
//
//   · el ESTADO TECNICO de la firma (`document_signatures` + `signature_statuses`), que es un eje
//     aparte del estado del turno: un turno puede estar `completado` con una firma tecnicamente
//     INVALIDA, y entonces cuenta como rechazo.
//   · las transiciones del documento que solo existen aqui: «Firmado parcial», «Firmado completo»,
//     «Final».
//
// ── AQUI SE CIERRA EL DEFECTO 1.19, y conviene decir que era ────────────────────────────────────
//
// El resolutor de firma leia el JSONB `signature_flow_steps.signers`, que NINGUN `CHECK` cubria y
// que MANDABA sobre las columnas que si lo tenian. Por eso este fichero conservaba resolutores que
// su gemela de entrega ya habia retirado --`document_owner`, `position`, los ambitos `context_*`--:
// no eran ramas muertas, eran la unica defensa contra un valor que la base no podia rechazar.
//
// Con los firmantes EN FILAS (`participantes_declarados`, con sus dos `CHECK`), el valor retirado no
// se puede ni insertar. Los `case` se van porque ya no hay por donde llegar, y la copia de
// versionado deja de propagar lo que nadie validaba.
//
// EFECTO MEDIBLE Y FUERA DE ESTE FICHERO: el disparador del relevo tenia DOS `UPDATE`, y el de firma
// llevaba la guarda `signers::text NOT LIKE '%specific_person%'` --«ante la duda no se mueve»--
// precisamente porque el JSONB podia contradecir a la columna. Hoy el `resolver_type` del
// participante es la verdad, asi que los dos `UPDATE` son UNO y sin guarda defensiva.

const normalizeCode = (value) => String(value || "").trim().toLowerCase();
const SIGN_ACTIVE = new Set([ESTADO_RECORRIDO.EN_PROGRESO]);
const SIGN_APPROVED = new Set([ESTADO_RECORRIDO.COMPLETADO]);
const SIGN_REJECTED = new Set([ESTADO_RECORRIDO.RECHAZADO, ESTADO_RECORRIDO.CANCELADO]);
const DOC_SIGNATURE_SUCCESS = new Set([SIGNATURE_STATUS.SIGNED]);

const getDocumentVersionSignatureContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id AS document_version_id,
       dv.status AS document_version_status,
       dv.working_file_path,
       dv.task_item_id,
       ti.task_id,
       ti.assigned_person_id AS task_item_assigned_person_id,
       ti.vinculo_id,
       ti.responsible_position_id AS task_item_responsible_position_id,
       t.process_definition_id,
       ti.created_by_person_id AS item_created_by_person_id,
       COALESCE(up_item.unit_id, t.scope_unit_id) AS scope_unit_id
     FROM document_versions dv
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     LEFT JOIN tasks t ON t.id = ti.task_id
     LEFT JOIN unit_positions up_item ON up_item.id = ti.responsible_position_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

const shouldInferSignatureFlowForContext = (context) => {
  if (!context?.vinculo_id) {
    return false;
  }

  // usage_role attachment/support y artifact_origin deprecados como gate: toda plantilla de proceso
  // (siempre usage_role='primary') puede tener flujo de firma. Las adjunciones ad-hoc van por
  // document_attachments y no llegan aquí (no crean task_items con vinculo_id).
  return true;
};

// El PASO con sus participantes, proyectado a la forma que el frontend ya consumía. Las claves
// `step_order`/`stepOrder` y `assignees` conservan su nombre a propósito: las lee
// `DeliverableSignatureTab.vue` y `useDeliverableView.js`. Lo que desaparece es lo que se retiró del
// paso (§10 del plan): `approval_mode`, `required_signers_min`/`_max`, `is_required`,
// `selection_mode` y el propio `signers`, que ahora SON los participantes.
const proyectarPaso = (paso, turnos) => ({
  id: Number(paso.id),
  stepOrder: Number(paso.orden),
  step_order: Number(paso.orden),
  code: paso.code,
  name: paso.nombre,
  participantes: paso.participantes,
  assignees: [...new Set(turnos.map((t) => Number(t.personaId)).filter(Boolean))],
});

// LA RECETA DE FIRMA, RESUELTA A PERSONAS. Sustituye a `resolveSignatureTemplateStepsForContext`,
// que hacía esto mismo con su propio lector de pasos y su propio resolutor.
//
// ⚠️ `unresolvedRequiredSteps` SE QUEDA, y es lo que sobrevive de `is_required` (§10). La columna se
// retira porque sus dos valores no eran «obligatorio / opcional»: con `1` el recorrido no abre y lo
// dice; con `0` abría y el paso se quedaba APARCADO con una solicitud sin persona que en firma nadie
// puede atender --y como el paso actual es el primero no aprobado, ése lo era para siempre--. O sea
// un bloqueo silencioso y más tarde. Queda el comportamiento de `1` como único, para TODO paso.
const resolverPasosDeFirma = async (connection, pasos, context) => {
  const unresolvedRequiredSteps = [];
  const resolvedSteps = [];
  for (const paso of pasos) {
    const turnos = await resolverPasoCompleto(connection, paso, context);
    for (const participante of paso.participantes) {
      const suyos = turnos.filter((t) => t.participanteId === participante.id && t.personaId);
      if (!suyos.length) {
        unresolvedRequiredSteps.push({
          stepOrder: Number(paso.orden),
          resolverType: participante.resolverType,
          reason: "no_assignees",
        });
      }
    }
    resolvedSteps.push({ ...proyectarPaso(paso, turnos), turnos });
  }
  return { steps: resolvedSteps, unresolvedRequiredSteps };
};

const truncateNote = (value, max = 255) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const deriveSignatureStatusCode = (result) => {
  const validation = result?.validation || {};
  if (validation?.warningAccepted === true) {
    return SIGNATURE_STATUS.SIGNED;
  }
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
    ? ESTADO_RECORRIDO.COMPLETADO
    : ESTADO_RECORRIDO.PENDIENTE;

// Los turnos de un recorrido CON SU ESTADO TECNICO. Es la unica consulta de este fichero que no
// podria vivir en el lado comun: cruza `turnos` con `document_signatures`, que es el eje propio de
// la firma. `leerTurnosDelRecorrido` no lo trae porque en entrega no existe.
const leerTurnosConSuFirma = async (connection, recorridoId) => {
  const [rows] = await connection.query(
    `SELECT
       tu.id,
       pd.orden AS step_order,
       tu.estado AS request_status_code,
       ss.code AS signature_status_code
     FROM turnos tu
     INNER JOIN participantes_declarados pr ON pr.id = tu.participante_id
     INNER JOIN pasos_declarados pd ON pd.id = pr.paso_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = tu.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     WHERE tu.recorrido_id = ?
     ORDER BY pd.orden ASC, tu.id ASC`,
    [recorridoId]
  );
  return rows;
};

const readRequestStatusCode = (row) =>
  normalizeCode(row?.request_status_code ?? row?.requestStatusCode);

const readSignatureStatusCode = (row) =>
  normalizeCode(row?.signature_status_code ?? row?.signatureStatusCode);

const readStepOrder = (row) => Number(row?.step_order ?? row?.stepOrder);

// UN PASO ESTA APROBADO CUANDO FIRMAN TODOS LOS SUYOS. Y ya no hay un `switch`: el cupo
// (`approval_mode` + `required_signers_min`/`_max`) se retiro entero (§10 del plan).
//
// `or` no era una funcionalidad: el paso se cerraba con una firma y las solicitudes hermanas SEGUIAN
// ABIERTAS --se listaban en el espacio de trabajo de quienes no firmaron y al pincharlas respondian
// «no pertenece al paso actual»--. `at_least` tenia el mismo defecto con un umbral, y
// `required_signers_max` no decidia nada: se seleccionaba, se parseaba y no se leia.
//
// El cupo existia porque el conjunto de firmantes era INDETERMINADO (un cargo con ambito amplio
// resolvia a N personas desconocidas de antemano). Lo que se quita es esa indeterminacion: los
// firmantes son filas declaradas, y se firma el cupo entero.
const isSignatureStepApproved = (summary) => {
  if (!summary || summary.total < 1) {
    return false;
  }
  return summary.approvedCount === summary.total;
};

const summarizeSignatureRequests = (rows) => {
  const byStep = new Map();
  for (const row of rows) {
    const stepOrder = readStepOrder(row);
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
    const code = readRequestStatusCode(row);
    const signatureCode = readSignatureStatusCode(row);
    if (SIGN_APPROVED.has(code)) {
      // DOS EJES: el turno dice «respondio» y la firma dice «vale». Un turno completado con una
      // firma tecnicamente invalida es un RECHAZO, no un paso dado.
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
      approved: isSignatureStepApproved(item),
      hasRejected: item.rejectedCount > 0,
      hasActive: item.activeCount > 0,
      hasPending: item.pendingCount > 0,
    }));
};

// EL CONTEXTO DE UN TURNO DE FIRMA. Las claves conservan su nombre --`instance_id`, `step_id`,
// `step_order`, `assigned_person_id`-- porque las consume `PdfSigningService` y el propio registro de
// evidencia; lo que cambia es de donde salen.
export const getSignatureRequestContext = async (connection, signatureRequestId) => {
  const [rows] = await connection.query(
    `SELECT
       tu.id,
       tu.persona_id AS assigned_person_id,
       tu.recorrido_id AS instance_id,
       pr.paso_id AS step_id,
       r.document_version_id,
       pd.orden AS step_order
     FROM turnos tu
     INNER JOIN recorridos r ON r.id = tu.recorrido_id AND r.accion = 'firma'
     INNER JOIN participantes_declarados pr ON pr.id = tu.participante_id
     INNER JOIN pasos_declarados pd ON pd.id = pr.paso_id
     WHERE tu.id = ?
     LIMIT 1`,
    [signatureRequestId]
  );
  return rows?.[0] || null;
};

export const assertSignatureRequestCanBeSigned = async ({ connection, context }) => {
  if (!context?.signatureRequestId) {
    return null;
  }

  const signatureRequest = await getSignatureRequestContext(connection, Number(context.signatureRequestId));
  if (!signatureRequest) {
    throw new Error("La solicitud de firma indicada no existe.");
  }
  if (Number(signatureRequest.assigned_person_id || 0) !== Number(context.user?.id || 0)) {
    throw new Error("No puedes registrar una firma para una solicitud asignada a otro usuario.");
  }
  if (
    context.documentVersionId
    && Number(signatureRequest.document_version_id) !== Number(context.documentVersionId)
  ) {
    throw new Error("La solicitud de firma no pertenece a la versión documental indicada.");
  }

  const currentStep = await resolveCurrentSignatureStep(connection, Number(signatureRequest.document_version_id));
  if (currentStep && Number(currentStep.stepOrder || 0) !== Number(signatureRequest.step_order || 0)) {
    throw new Error("La solicitud de firma no pertenece al paso actual del flujo.");
  }

  return signatureRequest;
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

  // DOS ESCALONES Y UNA CONSULTA, sin cabecera que buscar: el paso lleva su propio origen. La razon
  // `signature_template_missing` se conserva --viaja en la API y la nombran los goldens-- pero lo que
  // hoy falta no es una cabecera activa: es que no haya ni un paso declarado de esta accion.
  const receta = await resolverReceta(connection, {
    accion: "firma",
    taskItemId: context.task_item_id,
    vinculoId: context.vinculo_id,
  });
  if (!receta.pasos.length) {
    return { ok: false, reason: "signature_template_missing", context, currentStatus };
  }

  const resuelto = await resolverPasosDeFirma(connection, receta.pasos, context);

  if (resuelto.unresolvedRequiredSteps.length) {
    return {
      ok: false,
      reason: "required_signers_unresolved",
      context,
      currentStatus,
      steps: resuelto.steps,
      unresolvedRequiredSteps: resuelto.unresolvedRequiredSteps,
    };
  }

  return {
    ok: true,
    context,
    currentStatus,
    steps: resuelto.steps,
  };
};

export const resolveCurrentSignatureStep = async (connection, documentVersionId) => {
  const recorrido = await buscarRecorrido(connection, documentVersionId, "firma");
  if (!recorrido) {
    return null;
  }

  const stepSummaries = summarizeSignatureRequests(
    await leerTurnosConSuFirma(connection, Number(recorrido.id))
  );
  return stepSummaries.find((row) => !row.approved && !row.hasRejected)
    || stepSummaries.find((row) => !row.approved)
    || null;
};

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  const existing = await buscarRecorrido(connection, documentVersionId, "firma");
  if (existing) {
    // UN RECORRIDO RECHAZADO SE REABRE, no se ignora. Es la otra mitad del arreglo del atasco
    // (frente 24, §11): el rechazo devolvio el documento a «Observado», se corrigio, y al volver a
    // la fase de firma hay que convocar otra vez. Sin esto la funcion salia por `alreadyExists` y
    // el paso rechazado seguia rechazado: el documento volvia a atascarse en el mismo sitio.
    //
    // Se REABRE el que hay en vez de abrir otro porque `uq_recorridos` admite UNO por
    // (version de documento, accion).
    if (String(existing.estado) === ESTADO_RECORRIDO.RECHAZADO) {
      await reabrirRecorridoRechazado(connection, Number(existing.id), ESTADO_RECORRIDO.PENDIENTE);
    }
    return {
      ok: true,
      alreadyExists: true,
      signatureFlowInstanceId: Number(existing.id),
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

  // ⚠️ AQUI NO SE REPARA, y la entrega SI (`ensureFillFlowForDocumentVersion` llama a
  // `repararTurnos` cuando el recorrido ya estaba abierto). La asimetria es la de los dos momentos,
  // no un olvido: el de entrega se asegura en CADA lanzamiento --es idempotente y la receta puede
  // haber cambiado debajo--, mientras que el de firma se abre UNA vez, cuando la entrega termina y
  // el documento ya esta «Listo para firma». Si algun dia la firma se asegurara repetidamente, la
  // reparacion es la misma funcion y entra aqui.
  const recorridoId = await abrirRecorrido(connection, {
    documentVersionId,
    accion: "firma",
    pasoActual: Number(readiness.steps[0].stepOrder),
  });

  for (const step of readiness.steps) {
    for (const turno of step.turnos) {
      await abrirTurno(connection, {
        recorridoId,
        accion: "firma",
        participanteId: turno.participanteId,
        personaId: turno.personaId,
        manual: turno.manual,
      });
    }
  }

  await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de firma");
  return {
    ok: true,
    signatureFlowInstanceId: recorridoId,
    readiness,
  };
};

export const registerSignatureEvidence = async ({ connection, context, result }) => {
  if (!context?.user?.id) {
    throw new Error("Usuario autenticado inválido para registrar la firma.");
  }

  const signatureRequest = await assertSignatureRequestCanBeSigned({ connection, context });

  const documentVersionId = Number(
    context.documentVersionId || signatureRequest?.document_version_id || 0
  );
  if (!documentVersionId) {
    throw new Error("No se pudo determinar la versión documental firmada.");
  }

  const persistedSignedPath = String(
    result?.signedPath
    || result?.finalPath
    || ""
  ).trim() || null;

  const signatureStatusCode = deriveSignatureStatusCode(result);
  const signatureStatusId = await getSignatureStatusIdByCode(connection, signatureStatusCode);
  if (!signatureStatusId) {
    throw new Error(`No existe el estado técnico de firma '${signatureStatusCode}'.`);
  }

  if (persistedSignedPath) {
    await connection.query(
      `UPDATE document_versions
       SET working_file_path = ?
       WHERE id = ?`,
      [persistedSignedPath, documentVersionId]
    );
  }

  if (signatureRequest?.id) {
    // El estado se ESCRIBE, no se resuelve: era una consulta al catalogo por cada firma, y el
    // `if (!requestStatusId)` que la acompañaba era un error imposible de provocar sin borrar una
    // fila del catalogo a mano. Hoy lo valida el CHECK de la columna (fase 3 del frente 24).
    const requestStatusCode = deriveSignatureRequestStatusCode(signatureStatusCode);
    const shouldMarkRequestAsResponded = requestStatusCode === ESTADO_RECORRIDO.COMPLETADO;
    // `actualizarTurno` y no `responderTurno`: aqui solo se mueven el estado y la fecha, igual que
    // hacia el `UPDATE` de antes. La persona y la nota van por COALESCE, asi que no se pisan --en
    // firma la nota del rechazo vive en la observacion del hilo, no en el turno.
    await actualizarTurno(connection, Number(signatureRequest.id), {
      estado: requestStatusCode,
      respondido: shouldMarkRequestAsResponded ? new Date() : null,
    });
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
       signature_status_id,
       note_short,
       signed_file_path,
       signed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      signatureRequest?.id ? Number(signatureRequest.id) : null,
      documentVersionId,
      Number(context.user.id),
      Number(signatureStatusId),
      noteShort,
      persistedSignedPath,
      new Date(),
    ]
  );

  await syncDocumentProgressFromDocumentSignature(connection, Number(insertResult.insertId));

  // Auto-captura: un rechazo de firma queda como observación del hilo (fase 'signature').
  if (!DOC_SIGNATURE_SUCCESS.has(signatureStatusCode)) {
    await addDocumentObservation(connection, {
      documentVersionId,
      signatureRequestId: signatureRequest?.id ? Number(signatureRequest.id) : null,
      phase: "signature",
      kind: "rejection_reason",
      message: noteShort || "Firma rechazada.",
      authorPersonId: context.user.id
    });
  }

  return {
    documentSignatureId: Number(insertResult.insertId),
    documentVersionId,
    signatureRequestId: signatureRequest?.id ? Number(signatureRequest.id) : null,
    signatureStatusCode,
  };
};

export const getSignatureFlowSnapshot = async ({ connection, documentVersionId, userId }) => {
  const context = await getDocumentVersionSignatureContext(connection, documentVersionId);
  const currentStatus = normalizeDocumentVersionStatus(context?.document_version_status);
  const readiness = context
    ? {
      ok: false,
      context,
      currentStatus,
      steps: [],
    }
    : await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
  const snapshot = {
    documentVersionId,
    readiness,
    signatureFlow: null,
    signatureSteps: readiness.steps || [],
    signatureRequests: [],
    currentSignatureStepOrder: null,
    responsableActual: null,
    canOperate: false,
    currentStatus: readiness.currentStatus || currentStatus || null,
  };

  const recorrido = await buscarRecorrido(connection, documentVersionId, "firma");
  if (!recorrido) {
    return snapshot;
  }

  // `templateId` se queda en null: no hay cabecera. El recorrido ya no apunta a una plantilla de
  // flujo --la receta la lleva el paso-- y la clave se conserva porque viaja en la API.
  snapshot.signatureFlow = {
    id: Number(recorrido.id),
    templateId: null,
    statusCode: recorrido.estado,
    createdAt: recorrido.created_at ?? null,
  };

  if (context) {
    const receta = await resolverReceta(connection, {
      accion: "firma",
      taskItemId: context.task_item_id,
      vinculoId: context.vinculo_id,
    });
    const resuelto = await resolverPasosDeFirma(connection, receta.pasos, context);
    // `turnos` SE QUEDA FUERA de la respuesta: es fontaneria de `ensureSignatureFlow...` --los pares
    // (participante, persona) que hay que abrir-- y exponerla invita a que alguien dependa de ella.
    // Lo que el consumidor necesita de un paso es `assignees`, que es la union sin repetir.
    const pasos = resuelto.steps.map(({ turnos, ...paso }) => paso);
    snapshot.signatureSteps = pasos;
    snapshot.readiness = {
      ok: true,
      context,
      currentStatus,
      steps: pasos,
      unresolvedRequiredSteps: resuelto.unresolvedRequiredSteps,
      source: "active_instance",
    };
  } else if (!snapshot.readiness?.reason) {
    snapshot.readiness = await inspectDocumentVersionSignatureReadiness(connection, documentVersionId);
    snapshot.signatureSteps = snapshot.readiness?.steps || [];
    snapshot.currentStatus = snapshot.readiness?.currentStatus || snapshot.currentStatus;
  }

  const [requestRows] = await connection.query(
    `SELECT
       tu.id,
       tu.persona_id AS assigned_person_id,
       tu.manual AS is_manual,
       tu.solicitado AS requested_at,
       tu.respondido AS responded_at,
       tu.estado AS request_status_code,
       pr.paso_id AS step_id,
       pd.orden AS step_order,
       ss.code AS signature_status_code,
       p.first_name,
       p.last_name,
       c.name AS cargo_name
     FROM turnos tu
     INNER JOIN participantes_declarados pr ON pr.id = tu.participante_id
     INNER JOIN pasos_declarados pd ON pd.id = pr.paso_id
     LEFT JOIN (
       SELECT ds1.signature_request_id, ds1.signature_status_id
       FROM document_signatures ds1
       INNER JOIN (
         SELECT signature_request_id, MAX(id) AS max_id
         FROM document_signatures
         WHERE signature_request_id IS NOT NULL
         GROUP BY signature_request_id
       ) latest ON latest.max_id = ds1.id
     ) latest_ds ON latest_ds.signature_request_id = tu.id
     LEFT JOIN signature_statuses ss ON ss.id = latest_ds.signature_status_id
     LEFT JOIN persons p ON p.id = tu.persona_id
     LEFT JOIN cargos c ON c.id = pr.cargo_id
     WHERE tu.recorrido_id = ?
     ORDER BY pd.orden ASC, pr.orden ASC, tu.id ASC`,
    [Number(recorrido.id)]
  );

  const pendingStatusCodes = new Set([
    ESTADO_RECORRIDO.PENDIENTE,
    ESTADO_RECORRIDO.EN_PROGRESO,
  ]);

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
  }

  const stepSummaries = summarizeSignatureRequests(snapshot.signatureRequests);
  const currentStep = stepSummaries.find((item) => !item.approved && !item.hasRejected)
    || stepSummaries.find((item) => !item.approved)
    || null;
  snapshot.currentSignatureStepOrder = currentStep ? Number(currentStep.stepOrder) : null;

  for (const request of snapshot.signatureRequests) {
    if (Number(request.stepOrder) !== Number(snapshot.currentSignatureStepOrder || 0)) {
      continue;
    }
    if (!snapshot.responsableActual && pendingStatusCodes.has(request.requestStatusCode) && request.assignedPerson) {
      snapshot.responsableActual = request.assignedPerson;
    }
    if (
      pendingStatusCodes.has(request.requestStatusCode)
      && Number(userId || 0) === Number(request.assignedPerson?.id || 0)
    ) {
      snapshot.canOperate = true;
    }
  }

  return snapshot;
};

export const syncDocumentProgressFromSignatureRequest = async (connection, signatureRequestId) => {
  const context = await getSignatureRequestContext(connection, signatureRequestId);
  if (!context) return null;

  const rows = await leerTurnosConSuFirma(connection, Number(context.instance_id));
  if (!rows.length) return null;

  const stepSummaries = summarizeSignatureRequests(rows);
  const anyRejected = stepSummaries.some((item) => item.hasRejected);
  const allApproved = stepSummaries.length > 0 && stepSummaries.every((item) => item.approved);
  const anyApproved = stepSummaries.some((item) => item.approved);
  const anyActive = stepSummaries.some((item) => item.hasActive);

  // EL RECHAZO VA PRIMERO, y antes iba el ULTIMO. Un paso rechazado PARA el recorrido —
  // `resolveCurrentSignatureStep` lo devuelve como actual y nada avanza—, asi que con un rechazo y
  // una firma ya dada la instancia decia `en_progreso`: el rechazo quedaba invisible justo en el
  // caso en que hay que actuar. (Frente 24, §11.)
  let instanceStatusCode = ESTADO_RECORRIDO.PENDIENTE;
  if (anyRejected) instanceStatusCode = ESTADO_RECORRIDO.RECHAZADO;
  else if (allApproved) instanceStatusCode = ESTADO_RECORRIDO.COMPLETADO;
  else if (anyActive || anyApproved) instanceStatusCode = ESTADO_RECORRIDO.EN_PROGRESO;

  // Y SE ESCRIBE `paso_actual`, que la firma NO TENIA. La instancia vieja solo guardaba su estado y
  // «el paso que toca» se recalculaba en cada lectura; el recorrido unificado lleva la columna, igual
  // que la llevaba la entrega. Lo que esto permite no es un ahorro de consultas: es que
  // `turnoAbiertoDelUsuarioEnPasoActual` --que pregunta por `paso_actual`-- valga para los dos lados,
  // y por eso `rehacerDocumento` tiene hoy UNA comprobacion de titularidad en vez de dos.
  const currentStep = stepSummaries.find((item) => !item.approved && !item.hasRejected)
    || stepSummaries.find((item) => !item.approved)
    || null;
  await actualizarAvanceDelRecorrido(
    connection,
    Number(context.instance_id),
    instanceStatusCode,
    currentStep ? Number(currentStep.stepOrder) : null
  );

  if (allApproved) {
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Firmado completo");
    await finalizeDocumentVersionIfComplete(connection, Number(context.document_version_id));
  } else if (anyRejected && !anyApproved) {
    // EL RECHAZO SIN FIRMAS DADAS devuelve el documento a «Observado», la misma salida que el
    // rechazo de entrega. Antes el documento NO SE MOVIA y el paso rechazado se quedaba de actual
    // para siempre: el atasco del §11.
    //
    // La condicion `!anyApproved` no es prudencia, es lo unico que se puede hacer: si ya hay una
    // firma estampada, corregir el documento la dejaria firmando otro. Ese caso necesita una RONDA
    // NUEVA (`rehacerDocumento`), y por eso se queda en «Firmado parcial» — con el recorrido en
    // `rechazado`, que es lo que lo hace visible.
    await transitionDocumentVersionState(connection, Number(context.document_version_id), "Observado");
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
    await connection.query(
      `UPDATE document_versions
       SET final_file_path = working_file_path
       WHERE id = ?`,
      [Number(documentVersionId)]
    );
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Final");
    return true;
  }
  return false;
};

export const syncDocumentProgressFromDocumentVersionSignatureSummary = async (connection, documentVersionId) => {
  const currentStatus = await getDocumentVersionCurrentStatus(connection, Number(documentVersionId));
  if (currentStatus === "Final") {
    return {
      documentVersionId: Number(documentVersionId),
      successCount: null,
      totalRequests: null,
      skipped: "already_final",
    };
  }

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
     FROM turnos tu
     INNER JOIN recorridos r ON r.id = tu.recorrido_id AND r.accion = 'firma'
     WHERE r.document_version_id = ?`,
    [documentVersionId]
  );
  const totalRequests = Number(requestRows?.[0]?.total || 0);

  if (totalRequests > 0 && successCount >= totalRequests) {
    const refreshedStatus = await getDocumentVersionCurrentStatus(connection, Number(documentVersionId));
    if (refreshedStatus !== "Firmado completo" && refreshedStatus !== "Final") {
      await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado completo");
    }
    await finalizeDocumentVersionIfComplete(connection, Number(documentVersionId));
  } else {
    const refreshedStatus = await getDocumentVersionCurrentStatus(connection, Number(documentVersionId));
    if (refreshedStatus !== "Firmado parcial" && refreshedStatus !== "Final") {
      await transitionDocumentVersionState(connection, Number(documentVersionId), "Firmado parcial");
    }
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
