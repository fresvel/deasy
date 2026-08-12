<template>
<div v-if="signatureFlowState.loading" class="rounded-2xl border border-dashed border-brand-border bg-brand-surface-muted p-6 text-center text-sm font-semibold text-brand-icon">
  Consultando la secuencia de firmas...
</div>
<div v-else-if="signatureFlowState.error" class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
  {{ signatureFlowState.error }}
</div>
<div v-else-if="signatureFlowState.snapshot" class="flex flex-col gap-5">
  <section class="rounded-2xl border border-brand-border bg-brand-white p-4 flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Resumen del flujo</h3>
        <p class="text-xs text-slate-500 m-0">Documento y estado actual de firmas.</p>
      </div>
      <AppTag :variant="signatureFlowState.snapshot?.canOperate ? 'success' : 'warning'">
        {{ signatureFlowState.snapshot?.signatureFlow?.statusCode ? signatureFlowState.snapshot.signatureFlow.statusCode : capitalize(signatureFlowState.snapshot?.currentStatus) || 'Pendiente' }}
      </AppTag>
    </div>
    <div class="grid gap-3 md:grid-cols-3">
      <div class="rounded-2xl border border-brand-border bg-slate-50/70 p-4">
        <p class="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Documento</p>
        <p class="text-sm font-semibold text-slate-800 m-0">{{ signatureFlowState.subject?.title || 'Documento sin título' }}</p>
      </div>
      <div class="rounded-2xl border border-brand-border bg-slate-50/70 p-4">
        <p class="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Paso actual</p>
        <p class="text-sm font-semibold text-slate-800 m-0">{{ getCurrentSignatureStepOrder(signatureFlowState.snapshot) || '—' }}</p>
      </div>
      <div class="rounded-2xl border border-brand-border bg-slate-50/70 p-4">
        <p class="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1">Solicitudes</p>
        <p class="text-sm font-semibold text-slate-800 m-0">{{ signatureFlowState.snapshot.signatureRequests?.length || 0 }}</p>
      </div>
    </div>
  </section>

  <section class="rounded-[1.8rem] border border-brand-border bg-linear-to-br from-slate-50 via-white to-slate-100/70 p-4 flex flex-col gap-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Pasos del flujo</h3>
      <AppTag variant="muted">
        {{ (signatureFlowState.snapshot.signatureSteps || []).length }} pasos
      </AppTag>
    </div>
    <div v-if="!signatureFlowState.snapshot.signatureSteps?.length" class="text-sm text-slate-500">
      Aún no hay pasos de firma: el flujo se genera al completarse la entrega del documento.
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="step in signatureFlowState.snapshot.signatureSteps"
        :key="`combined-signature-step-${step.id || step.step_order}`"
        class="relative overflow-hidden rounded-[5%] border bg-brand-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
        :class="getSignatureStepCardClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"
      >
        <div class="absolute inset-x-0 top-0 h-3" :class="getSignatureStepAccentClass(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))"></div>
        <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-brand-surface-muted px-3 text-sm font-extrabold text-slate-700">
              {{ step.step_order || '—' }}
            </span>
            <div class="flex flex-col gap-1">
              <p class="text-sm font-bold text-slate-800 m-0">Paso {{ step.step_order || '—' }}</p>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-text-muted m-0">Firma</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 justify-end">
            <AppTag
              :variant="getSignatureStepStatusVariant(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot)))"
            >
              {{ getSignatureStepStatusLabel(getSignatureStepStatusCode(step, signatureFlowState.snapshot.signatureRequests, getCurrentSignatureStepOrder(signatureFlowState.snapshot))) }}
            </AppTag>
            <AppTag :variant="step.assignees?.length ? 'success' : 'warning'">
              {{ step.assignees?.length ? `${step.assignees.length} firmante(s)` : 'Sin responsables' }}
            </AppTag>
          </div>
        </div>
        <div class="mt-3 flex flex-col gap-0.5">
          <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-text-muted m-0">Firmante</p>
          <p class="mt-0.5 text-sm font-semibold text-slate-700 m-0 leading-snug">
            {{ getSignatureStepAssignedSummary(step, signatureFlowState.snapshot.signatureRequests) }}
          </p>
        </div>
      </div>
    </div>
  </section>

  <DeliverableObservations
    :observations="observations"
    :loading="observationsLoading"
    :can-add="observationsCanAdd"
    :submitting="submittingObservation"
    :resolving-id="resolvingObservationId"
    phase="signature"
    title="Observaciones de firma"
    subtitle="Notas, devoluciones y rechazos del flujo de firmas."
    empty-text="Sin observaciones de firma."
    @add="$emit('add-observation', $event)"
    @resolve="$emit('resolve-observation', $event)"
  />
</div>
<div v-else class="rounded-2xl border border-brand-border bg-brand-surface-muted p-6 text-sm font-semibold text-brand-icon text-center">
  No hay datos de firmas disponibles para este entregable.
</div>
</template>

<script setup>
// Pestaña FIRMAS del modal de detalle: resumen del flujo, pasos de firma con sus firmantes
// y el hilo de observaciones de firma.
// Extraída de HomeView.vue en la Fase C. Componente PRESENTACIONAL.
import AppTag from '@/shared/components/data/AppTag.vue';
import DeliverableObservations from '@/modules/home/components/DeliverableObservations.vue';
import {
  getSignatureStepCardClass,
  getSignatureStepAccentClass,
  getSignatureStepStatusCode,
  getSignatureStepStatusLabel,
  getSignatureStepStatusVariant,
} from '@/modules/home/views/homeView.helpers.js';

defineProps({
  signatureFlowState: { type: Object, required: true },
  observations: { type: Array, default: () => [] },
  observationsLoading: { type: Boolean, default: false },
  observationsCanAdd: { type: Boolean, default: false },
  submittingObservation: { type: Boolean, default: false },
  resolvingObservationId: { type: [Number, String], default: null },
  capitalize: { type: Function, required: true },
  getCurrentSignatureStepOrder: { type: Function, required: true },
  getSignatureStepAssignedSummary: { type: Function, required: true },
});

defineEmits(['add-observation', 'resolve-observation']);
</script>
