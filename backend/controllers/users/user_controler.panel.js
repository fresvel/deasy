// Ensamblado del PANEL OPERATIVO del usuario para una configuración de proceso.
// Extraído en la Fase 3 (God Object #2). Ver docs/auditoria-refactor-user-controler-2026-07.md
//
// Es la función más compleja del controller (~400 L): orquesta ~17 queries de
// .queries.js y las primitivas de resolución de reglas para responder "qué ve este
// usuario en este proceso". Aislarla permite atacar su complejidad cognitiva sin el
// ruido del resto del fichero (Fase 4 del plan Sonar).
//
// La alimenta el endpoint GET /users/:id/process-definitions/:definitionId/panel, que
// estuvo devolviendo 500 hasta el commit a199a28 y hoy tiene golden-master
// (flows/user_workspace.test.mjs). No la toques sin correr test:char:run.
import {
  createUnitSubtreeResolver,
  doesPositionMatchRule,
  buildRuleDisplayLabel,
  buildFillStepDisplayLabel,
  canCurrentUserResetWorkflow
} from "./user_controler.primitives.js";
import {
  getActiveUserPositions,
  getOrgChildrenMap,
  getDefinitionContext,
  getActiveDefinitionRules,
  getActiveDefinitionPeriodTypes,
  getDefinitionTemplates,
  getAvailableTerms,
  getUserOwnedTemplateArtifacts,
  getUserAccessibleTasksForDefinition,
  getTaskItemsForTaskIds,
  getDocumentsForTaskItemIds,
  getUserTaskItemParticipationSummary,
  getUserPendingSignaturesForDefinition,
  getSignatureWorkflowRequestsForDocumentVersions,
  getSignatureWorkflowStepsForDocumentVersions,
  getUserPendingFillRequestsForDefinition,
  getAttachmentsForDocumentVersions,
  getFillWorkflowStepsForDocumentVersions
} from "./user_controler.queries.js";

