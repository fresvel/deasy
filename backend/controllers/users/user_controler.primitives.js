// Helpers puros de user_controler.js (sin acceso a datos ni estado de módulo).
// Extraídos en la Fase 3 (God Object #2). Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-user-controler-2026-07.md
import { randomUUID } from "node:crypto";

// --- Rutas de almacenamiento (construcción, sin IO) ---

export const sanitizeStorageSegment = (value, fallback = "na") =>
  String(value ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;

export const buildDocumentVersionFolder = (sequenceValue) => {
  const sequence = Math.max(1, Number(sequenceValue || 1));
  return `v${String(sequence).padStart(4, "0")}`;
};

export const buildCanonicalDocumentVersionBasePath = (target) => {
  const year =
    Number(target.term_year) ||
    Number(String(target.term_start_date || "").slice(0, 4)) ||
    new Date().getFullYear();
  const versionFolder = buildDocumentVersionFolder(target.document_version_sequence);
  return [
    String(target.scope_unit_id),
    "PROCESOS",
    String(target.process_id),
    "ANIOS",
    String(year),
    "TIPOS_PERIODO",
    String(target.term_type_id),
    "PERIODOS",
    String(target.term_id),
    "TAREAS",
    String(target.task_id),
    "Documentos",
    String(target.document_id),
    versionFolder
  ].join("/");
};

export const buildWorkingObjectPathForUpload = ({ basePath, originalName, extension }) => {
  const safeOriginalName = sanitizeStorageSegment(originalName, `archivo.${extension || "bin"}`);
  const safeExtension = sanitizeStorageSegment(extension || "bin", "bin").toLowerCase();
  return [
    basePath,
    "working",
    safeExtension,
    `${Date.now()}-${randomUUID()}-${safeOriginalName}`
  ].join("/");
};

// --- Anexos del entregable ---

export const buildAttachmentObjectPath = ({ basePath, originalName, extension }) => {
  const safeOriginalName = sanitizeStorageSegment(originalName, `anexo.${extension || "bin"}`);
  const safeExtension = sanitizeStorageSegment(extension || "bin", "bin").toLowerCase();
  return [
    basePath,
    "attachments",
    safeExtension,
    `${Date.now()}-${randomUUID()}-${safeOriginalName}`
  ].join("/");
};

export const mapAttachmentRow = (row) => ({
  id: Number(row.id),
  document_version_id: Number(row.document_version_id),
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

// --- Identidad / alcance del usuario en la petición ---

export const getNumericUserId = (req) => {
  const userIdRaw = req.params?.id ?? req.query?.user_id ?? req.query?.userId ?? req.body?.user_id ?? req.body?.userId;
  const userId = Number(userIdRaw);
  return Number.isNaN(userId) ? null : userId;
};

export const getAuthenticatedUserId = (req) => {
  const userId = Number(req.user?.uid);
  return Number.isNaN(userId) ? null : userId;
};

export const isAuthorizedUserScope = (req, requestedUserId) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  return Boolean(authenticatedUserId && Number(authenticatedUserId) === Number(requestedUserId));
};

// --- Resolución de jerarquía de unidades y coincidencia de reglas ---

export const createUnitSubtreeResolver = (childrenByUnit) => {
  const cache = new Map();
  return (unitId) => {
    if (!unitId) {
      return new Set();
    }
    const normalizedUnitId = Number(unitId);
    if (cache.has(normalizedUnitId)) {
      return cache.get(normalizedUnitId);
    }
    const visited = new Set([normalizedUnitId]);
    const stack = [normalizedUnitId];
    while (stack.length) {
      const current = stack.pop();
      const children = childrenByUnit.get(current) || [];
      children.forEach((childId) => {
        const normalizedChildId = Number(childId);
        if (!visited.has(normalizedChildId)) {
          visited.add(normalizedChildId);
          stack.push(normalizedChildId);
        }
      });
    }
    cache.set(normalizedUnitId, visited);
    return visited;
  };
};

export const doesPositionMatchRule = (position, rule, getUnitSubtree) => {
  if (rule.position_id) {
    return Number(position.position_id) === Number(rule.position_id);
  }
  if (rule.recipient_policy === "exact_position") {
    return false;
  }
  if (rule.cargo_id && Number(position.cargo_id) !== Number(rule.cargo_id)) {
    return false;
  }
  switch (rule.unit_scope_type) {
    case "all_units":
      return true;
    case "unit_type":
      return rule.unit_type_id && Number(position.unit_type_id) === Number(rule.unit_type_id);
    case "unit_subtree":
      return rule.unit_id && getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
    case "unit_exact":
    default:
      if (!rule.unit_id) {
        return false;
      }
      return Number(position.unit_id) === Number(rule.unit_id);
  }
};

export const buildRuleDisplayLabel = (rule) => {
  if (rule.position_title) {
    return `Puesto exacto: ${rule.position_title}`;
  }
  const parts = [];
  if (rule.unit_scope_type === "all_units") {
    parts.push("Todas las unidades");
  } else if (rule.unit_scope_type === "unit_type" && rule.unit_type_name) {
    parts.push(`Tipo: ${rule.unit_type_name}`);
  } else if ((rule.unit_scope_type === "unit_exact" || rule.unit_scope_type === "unit_subtree") && rule.unit_name) {
    parts.push(rule.unit_scope_type === "unit_subtree" ? `Unidad y jerarquía: ${rule.unit_name}` : `Unidad: ${rule.unit_name}`);
  }
  if (rule.cargo_name) {
    parts.push(`Cargo: ${rule.cargo_name}`);
  }
  return parts.join(" | ") || `Regla #${rule.id}`;
};

// --- Etiquetas y estados del flujo de llenado / firma ---

export const buildFillStepDisplayLabel = (step) => {
  const resolverType = String(step.resolver_type || "").trim();
  if (step.assigned_person_name) {
    return step.assigned_person_name;
  }
  switch (resolverType) {
    case "document_owner":
      return "Propietario del documento";
    case "task_assignee":
      return "Responsable de la tarea";
    case "specific_person":
      return "Persona específica";
    case "position":
      return step.position_title || "Puesto definido";
    case "cargo_in_scope":
      if (step.cargo_name && step.unit_name) {
        return `${step.cargo_name} · ${step.unit_name}`;
      }
      if (step.cargo_name && step.unit_type_name) {
        return `${step.cargo_name} · ${step.unit_type_name}`;
      }
      return step.cargo_name || "Cargo según alcance";
    case "manual_pick":
      return "Selección manual";
    default:
      return "Responsable no resuelto";
  }
};

export const isPendingLikeFillStatus = (value) =>
  ["pending", "in_progress"].includes(String(value || "").trim().toLowerCase());

export const isPendingLikeSignatureStatus = (value) =>
  ["pendiente", "pending", "en_progreso", "in_progress"].includes(String(value || "").trim().toLowerCase());

export const canCurrentUserResetWorkflow = ({ userId, fillWorkflow, signatureRequests }) => {
  const normalizedUserId = Number(userId || 0);
  if (!normalizedUserId) return false;

  const currentFillStepOrder = Number(fillWorkflow?.current_step_order || 0);
  if (currentFillStepOrder > 0) {
    const canResetFromFill = (fillWorkflow?.steps || []).some((step) =>
      Number(step?.step_order || 0) === currentFillStepOrder
      && Number(step?.assigned_person_id || 0) === normalizedUserId
      && isPendingLikeFillStatus(step?.request_status)
      && !step?.responded_at
    );
    if (canResetFromFill) {
      return true;
    }
  }

  const pendingSignatureRequests = (Array.isArray(signatureRequests) ? signatureRequests : [])
    .filter((request) => isPendingLikeSignatureStatus(request?.request_status_code || request?.status_name || request?.status))
    .filter((request) => !request?.responded_at)
    .sort((a, b) => Number(a?.step_order || 0) - Number(b?.step_order || 0));

  const currentSignatureStepOrder = Number(pendingSignatureRequests[0]?.step_order || 0);
  if (!currentSignatureStepOrder) {
    return false;
  }

  return pendingSignatureRequests.some((request) =>
    Number(request?.step_order || 0) === currentSignatureStepOrder
    && Number(request?.assigned_person_id || 0) === normalizedUserId
  );
};
