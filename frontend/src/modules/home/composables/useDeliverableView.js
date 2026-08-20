import {
  IconCircleCheck,
  IconFileDescription,
  IconPlayerPlayFilled,
  IconSignature,
  IconUpload,
} from '@tabler/icons-vue';
// Puros: viven fuera del closure para que no haga falta inyectar este composable entero solo para saber
// si una ruta acaba en .pdf. Se siguen devolviendo mas abajo para no tocar a los consumidores actuales.
import { canPreviewInline, getFileExtension, getFileNameFromPath } from '@/shared/utils/filePath.js';
import { buildDeliverableSubject } from '@/shared/utils/deliverableSubject.js';
import {
  formatDate,
  getFillRequestStatusCode,
  isCompletedSignatureRequestStatus,
} from '@/modules/home/views/homeView.helpers.js';
import { tonoFlujo, tonoAcceso } from '@/shared/utils/estadoTono.js';

// VISTA del entregable: todo lo que DERIVA de un entregable para pintarlo y decidir qué se
// puede hacer con él — su "subject" normalizado, etiquetas, tono, progreso, banderas de
// participación y los predicados shouldShow*/can* que gobiernan cada botón.
// Extraído de HomeView.vue en la Fase B del refactor del God Object.
//
// Es el bloque mas grande que quedaba (60 funciones, ~960 L) y el corazon de la UI de
// entregables: `getDeliverableSubject` sola se llama en 53 sitios.
//
// CLAVE del diseño: NO se intentó volverlo puro. getDeliverableSubject necesita 3 fallbacks del
// panel/contexto activos, y hacerla pura habría exigido cambiar su firma en los 53 call sites
// (con el riesgo de olvidar uno). En vez de eso el composable RECIBE esos refs (patrón admin) y
// devuelve las funciones con su firma INTACTA: ningún call site se toca.
export function useDeliverableView({
  currentUser,
  currentUserId,
  deliverableWorkspaceState,
  selectedProcessContext,
  selectedProcessPanel,
  startedDeliverableIds,
  unitGroups,
  userFullName,
  userUnits,
}) {
  const resolveUnitNameById = (unitId) => {
    const normalized = Number(unitId || 0);
    if (!normalized) return '';
    const directUnit = userUnits.value.find((unit) => Number(unit.id) === normalized);
    if (directUnit) {
      return directUnit.label || directUnit.name || '';
    }
    for (const group of unitGroups.value) {
      const nestedUnit = (group?.units || []).find((unit) => Number(unit.id) === normalized);
      if (nestedUnit) {
        return nestedUnit.label || nestedUnit.name || '';
      }
    }
    return '';
  };

  const capitalize = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  };

  const getCurrentSignatureStepOrder = (snapshot) => {
    const explicit = Number(snapshot?.currentSignatureStepOrder || 0);
    if (explicit > 0) return explicit;

    const requests = Array.isArray(snapshot?.signatureRequests) ? snapshot.signatureRequests : [];
    const pendingLike = requests
      .filter((request) => ['pendiente', 'en_progreso'].includes(String(request?.requestStatusCode || '').trim().toLowerCase()))
      .sort((a, b) => Number(a?.stepOrder || 0) - Number(b?.stepOrder || 0));
    if (pendingLike.length) {
      return Number(pendingLike[0]?.stepOrder || 0) || null;
    }

    const completed = requests
      .filter((request) => String(request?.requestStatusCode || '').trim().toLowerCase() === 'completado')
      .sort((a, b) => Number(b?.stepOrder || 0) - Number(a?.stepOrder || 0));
    if (completed.length) {
      return Number(completed[0]?.stepOrder || 0) || null;
    }

    return null;
  };

  const getDeliverableProcessLabel = (_task = null, item = null) =>
    item?.process_label
    || item?.processLabel
    || selectedProcessPanel.value?.definition?.process_name
    || selectedProcessContext.value?.name
    || 'Proceso';

  const getDeliverableUnitLabel = (item) =>
    item?.unit_label
    || item?.unitLabel
    || resolveUnitNameById(
      item?.origin_unit_id
      || item?.originUnitId
      || item?.scope_unit_id
      || item?.scopeUnitId
      || selectedProcessContext.value?.unit_id
    )
    || selectedProcessContext.value?.label
    || selectedProcessContext.value?.name
    || 'Unidad no definida';

  const getDeliverablePeriodLabel = (task) => {
    const raw = task?.term_name || '';
    // Las tareas libres usan un term con sufijo técnico único (" · #uid-token"); se oculta.
    const clean = raw.replace(/\s*·\s*#[^·]*$/, '').trim();
    return clean || 'Periodo no definido';
  };

  // El nucleo es puro y vive en shared/utils/deliverableSubject.js; aqui solo se le sirven los dos
  // fallbacks que dependen de esta pantalla. La firma no cambia: sus ~40 call sites siguen llamando
  // getDeliverableSubject(payload) sin enterarse.
  const getDeliverableSubject = (payload = {}) =>
    buildDeliverableSubject(payload, {
      processId:
        selectedProcessPanel.value?.definition?.chat_context?.process_id
        || selectedProcessPanel.value?.definition?.process_id,
      scopeUnitId: selectedProcessContext.value?.unit_id,
    });

  const isPdfWorkingFile = (payload) => {
    const subject = getDeliverableSubject(payload);
    return canPreviewInline(subject.workingFilePath);
  };

  const subjectHasWorkingArtifact = (payload) => {
    const subject = getDeliverableSubject(payload);
    return Boolean(subject.workingFilePath || subject.finalFilePath || subject.preloadFilePath);
  };

  const getCurrentFillStepCandidates = (payload) => {
    const subject = getDeliverableSubject(payload);
    const currentStepOrder = Number(
      subject.workflow?.fill_flow?.current_step_order
      || subject.workflow?.fill_flow?.currentStepOrder
      || subject.workflow?.current_fill_step_order
      || subject.workflow?.currentFillStepOrder
      || 0
    );
    if (!currentStepOrder) {
      const pendingRequests = (subject.workflow?.fill_requests || []).filter((item) => !(item?.responded_at || item?.respondedAt));
      if (pendingRequests.length) {
        return pendingRequests;
      }
    }
    const stepCandidates = (subject.workflow?.fill_steps || []).filter((item) => Number(item.step_order || item.stepOrder || 0) === currentStepOrder);
    if (stepCandidates.length) {
      return stepCandidates;
    }
    return (subject.workflow?.fill_requests || []).filter((item) => Number(item.step_order || item.stepOrder || 0) === currentStepOrder);
  };

  const getCurrentFillWorkflowRequest = (payload) => {
    const subject = getDeliverableSubject(payload);
    const currentUser = Number(currentUserId.value || 0);
    const currentStepCandidates = getCurrentFillStepCandidates(payload);
    const unresolvedCurrentStepCandidates = currentStepCandidates.filter((item) => !(item?.responded_at || item?.respondedAt));
    const preferredCurrentStepRequest =
      unresolvedCurrentStepCandidates.find((item) => Number(item.assigned_person_id || item.assignedPersonId || 0) === currentUser)
      || unresolvedCurrentStepCandidates.find((item) => Number(item.assigned_person_id || item.assignedPersonId || 0) > 0)
      || unresolvedCurrentStepCandidates.find((item) => item.is_manual)
      || currentStepCandidates.find((item) => Number(item.assigned_person_id || item.assignedPersonId || 0) === currentUser)
      || currentStepCandidates[0];

    return (
      preferredCurrentStepRequest
      || (subject.workflow?.fill_requests || []).find((item) => !(item?.responded_at || item?.respondedAt) && Number(item.assigned_person_id || item.assignedPersonId || 0) === currentUser)
      || (subject.workflow?.fill_requests || []).find((item) => !(item?.responded_at || item?.respondedAt))
      || subject.workflow?.fill_steps?.[0]
      || subject.workflow?.fill_requests?.[0]
      || null
    );
  };

  const getFillRequestId = (request) => Number(request?.request_id || request?.id || 0) || null;

  const getDeliverableAccessSource = (payload) => {
    const selectedAccessSource =
      String(selectedProcessPanel.value?.definition?.access_source || selectedProcessContext.value?.access_source || '')
        .trim()
        .toLowerCase();
    if (selectedAccessSource === 'flow') {
      return 'Derivado';
    }

    const subject = getDeliverableSubject(payload);
    const currentUser = Number(currentUserId.value || 0);
    const currentFillRequest = getCurrentFillWorkflowRequest(payload);
    const fillAssignedPersonId = Number(currentFillRequest?.assigned_person_id || currentFillRequest?.assignedPersonId || 0);
    const fillResolverType = String(currentFillRequest?.resolver_type || currentFillRequest?.resolverType || '').trim().toLowerCase();

    if (fillAssignedPersonId > 0 && fillAssignedPersonId === currentUser) {
      if (['cargo_in_scope', 'position', 'specific_person', 'manual_pick'].includes(fillResolverType)) {
        return 'Derivado';
      }
      return 'Directo';
    }

    const currentUserPendingSignature = (subject.workflow?.signature_requests || []).some((request) => {
      const assignedPersonId = Number(request?.assigned_person_id || 0);
      return assignedPersonId === currentUser && !request.responded_at;
    });
    if (currentUserPendingSignature) {
      return 'Derivado';
    }

    return 'Directo';
  };

  const isFillRequestActionableByCurrentUser = (request) => {
    if (!request) return false;
    const currentUser = Number(currentUserId.value || 0);
    const assignedPersonId = Number(request.assigned_person_id || request.assignedPersonId || 0);
    if (assignedPersonId > 0) {
      return assignedPersonId === currentUser;
    }
    return Boolean(request.is_manual || request.isManual);
  };

  const currentUserCanOperateFillStep = (payload) => {
    const currentUser = Number(currentUserId.value || 0);
    const candidates = getCurrentFillStepCandidates(payload);
    if (!candidates.length) {
      const fallbackRequest = getCurrentFillWorkflowRequest(payload);
      return isFillRequestActionableByCurrentUser(fallbackRequest);
    }
    return candidates.some((request) => {
      const assignedPersonId = Number(request?.assigned_person_id || request?.assignedPersonId || 0);
      if (assignedPersonId > 0) {
        return assignedPersonId === currentUser;
      }
      return Boolean(request?.is_manual || request?.isManual);
    });
  };

  const hasDeliverableBeenStarted = (payload) => {
    const subject = getDeliverableSubject(payload);
    if (subject.itemId && startedDeliverableIds.value.has(Number(subject.itemId))) return true;
    if (subject.userStartedAt) return true;
    if (subjectHasWorkingArtifact(payload)) return true;
    const request = getCurrentFillWorkflowRequest(payload);
    const code = getFillRequestStatusCode(request);
    return ['in_progress', 'approved', 'returned', 'rejected', 'cancelled'].includes(code);
  };

  const shouldShowStartDeliverable = (payload) => {
    const subject = getDeliverableSubject(payload);
    const request = getCurrentFillWorkflowRequest(payload);
    const code = getFillRequestStatusCode(request);
    return Boolean(
      subject.documentId
      && !isSignaturePhaseDocumentStatus(payload)
      && code === 'pending'
      && !hasDeliverableBeenStarted(payload)
    );
  };

  const canStartDeliverableAction = (payload) => {
    const subject = getDeliverableSubject(payload);
    if (subject.itemId && startedDeliverableIds.value.has(Number(subject.itemId))) return false;
    if (subjectHasWorkingArtifact(payload)) return false;
    const request = getCurrentFillWorkflowRequest(payload);
    const code = getFillRequestStatusCode(request);
    if (code !== 'pending') {
      return false;
    }
    return currentUserCanOperateFillStep(payload) || isFillRequestActionableByCurrentUser(request);
  };

  const shouldShowUploadDeliverable = (payload) => {
    const subject = getDeliverableSubject(payload);
    const request = getCurrentFillWorkflowRequest(payload);
    const code = getFillRequestStatusCode(request);
    return Boolean(
      subject.actions?.can_upload_deliverable
      && !isSignaturePhaseDocumentStatus(payload)
      && currentUserCanOperateFillStep(payload)
      && hasDeliverableBeenStarted(payload)
      && ['pending', 'in_progress', 'returned'].includes(code)
    );
  };

  const isReviewFillRequestForPayload = (payload) => {
    const resolver = String(getCurrentFillWorkflowRequest(payload)?.resolver_type || '').trim().toLowerCase();
    return ['cargo_in_scope', 'position', 'specific_person'].includes(resolver);
  };

  const canApproveFillRequestForPayload = (payload) => {
    const code = getFillRequestStatusCode(getCurrentFillWorkflowRequest(payload));
    return !isSignaturePhaseDocumentStatus(payload)
      && currentUserCanOperateFillStep(payload)
      && ['pending', 'in_progress'].includes(code)
      && subjectHasWorkingArtifact(payload);
  };

  const canReturnFillRequestForPayload = (payload) => {
    const code = getFillRequestStatusCode(getCurrentFillWorkflowRequest(payload));
    return !isSignaturePhaseDocumentStatus(payload)
      && currentUserCanOperateFillStep(payload)
      && isReviewFillRequestForPayload(payload)
      && ['pending', 'in_progress', 'returned'].includes(code);
  };

  const canRejectFillRequestForPayload = (payload) => {
    const code = getFillRequestStatusCode(getCurrentFillWorkflowRequest(payload));
    return !isSignaturePhaseDocumentStatus(payload)
      && currentUserCanOperateFillStep(payload)
      && isReviewFillRequestForPayload(payload)
      && ['pending', 'in_progress', 'returned'].includes(code);
  };

  const getFillApproveActionLabelForPayload = (payload) => (
    isReviewFillRequestForPayload(payload) ? 'Aprobar' : 'Enviar'
  );

  const shouldShowManageFill = (payload) => {
    const subject = getDeliverableSubject(payload);
    return Boolean(subject.actions?.can_manage_fill && subject.preloadFilePath);
  };

  const shouldShowSignatureFlow = (payload) => {
    const subject = getDeliverableSubject(payload);
    return Boolean(subject.actions?.can_review_signature_flow);
  };

  const hasPendingFillWorkflow = (payload) => {
    const subject = getDeliverableSubject(payload);
    const requests = Array.isArray(subject.workflow?.fill_requests) ? subject.workflow.fill_requests : [];
    const steps = Array.isArray(subject.workflow?.fill_steps) ? subject.workflow.fill_steps : [];
    const flowSteps = Array.isArray(subject.workflow?.fill_flow?.steps) ? subject.workflow.fill_flow.steps : [];
    return requests.some((request) => !(request?.responded_at || request?.respondedAt))
      || steps.some((step) => ['pending', 'in_progress', 'returned'].includes(String(step?.request_status || step?.requestStatus || step?.status || '').trim().toLowerCase()))
      || flowSteps.some((step) => ['pending', 'in_progress', 'returned'].includes(String(step?.request_status || step?.requestStatus || step?.status || '').trim().toLowerCase()));
  };

  const hasFillWorkflowActivity = (payload) => {
    const subject = getDeliverableSubject(payload);
    const steps = Array.isArray(subject.workflow?.fill_steps) ? subject.workflow.fill_steps : [];
    const requests = Array.isArray(subject.workflow?.fill_requests) ? subject.workflow.fill_requests : [];
    return steps.length > 0
      || requests.length > 0
      || Number(
        subject.workflow?.fill_flow?.current_step_order
        || subject.workflow?.fill_flow?.currentStepOrder
        || subject.workflow?.current_fill_step_order
        || subject.workflow?.currentFillStepOrder
        || 0
      ) > 0;
  };

  const isSignaturePhaseDocumentStatus = (payload) => {
    const subject = getDeliverableSubject(payload);
    const normalized = String(
      subject.document_status
      || subject.documentStatus
      || subject.document_version_status
      || subject.documentVersionStatus
      || ''
    ).trim().toLowerCase();
    return ['listo para firma', 'pendiente de firma', 'firmado parcial', 'firmado completo', 'firmado'].includes(normalized);
  };

  const hasSignatureWorkflowActivity = (payload) => {
    const subject = getDeliverableSubject(payload);
    const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
    return requests.length > 0
      || Number(subject.workflow?.signature_flow?.current_step_order || subject.workflow?.current_signature_step_order || 0) > 0;
  };

  const getSignatureStepsFromSubject = (payload) => {
    const subject = getDeliverableSubject(payload);
    return Array.isArray(subject.workflow?.signature_steps) ? subject.workflow.signature_steps : [];
  };

  const shouldShowResetWorkflow = (payload) => {
    const subject = getDeliverableSubject(payload);
    return Boolean(subject.actions?.can_reset_workflow && subject.actions?.implemented?.reset_workflow);
  };

  const getCurrentSignatureStepOrderFromSubject = (payload) => {
    const subject = getDeliverableSubject(payload);
    const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
    const explicit = Number(
      subject.workflow?.signature_flow?.current_step_order
      || subject.workflow?.current_signature_step_order
      || 0
    );
    if (explicit > 0) {
      const matchesExplicitPendingStep = requests.some((request) => {
        const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
        return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code)
          && !request?.responded_at
          && Number(request?.step_order || 0) === explicit;
      });
      if (matchesExplicitPendingStep) return explicit;
    }

    const pendingLike = requests
      .filter((request) => {
        const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
        return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code) && !request?.responded_at;
      })
      .sort((a, b) => Number(a?.step_order || 0) - Number(b?.step_order || 0));
    if (pendingLike.length) {
      return Number(pendingLike[0]?.step_order || 0) || null;
    }

    return null;
  };

  const getCurrentSignatureRequestsFromSubject = (payload) => {
    const subject = getDeliverableSubject(payload);
    const currentStepOrder = Number(getCurrentSignatureStepOrderFromSubject(payload) || 0);
    const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
    if (!currentStepOrder) {
      return requests.filter((request) => !request?.responded_at);
    }
    return requests.filter((request) => Number(request?.step_order || 0) === currentStepOrder);
  };

  const currentUserCanOperateSignatureStep = (payload) => {
    const currentUser = Number(currentUserId.value || 0);
    if (!currentUser) return false;

    const requests = getCurrentSignatureRequestsFromSubject(payload);
    return requests.some((request) => {
      const code = String(request?.request_status_code || request?.status_name || request?.status || '').trim().toLowerCase();
      const isPendingLike = ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code);
      return isPendingLike
        && !request?.responded_at
        && Number(request?.assigned_person_id || 0) === currentUser;
    });
  };

  const shouldShowSign = (payload) => {
    const subject = getDeliverableSubject(payload);
    return Boolean(
      subject.actions?.can_sign
      && currentUserCanOperateSignatureStep(payload)
      && isPdfWorkingFile(payload)
    );
  };

  /* EN QUE ESTADO ESTA LA TARJETA — una sola cascada, y antes eran TRES.
   *
   * `getDeliverableCardTone`, `getDeliverableStateIcon` y `getDeliverableHeaderActionTone`
   * preguntaban exactamente lo mismo, en el mismo orden, cada una por su cuenta: si se puede
   * empezar, si toca firmar, si toca subir, si ya esta hecho. Tres copias de una decision de
   * negocio es como acaban discrepando —basta tocar una— y ademas `DeliverableCard` llamaba a
   * la primera SIETE veces por tarjeta, una por cada campo de color que devolvia.
   *
   * Esto es negocio y se queda en JavaScript. Lo que se va es el color: los seis campos que
   * devolvia `…CardTone` son ahora `deasy-deliverable-card--{estado}` en `deliverables.css`,
   * que ya tenia el patron escrito para `deasy-deliverable-action--{estado}` con los MISMOS
   * nombres. No se inventa vocabulario: se reutiliza el que el fichero ya hablaba. */
  const getDeliverableCardState = (payload) => {
    if (shouldShowStartDeliverable(payload)) return 'start';
    if (shouldShowSign(payload) || hasSignatureWorkflowActivity(payload)) return 'sign';
    if (shouldShowUploadDeliverable(payload) || hasPendingFillWorkflow(payload)) return 'upload';
    const subject = getDeliverableSubject(payload);
    if (tonoFlujo(subject.status || subject.documentStatus, 'neutral') === 'success') return 'done';
    return 'idle';
  };

  const ICONO_POR_ESTADO = {
    start: IconPlayerPlayFilled,
    sign: IconSignature,
    upload: IconUpload,
    done: IconCircleCheck,
    idle: IconFileDescription
  };

  const getDeliverableStateIcon = (payload) => ICONO_POR_ESTADO[getDeliverableCardState(payload)];

  /* Las cuatro recetas de este boton se fueron a `deasy-deliverable-headaction--{estado}`, en
     `deliverables.css`. La de firmar es la que mas se agradece que salga de aqui: era una cadena
     con dos `color-mix` y dos `rgba(var(--x), .1)` dentro de corchetes arbitrarios, y su propio
     comentario documentaba que la sintaxis `rgb(var(--x)/.1)` compila pero es CSS invalido y el
     navegador la descarta sin avisar. Ese aviso viaja con la regla, no se pierde. */
  const getDeliverableHeaderActionTone = (payload) => `deasy-deliverable-headaction--${getDeliverableCardState(payload)}`;

  const isDeliverableSignatureFlowCompleted = (payload) => {
    const subject = getDeliverableSubject(payload);
    const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
    const steps = getSignatureStepsFromSubject(payload);
    if (!requests.length && !steps.length) {
      return false;
    }

    const hasPendingLikeRequests = requests.some((request) => {
      const code = String(request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status || '').trim().toLowerCase();
      return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code) && !request?.responded_at;
    });
    if (hasPendingLikeRequests) {
      return false;
    }

    const normalizedDocumentStatus = String(
      subject.document_status
      || subject.documentStatus
      || subject.document_version_status
      || subject.documentVersionStatus
      || ''
    ).trim().toLowerCase();

    if (['firmado', 'firmado completo', 'completed', 'completado'].includes(normalizedDocumentStatus)) {
      return true;
    }

    const stepOrders = [...new Set(
      [
        ...steps.map((step) => Number(step?.step_order || step?.stepOrder || 0)),
        ...requests.map((request) => Number(request?.step_order || request?.stepOrder || 0))
      ].filter((value) => value > 0)
    )];

    if (!stepOrders.length) {
      return false;
    }

    return stepOrders.every((stepOrder) => {
      const relatedRequests = requests.filter((request) => Number(request?.step_order || request?.stepOrder || 0) === stepOrder);
      return relatedRequests.length > 0 && relatedRequests.every((request) =>
        isCompletedSignatureRequestStatus(
          request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status
        )
      );
    });
  };

  const getDeliverableParticipationFlags = (payload) => {
    const currentUser = Number(currentUserId.value || 0);
    if (!currentUser) {
      return { current: false, future: false, past: false };
    }

    const subject = getDeliverableSubject(payload);
    const historicalParticipation = payload?.participation || subject?.participation || {};
    const fillRequests = Array.isArray(subject.workflow?.fill_requests) ? subject.workflow.fill_requests : [];
    const signatureRequests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
    const currentFillStepOrder = Number(
      subject.workflow?.fill_flow?.current_step_order
      || subject.workflow?.current_fill_step_order
      || getCurrentFillWorkflowRequest(payload)?.step_order
      || 0
    );
    const currentSignatureStepOrder = Number(getCurrentSignatureStepOrderFromSubject(payload) || 0);

    const current = Boolean(
      shouldShowStartDeliverable(payload)
      || shouldShowUploadDeliverable(payload)
      || shouldShowSign(payload)
      || canApproveFillRequestForPayload(payload)
      || currentUserCanOperateFillStep(payload)
      || currentUserCanOperateSignatureStep(payload)
    );

    const futureFill = fillRequests.some((request) =>
      Number(request?.assigned_person_id || request?.assignedPersonId || 0) === currentUser
      && !(request?.responded_at || request?.respondedAt)
      && Number(request?.step_order || request?.stepOrder || 0) > currentFillStepOrder
    );

    const futureSignature = signatureRequests.some((request) => {
      const code = String(request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status || '').trim().toLowerCase();
      return Number(request?.assigned_person_id || 0) === currentUser
        && !request?.responded_at
        && ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code)
        && Number(request?.step_order || request?.stepOrder || 0) > currentSignatureStepOrder;
    });

    const pastFill = fillRequests.some((request) =>
      Number(request?.assigned_person_id || request?.assignedPersonId || 0) === currentUser
      && Boolean(request?.responded_at || request?.respondedAt)
    );

    const pastSignature = signatureRequests.some((request) =>
      Number(request?.assigned_person_id || 0) === currentUser
      && (
        Boolean(request?.responded_at)
        || isCompletedSignatureRequestStatus(
          request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status
        )
      )
    );

    return {
      current,
      future: futureFill || futureSignature,
      past: pastFill
        || pastSignature
        || Boolean(historicalParticipation?.has_past_fill)
        || Boolean(historicalParticipation?.has_past_signature)
    };
  };

  const getDeliverableActionFilterState = (payload) => {
    if (shouldShowStartDeliverable(payload)) return 'start';
    if (shouldShowSign(payload)) return 'sign';
    if (shouldShowUploadDeliverable(payload) || canApproveFillRequestForPayload(payload)) return 'deliver';
    return 'other';
  };

  const getDeliverableDocumentTagVariant = (subject) => {
    if (!subject?.documentId) return 'warning';
    return tonoFlujo(subject.documentStatus, 'info');
  };

  const getDeliverableTagGroups = (payload) => {
    const subject = getDeliverableSubject(payload);
    const accessSource = getDeliverableAccessSource(payload);
    return [
      {
        key: 'access-source',
        variant: tonoAcceso(accessSource),
        label: `Acceso: ${accessSource}`
      },
      {
        key: 'deliverable-status',
        variant: tonoFlujo(subject.status || subject.documentStatus, 'neutral'),
        label: `Entregable: ${capitalize(subject.status || subject.documentStatus || 'pendiente')}`
      },
      {
        key: 'document-status',
        variant: getDeliverableDocumentTagVariant(subject),
        label: subject.documentId
          ? `Documento: ${subject.documentStatus || 'Creado'}`
          : 'Documento: sin generar'
      }
    ];
  };

  const getFillResponsibleName = (payload) => {
    const request = getCurrentFillWorkflowRequest(payload);
    const explicitLabel = String(request?.display_label || request?.displayLabel || request?.label || '').trim();
    if (explicitLabel) return explicitLabel;
    const assignedPersonName = String(request?.assigned_person_name || request?.assignedPersonName || '').trim();
    if (assignedPersonName) return assignedPersonName;
    const cargoName = String(request?.cargo_name || request?.cargoName || '').trim();
    if (cargoName) return cargoName;
    const assignedPersonId = Number(request?.assigned_person_id || request?.assignedPersonId || 0);
    if (assignedPersonId > 0 && assignedPersonId === Number(currentUserId.value || 0)) {
      return userFullName.value;
    }
    return 'Responsable no resuelto';
  };

  const getSignatureRequestAssignedSummary = (request) => {
    const personName = request?.assignedPerson
      ? `${request.assignedPerson.firstName || ''} ${request.assignedPerson.lastName || ''}`.trim()
      : String(request?.assigned_person_name || request?.assignedPersonName || '').trim();
    const cargoName = String(request?.cargoName || request?.cargo_name || '').trim();
    const explicitLabel = String(request?.display_label || request?.label || '').trim();
    if (personName && cargoName) {
      return `${personName} · ${cargoName}`;
    }
    return personName || cargoName || explicitLabel || 'Responsable no resuelto';
  };

  const getCurrentSignatureWorkflowRequest = (payload) => {
    const currentUser = Number(currentUserId.value || 0);
    const requests = getCurrentSignatureRequestsFromSubject(payload);
    return requests.find((request) => Number(request?.assigned_person_id || 0) === currentUser && !request?.responded_at)
      || requests.find((request) => Number(request?.assigned_person_id || 0) > 0 && !request?.responded_at)
      || requests.find((request) => !request?.responded_at)
      || requests[0]
      || null;
  };

  const getSignatureResponsibleName = (payload) => {
    const request = getCurrentSignatureWorkflowRequest(payload);
    if (!request) return 'Responsable no resuelto';
    const summary = getSignatureRequestAssignedSummary(request);
    if (summary && summary !== 'Responsable no resuelto') return summary;
    const assignedPersonId = Number(request?.assigned_person_id || 0);
    if (assignedPersonId > 0 && assignedPersonId === Number(currentUserId.value || 0)) {
      return userFullName.value;
    }
    return 'Responsable no resuelto';
  };

  const getDeliverableCurrentResponsibility = (payload) => {
    if (isSignaturePhaseDocumentStatus(payload) && (shouldShowSign(payload) || hasSignatureWorkflowActivity(payload))) {
      return {
        type: 'signature',
        name: getSignatureResponsibleName(payload),
        variant: 'warning'
      };
    }
    if (shouldShowStartDeliverable(payload) || shouldShowUploadDeliverable(payload) || hasPendingFillWorkflow(payload)) {
      return {
        type: 'fill',
        name: getFillResponsibleName(payload),
        variant: 'info'
      };
    }
    if (shouldShowSign(payload) || hasSignatureWorkflowActivity(payload)) {
      return {
        type: 'signature',
        name: getSignatureResponsibleName(payload),
        variant: 'warning'
      };
    }
    return {
      type: 'none',
      name: 'no resuelto',
      variant: 'muted'
    };
  };

  const getDeliverableProgress = (payload) => {
    const subject = getDeliverableSubject(payload);

    if (hasSignatureWorkflowActivity(payload)) {
      const requests = Array.isArray(subject.workflow?.signature_requests) ? subject.workflow.signature_requests : [];
      const signatureSteps = getSignatureStepsFromSubject(payload);
      const templateStepOrders = [...new Set(
        signatureSteps
          .map((step) => Number(step?.step_order || step?.stepOrder || 0))
          .filter((value) => value > 0)
      )].sort((a, b) => a - b);
      const requestStepOrders = [...new Set(
        requests
          .map((request) => Number(request?.step_order || request?.stepOrder || 0))
          .filter((value) => value > 0)
      )].sort((a, b) => a - b);
      const stepOrders = templateStepOrders.length ? templateStepOrders : requestStepOrders;
      const total = Number(subject.workflow?.total_signature_steps || 0) || stepOrders.length || Number(subject.pendingSignatureCount || 0) || 0;
      if (!total) return null;
      const current = Number(getCurrentSignatureStepOrderFromSubject(payload) || 0) || total;
      const completedSteps = stepOrders.filter((stepOrder) => {
        const relatedRequests = requests.filter((request) => Number(request?.step_order || request?.stepOrder || 0) === stepOrder);
        if (!relatedRequests.length) return false;
        return relatedRequests.every((request) => {
          const code = String(request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status || '').trim().toLowerCase();
          return ['completado', 'completed'].includes(code);
        });
      }).length;
      const hasActivePendingStep = requests.some((request) => {
        const code = String(request?.request_status_code || request?.requestStatusCode || request?.status_name || request?.status || '').trim().toLowerCase();
        return ['pendiente', 'pending', 'en_progreso', 'in_progress'].includes(code) && !request?.responded_at;
      });
      const progressUnits = Math.min(total, completedSteps + (hasActivePendingStep ? 0.5 : 0));
      return {
        label: 'Firmas',
        current: Math.min(Math.max(current, 1), total),
        total,
        percent: Math.min(100, Math.max(8, (progressUnits / total) * 100))
      };
    }

    const fillSteps = Array.isArray(subject.workflow?.fill_steps) ? subject.workflow.fill_steps : [];
    const total = fillSteps.length || Number(subject.pendingFillCount || 0) || 0;
    if (!total) return null;
    const current = Number(subject.workflow?.fill_flow?.current_step_order || subject.workflow?.current_fill_step_order || getCurrentFillWorkflowRequest(payload)?.step_order || 0) || total;
    const completedSteps = fillSteps.filter((step) => {
      const code = String(step?.request_status || '').trim().toLowerCase();
      return code === 'approved';
    }).length;
    const hasActivePendingStep = fillSteps.some((step) => {
      const code = String(step?.request_status || '').trim().toLowerCase();
      return ['pending', 'in_progress', 'returned'].includes(code);
    });
    const progressUnits = Math.min(total, completedSteps + (hasActivePendingStep ? 0.5 : 0));
    return {
      label: 'Entrega',
      current: Math.min(Math.max(current, 1), total),
      total,
      percent: Math.min(100, Math.max(8, (progressUnits / total) * 100))
    };
  };

  const getDeliverablePeriodLabelFromSubject = (payload) => {
    const subject = getDeliverableSubject(payload);
    if (subject.periodLabel) return subject.periodLabel;
    return 'Periodo no resuelto';
  };

  const getDeliverableDateRangeLabel = (payload) => {
    const subject = getDeliverableSubject(payload);
    const startDate = subject.itemStartDate || subject.taskStartDate || null;
    const endDate = subject.itemEndDate || subject.taskEndDate || null;
    if (!startDate && !endDate) return 'Fechas no resueltas';
    return `${formatDate(startDate)}${endDate ? ` - ${formatDate(endDate)}` : ''}`;
  };

  const getDeliverableWorkspacePayload = (deliverable) => ({
    ...(deliverable?.item || {}),
    period_label: getDeliverablePeriodLabel(deliverable?.task),
    process_label: getDeliverableProcessLabel(deliverable?.task, deliverable?.item),
    unit_label: getDeliverableUnitLabel(deliverable?.item),
    item_start_date: deliverable?.item?.start_date || null,
    item_end_date: deliverable?.item?.end_date || null,
    user_started_at: deliverable?.item?.user_started_at || null,
    task_start_date: deliverable?.task?.start_date || null,
    task_end_date: deliverable?.task?.end_date || null,
  });

  const getDeliverableDueState = (payload) => {
    const subject = getDeliverableSubject(payload);
    const dueDateValue = subject.itemEndDate || subject.taskEndDate || null;
    if (!dueDateValue) {
      return { label: 'Vencimiento', value: 'Sin definir', variant: 'muted' };
    }

    const normalized = String(dueDateValue).slice(0, 10);
    const dueDate = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) {
      return { label: 'Vencimiento', value: normalized, variant: 'muted' };
    }

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((dueDate.getTime() - todayDate.getTime()) / 86400000);
    const formattedDate = formatDate(normalized);

    if (diffDays < 0) {
      return { label: 'Vencimiento', value: formattedDate, variant: 'danger' };
    }
    if (diffDays <= 5) {
      return { label: 'Vencimiento', value: formattedDate, variant: 'warning' };
    }
    return { label: 'Vencimiento', value: formattedDate, variant: 'success' };
  };

  const getSignatureStepAssignedSummary = (step, requests = []) => {
    const stepOrder = Number(step?.step_order || step?.stepOrder || 0);
    const relatedRequests = (requests || []).filter((request) => Number(request?.stepOrder || 0) === stepOrder);
    if (!relatedRequests.length) {
      return 'Firmante no resuelto';
    }

    const labels = relatedRequests.map((request) => getSignatureRequestAssignedSummary(request)).filter(Boolean);

    return labels.join(' | ') || 'Firmante no resuelto';
  };

  const getUploadActionLabel = (payload) => {
    const subject = getDeliverableSubject(payload);
    if (!subject.preloadFilePath) {
      return 'Subir archivo';
    }
    return canPreviewInline(subject.preloadFilePath) ? 'Cambiar PDF' : 'Cambiar archivo';
  };

  // Bundle of pure helpers passed to <DeliverableCard> so the card stays presentational.
  // Declared after all referenced helpers to avoid const TDZ errors during setup.

  return {
    canApproveFillRequestForPayload,
    canPreviewInline,
    canRejectFillRequestForPayload,
    canReturnFillRequestForPayload,
    canStartDeliverableAction,
    capitalize,
    currentUserCanOperateFillStep,
    currentUserCanOperateSignatureStep,
    getCurrentFillStepCandidates,
    getCurrentFillWorkflowRequest,
    getCurrentSignatureRequestsFromSubject,
    getCurrentSignatureStepOrder,
    getCurrentSignatureStepOrderFromSubject,
    getCurrentSignatureWorkflowRequest,
    getDeliverableAccessSource,
    getDeliverableActionFilterState,
    getDeliverableCardState,
    getDeliverableCurrentResponsibility,
    getDeliverableDateRangeLabel,
    getDeliverableDocumentTagVariant,
    getDeliverableDueState,
    getDeliverableHeaderActionTone,
    getDeliverableParticipationFlags,
    getDeliverablePeriodLabel,
    getDeliverablePeriodLabelFromSubject,
    getDeliverableProcessLabel,
    getDeliverableProgress,
    getDeliverableStateIcon,
    getDeliverableSubject,
    getDeliverableTagGroups,
    getDeliverableUnitLabel,
    getDeliverableWorkspacePayload,
    getFileExtension,
    getFileNameFromPath,
    getFillApproveActionLabelForPayload,
    getFillRequestId,
    getFillResponsibleName,
    getSignatureRequestAssignedSummary,
    getSignatureResponsibleName,
    getSignatureStepAssignedSummary,
    getSignatureStepsFromSubject,
    getUploadActionLabel,
    hasDeliverableBeenStarted,
    hasFillWorkflowActivity,
    hasPendingFillWorkflow,
    hasSignatureWorkflowActivity,
    isDeliverableSignatureFlowCompleted,
    isFillRequestActionableByCurrentUser,
    isPdfWorkingFile,
    isReviewFillRequestForPayload,
    isSignaturePhaseDocumentStatus,
    resolveUnitNameById,
    shouldShowManageFill,
    shouldShowResetWorkflow,
    shouldShowSign,
    shouldShowSignatureFlow,
    shouldShowStartDeliverable,
    shouldShowUploadDeliverable,
    subjectHasWorkingArtifact,
  };
}
