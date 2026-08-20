<template>
<div v-if="fillWorkflowState.subject" class="flex flex-col gap-5">
  <div class="deasy-card p-4">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 class="deasy-title deasy-title--section">Secuencia del flujo</h3>
      <AppTag variant="neutral">Vista operativa</AppTag>
    </div>
    <div v-if="!fillWorkflowState.subject?.workflow?.fill_steps?.length" class="text-sm text-muted">
      Este entregable todavía no tiene una secuencia de entrega visible.
    </div>
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="step in fillWorkflowState.subject.workflow.fill_steps"
        :key="`fill-step-combined-${step.id}-${step.request_id || 'na'}`"
        class="deasy-flow-step"
        :class="`deasy-flow-step--${getFillStepTono(step, fillWorkflowState.subject.workflow.fill_flow?.current_step_order)}`"
      >
        <div class="deasy-flow-step__accent"></div>
        <div class="flex flex-wrap justify-between items-start gap-3 pt-1">
          <div class="flex items-center gap-2">
            <span class="deasy-icon-box deasy-icon-box--md deasy-icon-box--neutral">
              {{ step.step_order }}
            </span>
            <div class="flex flex-col gap-1">
              <strong class="text-sm font-bold text-strong">Paso {{ step.step_order }}</strong>
              <span class="deasy-overline">Entrega</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 justify-end">
            <AppTag :variant="tonoLlenado(step.request_status)">
              {{ etiquetaLlenado(step.request_status) }}
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
          <p class="deasy-overline">Responsable</p>
          <p class="mt-0.5 text-sm font-semibold text-body m-0 leading-snug">{{ step.display_label }}</p>
        </div>
        <div v-if="step.response_note" class="deasy-card mt-2 px-3 py-2">
          <p class="deasy-overline">Nota</p>
          <p class="mt-0.5 mb-0 text-xs font-medium text-icon">{{ step.response_note }}</p>
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
  getFillStepTono,
} from '@/modules/home/views/homeView.helpers.js';
import { tonoLlenado, etiquetaLlenado } from '@/shared/utils/estadoTono.js';

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
