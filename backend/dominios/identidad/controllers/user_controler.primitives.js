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

// La carpeta de la CORRECCION dentro de la ronda (2026-08-23). El almacenamiento pasa a explicarse
// solo: `…/v0001/m0003/working/pdf/…` se lee «ronda 1, correccion 3» sin consultar nada.
//
// Ojo con lo que esto NO arregla, porque es facil creer lo contrario: en MinIO nunca se perdio un
// fichero. El nombre lleva sello de tiempo y UUID, asi que cada subida escribe un objeto NUEVO. Lo
// que se perdia era el PUNTERO —`working_file_path` se sobrescribe— y los objetos anteriores
// quedaban huerfanos, no borrados. Eso lo arregla `document_version_uploads`; esto solo hace que
// un humano pueda navegar el bucket y entender lo que ve.
export const buildDocumentMinorFolder = (minor) => `m${String(Math.max(1, Number(minor || 1))).padStart(4, "0")}`;

export const buildWorkingObjectPathForUpload = ({ basePath, originalName, extension, minor = 1 }) => {
  const safeOriginalName = sanitizeStorageSegment(originalName, `archivo.${extension || "bin"}`);
  const safeExtension = sanitizeStorageSegment(extension || "bin", "bin").toLowerCase();
  return [
    basePath,
    buildDocumentMinorFolder(minor),
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

// AQUI VIVIA `createUnitSubtreeResolver`, y se fue con `unit_subtree` (frente 25, P19): era su
// unico consumidor. Resolvia «esta unidad y toda su descendencia» con un recorrido iterativo que
// llevaba `visited`, asi que un ciclo en `unit_relations` no lo colgaba --a diferencia de las dos
// CTE recursivas que hacian lo mismo en SQL, que se fueron el mismo dia--.

export const doesPositionMatchRule = (position, rule) => {
  // SIN LA RAMA DEL PUESTO EXACTO (frente 25, P25): se fue con la columna.
  // EL CARGO Y EL AMBITO VIENEN DE LA OBLIGACION (frente 25, P10). Con prefijo `linea_` porque la
  // fila mezcla las dos tablas.
  //
  // ⚠️ ESTA FUNCION ES GEMELA DE `positionMatchesRule` en `UserMenuService.js`: el mismo predicado,
  // escrito dos veces. No se unifica aqui para no mezclar dos cambios, pero queda dicho: si uno se
  // corrige y el otro no, el menu y el panel dejan de coincidir sin que nada avise.
  if (rule.linea_cargo_id && Number(position.cargo_id) !== Number(rule.linea_cargo_id)) {
    return false;
  }
  switch (rule.linea_unit_scope_type) {
    case "all_units":
      return true;
    case "unit_type":
      return rule.linea_unit_type_id && Number(position.unit_type_id) === Number(rule.linea_unit_type_id);
    case "unit_exact":
    default:
      if (!rule.linea_unit_id) {
        return false;
      }
      return Number(position.unit_id) === Number(rule.linea_unit_id);
  }
};

export const buildRuleDisplayLabel = (rule) => {
  // SIN EL ROTULO DEL PUESTO EXACTO (frente 25, P25): la regla ya no nombra una plaza.
  const parts = [];
  if (rule.linea_unit_scope_type === "all_units") {
    parts.push("Todas las unidades");
  } else if (rule.linea_unit_scope_type === "unit_type" && rule.unit_type_name) {
    parts.push(`Tipo: ${rule.unit_type_name}`);
  } else if (rule.linea_unit_scope_type === "unit_exact" && rule.unit_name) {
    parts.push(`Unidad: ${rule.unit_name}`);
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

// UNA SOLA PREGUNTA PARA LOS DOS LADOS. Eran dos funciones —`isPendingLikeFillStatus` con el
// vocabulario ingles y `isPendingLikeSignatureStatus` tolerando los DOS idiomas a la vez— y esa
// duplicacion era el sintoma, no la causa: con un vocabulario unico (fase 3 del frente 24) la
// pregunta «¿esto sigue abierto?» es la misma en entrega y en firma.
export const estaAbiertoElTurno = (value) =>
  ["pendiente", "en_progreso"].includes(String(value || "").trim().toLowerCase());

/* ⚠️ LEE LAS CLAVES QUE EL PANEL EMITE HOY, y esto costo una regresion silenciosa el 2026-10-09:
   el paso 4-bis renombro el recorrido del panel (`current_step_order`->`paso_actual`,
   `steps`->`pasos`, `request_status`->`estado`) y esta funcion seguia preguntando por las viejas,
   asi que `can_reset_workflow` salia SIEMPRE false --sin error, sin aviso, con el boton de rehacer
   desaparecido--. Lo cazo el golden del panel; sus pruebas unitarias NO, porque se fabrican el
   fillWorkflow a mano y se lo dieron con la forma vieja. La leccion: un test que construye su
   propio fixture no nota que el productor cambio de forma. */
export const canCurrentUserResetWorkflow = ({ userId, fillWorkflow, signatureRequests }) => {
  const normalizedUserId = Number(userId || 0);
  if (!normalizedUserId) return false;

  const currentFillStepOrder = Number(fillWorkflow?.paso_actual || 0);
  if (currentFillStepOrder > 0) {
    const canResetFromFill = (fillWorkflow?.pasos || []).some((step) =>
      Number(step?.step_order || 0) === currentFillStepOrder
      && Number(step?.assigned_person_id || 0) === normalizedUserId
      && estaAbiertoElTurno(step?.estado)
      && !step?.responded_at
    );
    if (canResetFromFill) {
      return true;
    }
  }

  const pendingSignatureRequests = (Array.isArray(signatureRequests) ? signatureRequests : [])
    .filter((request) => estaAbiertoElTurno(request?.estado || request?.status))
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
