// Helpers PUROS de HomeView.vue (sin estado reactivo: entrada -> salida).
// Extraidos en la Fase A del refactor del God Object (HomeView.vue, 7445 L). Son
// formateadores de fecha/tamano y traductores de estado/etiqueta/clase de los flujos de
// entrega y firma. Al no tocar refs ni el DOM, son testeables con Vitest en aislamiento.
// Ver docs/planes/referencia/linea-base-homeview.md

export const formatAttachmentSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const normalized = String(value).slice(0, 10);
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getSignatureStepStatusCode = (step, requests = [], currentStepOrder = null) => {
  const stepOrder = Number(step?.step_order || step?.stepOrder || 0);
  const relatedRequests = (requests || []).filter((request) => Number(request?.stepOrder || 0) === stepOrder);
  if (!relatedRequests.length) {
    return 'unresolved';
  }

  const codes = relatedRequests.map((request) => String(request?.requestStatusCode || '').trim().toLowerCase());
  if (codes.some((code) => ['rechazado', 'cancelado'].includes(code))) {
    return 'rejected';
  }
  if (codes.every((code) => code === 'completado')) {
    return 'completed';
  }
  if (currentStepOrder && stepOrder === Number(currentStepOrder)) {
    return 'current';
  }
  if (codes.some((code) => code === 'en_progreso')) {
    return 'current';
  }
  return 'pending';
};

export const getSignatureStepStatusLabel = (statusCode) => {
  switch (String(statusCode || '').trim().toLowerCase()) {
    case 'completed':
      return 'Firmado';
    case 'current':
      return 'En curso';
    case 'rejected':
      return 'Rechazado';
    case 'pending':
      return 'Pendiente';
    case 'unresolved':
      return 'Sin responsables';
    default:
      return 'Pendiente';
  }
};

export const getSignatureStepStatusVariant = (statusCode) => {
  switch (String(statusCode || '').trim().toLowerCase()) {
    case 'completed':
      return 'success';
    case 'current':
      return 'info';
    case 'rejected':
      return 'danger';
    case 'pending':
    case 'unresolved':
      return 'salmon';
    default:
      /* `muted` murio en L1 el 2026-08-15 —declaraba el mismo cuerpo que `neutral`— y estos dos
         productores se quedaron atras: ningun gate podia verlos porque `:variant` es dinamico y
         `check-variants` solo lee atributos literales. Lo que hacian era caer al fallback de
         `AppTag` (que es `neutral`, o sea el mismo pixel) avisando por consola en desarrollo. */
      return 'neutral';
  }
};

/* `getSignatureStepCardClass` y `getSignatureStepAccentClass` murieron el 2026-08-15 (F3.3 · L6).
   Devolvian cadenas de Tailwind —incluidos 9 hex sueltos— para lo mismo que `…StatusVariant` ya
   resolvia bien: el nombre del tono. Su cuerpo vive ahora en `deasy-signature-step--{tono}` y su
   banda en `__accent`, ambos en `signatures.css`. Lo unico que hacia falta era dejar de traducir
   dos veces el mismo codigo de estado. */

export const formatTriggerLabel = (periodType) => {
  if (!periodType) return 'Periodo';
  return periodType.term_type_name || periodType.term_type_code || 'Tipo de periodo';
};

// Firmante/responsable → payload backend (persona concreta o cargo con ámbito).
export const mapSigner = (s) => (s.kind === 'cargo'
  ? { cargo_id: s.cargo_id, unit_id: s.unit_id || null, unit_scope_type: s.unit_id ? 'unit_exact' : 'all_units' }
  : { person_id: s.person_id });

// El modal de envío/tarea usa el flujo de runtime (elabora/firma) cuando es routed o alta libre.

export const getFillRequestStatusCode = (request) =>
  String(request?.status_name || request?.statusName || request?.status || request?.request_status || request?.requestStatus || '').trim().toLowerCase();