export const buildUserProcessDefinitionPanel = async (pool, userId, definitionId, scopeUnitId = null) => {
  const definition = await getDefinitionContext(pool, definitionId);
  if (!definition || definition.status !== "active") {
    return null;
  }

  const positions = await getActiveUserPositions(pool, userId);
  if (!positions.length) {
    return null;
  }
  const rules = await getActiveDefinitionRules(pool, definitionId);
  const childrenByUnit = await getOrgChildrenMap(pool);
  const getUnitSubtree = createUnitSubtreeResolver(childrenByUnit);
  const matchingRules = rules.filter((rule) => positions.some((position) => doesPositionMatchRule(position, rule, getUnitSubtree)));
  const tasks = await getUserAccessibleTasksForDefinition(pool, userId, definitionId, scopeUnitId);
  const fillRequests = await getUserPendingFillRequestsForDefinition(pool, userId, definitionId);
  const signatures = await getUserPendingSignaturesForDefinition(pool, userId, definitionId);
  const hasOperationalAccess = Boolean(matchingRules.length || tasks.length || fillRequests.length || signatures.length);
  if (!hasOperationalAccess) {
    return null;
  }

  const periodTypes = await getActiveDefinitionPeriodTypes(pool, definitionId);
  const templates = await getDefinitionTemplates(pool, definitionId);
  const terms = await getAvailableTerms(pool);
  const userPackages = await getUserOwnedTemplateArtifacts(pool, userId);
  const taskIds = tasks.map((task) => task.id);
  const taskItems = await getTaskItemsForTaskIds(pool, taskIds);
  const taskItemIds = taskItems.map((item) => Number(item.id || 0)).filter((id) => id > 0);
  const taskItemDocuments = await getDocumentsForTaskItemIds(pool, taskItemIds);
  const taskItemParticipation = await getUserTaskItemParticipationSummary(pool, userId, taskItemIds);
  const taskItemsByTask = new Map();
  taskItems.forEach((item) => {
    if (!taskItemsByTask.has(item.task_id)) {
      taskItemsByTask.set(item.task_id, []);
    }
    taskItemsByTask.get(item.task_id).push(item);
  });
  const participationByTaskItemId = new Map(
    taskItemParticipation.map((item) => [
      Number(item.task_item_id),
      {
        has_past_fill: Number(item.has_past_fill || 0) === 1,
        has_past_signature: Number(item.has_past_signature || 0) === 1,
      }
    ])
  );

  const fillWorkflowSteps = await getFillWorkflowStepsForDocumentVersions(
    pool,
    taskItemDocuments
      .map((item) => Number(item.document_version_id || 0))
      .filter((id) => id > 0)
  );
  const documentVersionIds = taskItemDocuments
    .map((item) => Number(item.document_version_id || 0))
    .filter((id) => id > 0);
  const signatureWorkflowRequests = await getSignatureWorkflowRequestsForDocumentVersions(pool, documentVersionIds);
  const signatureWorkflowSteps = await getSignatureWorkflowStepsForDocumentVersions(pool, documentVersionIds);
  const documentAttachments = await getAttachmentsForDocumentVersions(pool, documentVersionIds);
  const attachmentsByDocumentVersion = new Map();
  documentAttachments.forEach((row) => {
    const key = Number(row.document_version_id);
    if (!attachmentsByDocumentVersion.has(key)) {
      attachmentsByDocumentVersion.set(key, []);
    }
    attachmentsByDocumentVersion.get(key).push({
      id: Number(row.id),
      document_version_id: key,
      kind: row.kind,
      file_path: row.file_path,
      file_name: row.file_name,
      mime_type: row.mime_type || null,
      size_bytes: row.size_bytes != null ? Number(row.size_bytes) : null,
      description: row.description || null,
      uploaded_by_person_id: row.uploaded_by_person_id != null ? Number(row.uploaded_by_person_id) : null,
      sort_order: Number(row.sort_order || 1),
      created_at: row.created_at,
    });
  });
  const fillRequestsByDocumentVersion = new Map();
  fillRequests.forEach((request) => {
    const key = Number(request.document_version_id);
    if (!fillRequestsByDocumentVersion.has(key)) {
      fillRequestsByDocumentVersion.set(key, []);
    }
    fillRequestsByDocumentVersion.get(key).push(request);
  });
  const userSignaturesByDocumentVersion = new Map();
  signatures.forEach((request) => {
    const key = Number(request.document_version_id);
    if (!userSignaturesByDocumentVersion.has(key)) {
      userSignaturesByDocumentVersion.set(key, []);
    }
    userSignaturesByDocumentVersion.get(key).push(request);
  });
  const signatureWorkflowRequestsByDocumentVersion = new Map();
  signatureWorkflowRequests.forEach((request) => {
    const key = Number(request.document_version_id);
    if (!signatureWorkflowRequestsByDocumentVersion.has(key)) {
      signatureWorkflowRequestsByDocumentVersion.set(key, []);
    }
    signatureWorkflowRequestsByDocumentVersion.get(key).push(request);
  });
  const signatureWorkflowStepsByDocumentVersion = new Map();
  signatureWorkflowSteps.forEach((step) => {
    const key = Number(step.document_version_id);
    if (!signatureWorkflowStepsByDocumentVersion.has(key)) {
      signatureWorkflowStepsByDocumentVersion.set(key, []);
    }
    signatureWorkflowStepsByDocumentVersion.get(key).push({
      id: Number(step.id),
      template_id: Number(step.template_id),
      step_order: Number(step.step_order),
      code: step.code || null,
      name: step.name || null,
      slot: step.slot || null,
      resolver_type: step.resolver_type || null,
      selection_mode: step.selection_mode || null,
      approval_mode: step.approval_mode || null,
      required_signers_min: step.required_signers_min !== null ? Number(step.required_signers_min) : null,
      required_signers_max: step.required_signers_max !== null ? Number(step.required_signers_max) : null,
      is_required: Boolean(step.is_required),
      cargo_code: step.cargo_code || null,
      cargo_name: step.cargo_name || null
    });
  });
  const fillWorkflowByDocumentVersion = new Map();
  fillWorkflowSteps.forEach((step) => {
    const key = Number(step.document_version_id);
    if (!fillWorkflowByDocumentVersion.has(key)) {
      fillWorkflowByDocumentVersion.set(key, {
        status: step.fill_flow_status,
        current_step_order: step.current_step_order ? Number(step.current_step_order) : null,
        steps: []
      });
    }
    fillWorkflowByDocumentVersion.get(key).steps.push({
      id: Number(step.fill_flow_step_id),
      step_order: Number(step.step_order),
      resolver_type: step.resolver_type,
      selection_mode: step.selection_mode,
      is_required: Boolean(step.is_required),
      can_reject: Boolean(step.can_reject),
      request_id: step.fill_request_id ? Number(step.fill_request_id) : null,
      assigned_person_id: step.assigned_person_id ? Number(step.assigned_person_id) : null,
      is_manual: Boolean(step.is_manual),
      request_status: step.request_status || "pending",
      requested_at: step.requested_at || null,
      responded_at: step.responded_at || null,
      response_note: step.response_note || null,
      assigned_person_name: step.assigned_person_name || null,
      display_label: buildFillStepDisplayLabel(step),
      cargo_name: step.cargo_name || null,
      position_title: step.position_title || null,
      unit_name: step.unit_name || null,
      unit_type_name: step.unit_type_name || null
    });
  });

  const getCurrentSignatureStepOrder = (requests = []) => {
    const pendingLike = (Array.isArray(requests) ? requests : [])
      .filter((request) => {
        const code = String(request?.request_status_code || request?.status_name || request?.status || "").trim().toLowerCase();
        return ["pendiente", "pending", "en_progreso", "in_progress"].includes(code) && !request?.responded_at;
      })
      .sort((a, b) => Number(a?.step_order || 0) - Number(b?.step_order || 0));

    return pendingLike.length ? (Number(pendingLike[0]?.step_order || 0) || null) : null;
  };

  const documents = taskItemDocuments
    .filter((item) => item.document_id)
    .map((item) => {
      const taskItem = taskItems.find((candidate) => Number(candidate.id) === Number(item.task_item_id)) || null;
      const documentVersionId = Number(item.document_version_id || 0);
      const relatedFillRequests = fillRequestsByDocumentVersion.get(documentVersionId) || [];
      const relatedSignatureRequests = signatureWorkflowRequestsByDocumentVersion.get(documentVersionId) || [];
      const relatedSignatureSteps = signatureWorkflowStepsByDocumentVersion.get(documentVersionId) || [];
      const relatedUserSignatures = userSignaturesByDocumentVersion.get(documentVersionId) || [];
      const relatedAttachments = attachmentsByDocumentVersion.get(documentVersionId) || [];
      const currentSignatureStepOrder = getCurrentSignatureStepOrder(relatedSignatureRequests);
      const fillWorkflow = fillWorkflowByDocumentVersion.get(documentVersionId) || {
        status: null,
        current_step_order: null,
        steps: []
      };
      const canManageFill = Boolean(item.document_id || relatedFillRequests.length || fillWorkflow.steps.length);
      const canSign = relatedUserSignatures.some((request) => !request.responded_at);
      // Todo entregable de proceso admite carga manual (usage_role deprecado, siempre 'primary').
      const canUploadDeliverable = true;
      const canResetWorkflow = canCurrentUserResetWorkflow({
        userId,
        fillWorkflow,
        signatureRequests: relatedSignatureRequests,
      });
      return {
        document_id: item.document_id,
        task_id: taskItem?.task_id || null,
        task_item_id: item.task_item_id,
        owner_person_id: item.owner_person_id || null,
        origin_unit_id: item.origin_unit_id,
        unit_label: item.origin_unit_label || null,
        template_artifact_id: taskItem?.template_artifact_id || null,
        template_artifact_name: taskItem?.template_artifact_name || null,
        item_mode: taskItem?.item_mode || null,
        recipient_name: taskItem?.recipient_name || null,
        start_date: taskItem?.start_date || null,
        end_date: taskItem?.end_date || null,
        user_started_at: taskItem?.user_started_at || null,
        document_status: item.document_status,
        document_version_id: item.document_version_id,
        document_version: item.document_version,
        working_file_path: item.working_file_path,
        final_file_path: item.final_file_path,
        pending_signature_count: item.pending_signature_count,
        total_signature_count: item.total_signature_count,
        pending_fill_count: relatedFillRequests.filter((request) => !request.responded_at).length,
        total_fill_count: relatedFillRequests.length,
        attachments: relatedAttachments,
        attachment_count: relatedAttachments.length,
        workflow: {
          fill_requests: relatedFillRequests,
          fill_flow: fillWorkflow,
          fill_steps: fillWorkflow.steps,
          signature_steps: relatedSignatureSteps,
          signature_requests: relatedSignatureRequests,
          total_signature_steps: relatedSignatureSteps.length,
          current_fill_step_order: fillWorkflow.current_step_order || relatedFillRequests[0]?.step_order || null,
          current_signature_step_order: currentSignatureStepOrder
        },
        actions: {
          can_upload_deliverable: canUploadDeliverable,
          can_download_template: Boolean(taskItem?.template_artifact_id),
          can_manage_fill: canManageFill,
          can_review_signature_flow: Boolean(
            relatedSignatureSteps.length
            || Number(item.total_signature_count || 0) > 0
            || relatedSignatureRequests.length
          ),
          can_sign: canSign,
          can_reset_workflow: canResetWorkflow,
          can_open_process_chat: true,
          implemented: {
            upload_deliverable: false,
            download_template: false,
            manage_fill: false,
            review_signature_flow: false,
            sign: true,
            reset_workflow: true,
            process_chat: true
          }
        }
      };
    });
  // Agrupa los documentos ya enriquecidos (incluyen attachments) por task_item.
  const documentsByTaskItemId = new Map();
  documents.forEach((document) => {
    const key = Number(document.task_item_id || 0);
    if (!documentsByTaskItemId.has(key)) {
      documentsByTaskItemId.set(key, []);
    }
    documentsByTaskItemId.get(key).push(document);
  });
  const enrichedTasks = tasks.map((task) => {
    const items = (taskItemsByTask.get(task.id) || []).map((item) => {
      const relatedDocuments = documentsByTaskItemId.get(Number(item.id)) || [];
      const relatedDocument = relatedDocuments[0] || null;
      const documentVersionId = Number(relatedDocument?.document_version_id || 0);
      const relatedFillRequests = documentVersionId ? (fillRequestsByDocumentVersion.get(documentVersionId) || []) : [];
      const relatedSignatureRequests = documentVersionId ? (signatureWorkflowRequestsByDocumentVersion.get(documentVersionId) || []) : [];
      const relatedSignatureSteps = documentVersionId ? (signatureWorkflowStepsByDocumentVersion.get(documentVersionId) || []) : [];
      const relatedUserSignatures = documentVersionId ? (userSignaturesByDocumentVersion.get(documentVersionId) || []) : [];
      const currentSignatureStepOrder = getCurrentSignatureStepOrder(relatedSignatureRequests);
      const fillWorkflow = documentVersionId
        ? (fillWorkflowByDocumentVersion.get(documentVersionId) || { status: null, current_step_order: null, steps: [] })
        : { status: null, current_step_order: null, steps: [] };
      const canManageFill = Boolean(item.document_id || relatedFillRequests.length || fillWorkflow.steps.length);
      const canSign = relatedUserSignatures.some((request) => !request.responded_at);
      // Todo entregable de proceso admite carga manual (usage_role deprecado, siempre 'primary').
      const canUploadDeliverable = true;
      const canResetWorkflow = canCurrentUserResetWorkflow({
        userId,
        fillWorkflow,
        signatureRequests: relatedSignatureRequests,
      });
      const fallbackActions = {
        can_upload_deliverable: canUploadDeliverable,
        can_download_template: Boolean(item.template_artifact_id),
        can_manage_fill: canManageFill,
        can_review_signature_flow: Boolean(
          relatedSignatureSteps.length
          || Number(item.total_signature_count || 0) > 0
          || relatedSignatureRequests.length
        ),
        can_sign: canSign,
        can_reset_workflow: canResetWorkflow,
        can_open_process_chat: true,
        implemented: {
          upload_deliverable: false,
          download_template: false,
          manage_fill: false,
          review_signature_flow: false,
          sign: true,
          reset_workflow: true,
          process_chat: true
        }
      };
      const actions = relatedDocument?.actions || fallbackActions;
      return {
        ...item,
        start_date: relatedDocument?.start_date ?? item.start_date ?? null,
        end_date: relatedDocument?.end_date ?? item.end_date ?? null,
        user_started_at: relatedDocument?.user_started_at ?? item.user_started_at ?? null,
        origin_unit_id: relatedDocument?.origin_unit_id ?? item.origin_unit_id ?? task.responsible_unit_id ?? null,
        unit_label: relatedDocument?.unit_label ?? item.origin_unit_label ?? item.unit_label ?? task.responsible_unit_label ?? null,
        document_count: relatedDocuments.length,
        attachments: relatedDocument?.attachments || [],
        attachment_count: relatedDocument?.attachment_count ?? (relatedDocument?.attachments?.length || 0),
        participation: participationByTaskItemId.get(Number(item.id)) || {
          has_past_fill: false,
          has_past_signature: false,
        },
        pending_fill_count: relatedDocument?.pending_fill_count ?? relatedFillRequests.filter((request) => !request.responded_at).length,
        total_fill_count: relatedDocument?.total_fill_count ?? relatedFillRequests.length,
        workflow: relatedDocument?.workflow || {
          fill_requests: relatedFillRequests,
          fill_flow: fillWorkflow,
          fill_steps: fillWorkflow.steps,
          signature_steps: relatedSignatureSteps,
          signature_requests: relatedSignatureRequests,
          total_signature_steps: relatedSignatureSteps.length,
          current_fill_step_order: fillWorkflow.current_step_order || relatedFillRequests[0]?.step_order || null,
          current_signature_step_order: currentSignatureStepOrder
        },
        actions,
        document: relatedDocument,
        documents: relatedDocuments
      };
    });
    const pendingItems = items.filter((item) => item.status !== "completada" && item.status !== "cancelada").length;
    return {
      ...task,
      is_current_user_creator: Number(task.created_by_user_id) === Number(userId),
      task_item_count: items.length,
      pending_task_items: pendingItems,
      items
    };
  });

  // En el modelo nuevo "poder lanzar" = la configuracion corre en al menos un tipo de periodo.
  // Ya no hay modos manual_only/manual_custom_term; los periodos custom dejaron de crearse aqui
  // (las fechas de vencimiento viven en los entregables).
  const canLaunch = periodTypes.length > 0;

  return {
    definition: {
      ...definition,
      rules_count: rules.length,
      matching_rules_count: matchingRules.length,
      templates_count: templates.length,
      period_types_count: periodTypes.length,
      chat_context: {
        process_id: Number(definition.process_id),
        accessible_scope_unit_ids: Array.from(
          new Set(
            taskItems
              .map((item) => Number(item.scope_unit_id || 0))
              .filter((value) => Number.isFinite(value) && value > 0)
          )
        )
      }
    },
    summary: {
      tasks_total: enrichedTasks.length,
      tasks_pending: enrichedTasks.filter((task) => task.status !== "completada" && task.status !== "cancelada").length,
      task_items_pending: taskItems.filter((item) => item.status !== "completada" && item.status !== "cancelada").length,
      documents_total: documents.length,
      fill_requests_pending: fillRequests.filter((request) => !request.responded_at).length,
      signatures_pending: signatures.filter((signature) => !signature.responded_at).length,
      user_packages_total: userPackages.length
    },
    permissions: {
      can_launch_manual: canLaunch,
      can_launch_custom_term: false,
      can_use_existing_term: canLaunch,
      has_document: templates.length > 0
    },
    tasks: enrichedTasks,
    documents,
    fill_requests: fillRequests,
    signatures,
    dependencies: {
      rules: matchingRules.map((rule) => ({
        ...rule,
        display_label: buildRuleDisplayLabel(rule)
      })),
      period_types: periodTypes,
      templates
    },
    user_packages: userPackages,
    available_terms: terms
  };
};
