<template>
<div v-if="fillWorkflowState.subject" class="flex flex-col gap-5">
  <div class="rounded-[1.8rem] border border-brand-border bg-linear-to-br from-slate-50 via-white to-slate-100/70 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider m-0">Secuencia del flujo</h3>
      <AppTag variant="muted">Vista operativa</AppTag>
    </div>
    <div v-if="!fillWorkflowState.subject?.workflow?.fill_steps?.length" class="text-sm text-slate-500">
      Este entregable todavía no tiene una secuencia de entrega visible.
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="step in fillWorkflowState.subject.workflow.fill_steps"
        :key="`fill-step-combined-${step.id}-${step.request_id || 'na'}`"
        class="relative overflow-hidden rounded-[5%] border bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.07)] ring-1 ring-white/70 transition"
        :class="getFillStepCardClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"
      >
        <div class="absolute inset-x-0 top-0 h-3" :class="getFillStepAccentClass(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)"></div>
        <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-brand-surface-muted px-3 text-sm font-extrabold text-slate-700">
              {{ step.step_order }}
            </span>
            <div class="flex flex-col gap-1">
              <strong class="text-sm font-bold text-slate-800">Paso {{ step.step_order }}</strong>
              <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-text-muted">Entrega</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 justify-end">
            <AppTag :variant="getFillStepStatusTagVariant(step.request_status)">
              {{ getFillStepStatusLabel(step.request_status) }}
            </AppTag>
            <AppTag
              v-if="fillWorkflowState.subject.workflow.fill_flow?.current_step_order === step.step_order"
              variant="accent"
            >
              Actual
            </AppTag>
          </div>
        </div>
        <div class="mt-3 flex flex-col gap-0.5">
          <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-text-muted m-0">Responsable</p>
          <p class="mt-0.5 text-sm font-semibold text-slate-700 m-0 leading-snug">{{ step.display_label }}</p>
        </div>
        <div v-if="step.response_note" class="mt-2 rounded-xl border border-brand-border bg-slate-50/70 px-3 py-2">
          <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-text-muted m-0">Nota</p>
          <p class="mt-0.5 mb-0 text-xs font-medium text-brand-icon">{{ step.response_note }}</p>
        </div>
      </div>
    </div>
  </div>

  <DeliverableObservations
    :observations="observations"
    :loading="observationsLoading"
    :can-add="observationsCanAdd"
    :submitting="submittingObservation"
    :resolving-id="resolvingObservationId"
    phase="review"
    title="Observaciones de entrega"
    subtitle="Devoluciones, rechazos y notas de revisión del entregable."
    empty-text="Sin observaciones de entrega."
    @add="$emit('add-observation', $event)"
    @resolve="$emit('resolve-observation', $event)"
  />
</div>
</template>

<script setup>
// Pestaña ENTREGA del modal de detalle: la secuencia de pasos del flujo de llenado
// (responsable, estado, nota) y el hilo de observaciones de entrega.
// Extraída de HomeView.vue en la Fase C. Componente PRESENTACIONAL.
import AppTag from '@/shared/components/data/AppTag.vue';
import DeliverableObservations from '@/modules/home/components/DeliverableObservations.vue';
import {
  getFillStepCardClass,
  getFillStepAccentClass,
  getFillStepStatusLabel,
  getFillStepStatusTagVariant,
} from '@/modules/home/views/homeView.helpers.js';

defineProps({
  fillWorkflowState: { type: Object, required: true },
  observations: { type: Array, default: () => [] },
  observationsLoading: { type: Boolean, default: false },
  observationsCanAdd: { type: Boolean, default: false },
  submittingObservation: { type: Boolean, default: false },
  resolvingObservationId: { type: [Number, String], default: null },
});

defineEmits(['add-observation', 'resolve-observation']);
</script>