export const isCompletedSignatureRequestStatus = (value) =>
  ['completado', 'completed'].includes(String(value || '').trim().toLowerCase());

export const getWorkflowStateTagVariant = (value, fallback = 'neutral') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['completado', 'completed', 'aprobado', 'approved', 'firmado', 'signed'].includes(normalized)) return 'success';
  if (['en proceso', 'in_progress', 'in progress', 'procesando', 'listo para firma', 'pendiente de firma'].includes(normalized)) return 'info';
  if (['pendiente', 'pending', 'devuelto', 'returned'].includes(normalized)) return 'warning';
  if (['rechazado', 'rejected', 'cancelado', 'cancelled', 'error'].includes(normalized)) return 'danger';
  return fallback;
};

export const getDeliverableAccessTagVariant = (accessSource) => {
  const normalized = String(accessSource || '').trim().toLowerCase();
  if (normalized === 'directo') return 'success';
  if (normalized === 'derivado') return 'accent';
  return 'neutral';
};

export const getFillStepStatusLabel = (status) => {
  const code = String(status || '').trim().toLowerCase();
  if (code === 'approved') return 'Aprobado';
  if (code === 'in_progress') return 'En progreso';
  if (code === 'returned') return 'Devuelto';
  if (code === 'rejected') return 'Rechazado';
  if (code === 'cancelled') return 'Cancelado';
  return 'Pendiente';
};

export const getFillStepStatusTagVariant = (status) => {
  const code = String(status || '').trim().toLowerCase();
  if (code === 'approved') return 'success';
  if (code === 'in_progress') return 'info';
  if (code === 'returned') return 'warning';
  if (code === 'rejected') return 'danger';
  if (code === 'cancelled') return 'neutral';
  return 'neutral';
};

export const formatWorkflowDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const getFillStepCardClass = (step, currentStepOrder) => {
  if (Number(currentStepOrder || 0) === Number(step?.step_order || 0)) {
    return 'border-blue-light-200 bg-linear-to-br from-blue-light-50/80 via-white to-blue-light-100/50';
  }
  const code = String(step?.request_status || '').trim().toLowerCase();
  if (code === 'approved') return 'border-emerald-200 bg-linear-to-br from-emerald-50/80 via-white to-emerald-100/40';
  if (code === 'rejected') return 'border-rose-200 bg-linear-to-br from-rose-50/80 via-white to-rose-100/40';
  if (code === 'returned') return 'border-amber-200 bg-linear-to-br from-amber-50/80 via-white to-amber-100/40';
  return 'border-line bg-linear-to-br from-surface/90 via-white to-gray-100/60';
};

export const getFillStepAccentClass = (step, currentStepOrder) => {
  if (Number(currentStepOrder || 0) === Number(step?.step_order || 0)) {
    return 'bg-linear-to-r from-blue-light-300 via-blue-light-400 to-blue-light-300';
  }
  const code = String(step?.request_status || '').trim().toLowerCase();
  if (code === 'approved') return 'bg-linear-to-r from-emerald-300 via-emerald-400 to-green-300';
  if (code === 'rejected') return 'bg-linear-to-r from-rose-300 via-rose-400 to-red-300';
  if (code === 'returned') return 'bg-linear-to-r from-amber-300 via-amber-400 to-orange-300';
  return 'bg-linear-to-r from-gray-200 via-line-strong to-gray-200';
};

export const getFillStepResolverLabel = (step) => {
  const bits = [];
  if (step.resolver_type) bits.push(step.resolver_type);
  if (step.selection_mode) bits.push(step.selection_mode);
  return bits.join(' · ');
};

export const getSignatureStepResolverLabel = (step) => {
  const bits = [];
  if (step?.resolverType) bits.push(step.resolverType);
  if (step?.selection_mode) bits.push(step.selection_mode);
  if (step?.selectionMode) bits.push(step.selectionMode);
  return bits.join(' · ') || 'cargo_in_scope';
};
