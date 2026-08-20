// Helpers PUROS de HomeView.vue (sin estado reactivo: entrada -> salida).
// Extraidos en la Fase A del refactor del God Object (HomeView.vue, 7445 L). Son
// formateadores de fecha/tamano y traductores de estado/etiqueta/clase de los flujos de
// entrega y firma. Al no tocar refs ni el DOM, son testeables con Vitest en aislamiento.
// Ver docs/planes/referencia/linea-base-homeview.md

import { tonoPasoLlenado } from "@/shared/utils/estadoTono.js";

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

/* `getSignatureStepStatusVariant` murio el 2026-08-20 (F9-bis). Traducia
   completed/current/rejected/pending/unresolved a un tono con un `switch` propio: es
   `tonoPasoFirma` de `estadoTono.js`, con el mismo mapa y en el sitio del contrato. */

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

/* `getWorkflowStateTagVariant` murio el 2026-08-20 (F9-bis). Era una lista bilingue escrita a
   mano que se contradecia con las otras tres del repo en `pendiente`, `en proceso` y
   `cancelado`. Es `tonoFlujo`, que mira en los ejes reales por orden. */

/* `getDeliverableAccessTagVariant` murio el 2026-08-20 (F9-bis): es `tonoAcceso`. */

/* `getFillStepStatusLabel` y `getFillStepStatusTagVariant` murieron el 2026-08-20 (F9-bis):
   son `etiquetaLlenado` y `tonoLlenado`, el eje de `fill_requests.status`. El segundo dejaba
   `pending` sin caso y caia a NEUTRAL; el eje lo pinta SALMON, como el resto del sistema. */

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

/* `getFillStepCardClass` y `getFillStepAccentClass` murieron el 2026-08-15 (F3.3 · L7), y no las
   encontro el censo de L6 sino el GATE: `check-state-tone` las saco a la primera pasada. Eran las
   gemelas exactas de las dos de firma —misma forma, mismos degradados, mismo par card/accent— pero
   su nombre no decia «signature», asi que la busqueda de L6 paso por encima.

   Lo unico que queda es la traduccion valor -> tono, que es el contrato. El cuerpo vive en
   `deasy-flow-step--{tono}`, el mismo bloque que usa el flujo de firma: son el mismo componente.

   `returned` -> `warning` es el unico tono que el flujo de firma no gasta: un paso de llenado
   puede estar DEVUELTO, y eso no existe firmando. */
export const getFillStepTono = (step, currentStepOrder) => tonoPasoLlenado(
  step?.request_status,
  Number(currentStepOrder || 0) === Number(step?.step_order || 0)
);

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
