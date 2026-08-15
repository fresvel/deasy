<script setup>
import AppButton from '@/shared/components/buttons/AppButton.vue';
import AppTag from '@/shared/components/data/AppTag.vue';
import PdfDropField from '@/shared/components/forms/PdfDropField.vue';
import {
  IconEye,
  IconPlayerPlayFilled,
  IconUpload,
  IconSignature,
  IconChecklist,
  IconCircleCheck,
  IconDownload,
  IconFileDescription,
  IconMessages,
  IconPaperclip,
} from '@tabler/icons-vue';

const UPLOAD_ACCEPT = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

const props = defineProps({
  // { key, item, task }
  deliverable: { type: Object, required: true },
  // Bundle of pure helper functions defined in the parent (HomeView).
  helpers: { type: Object, required: true },
  processingFillItemId: { type: [Number, String, null], default: null },
  fillWorkflowSubmitting: { type: Boolean, default: false },
  isUploadingDeliverable: { type: Boolean, default: false },
});

const emit = defineEmits([
  'toggle', 'open', 'start', 'upload', 'sign',
  'approve', 'download', 'template', 'preview', 'chat',
]);

const h = props.helpers;

// Click en el header o el cuerpo de la tarjeta abre el modal de detalle, EXCEPTO si el clic fue sobre un control
// interactivo (botones de acción, campo de subida, enlaces): esos conservan su propio comportamiento.
const onCardClick = (event) => {
  if (event.target.closest('button, input, label, a, .deliverable-inline-upload')) return;
  emit('open', props.deliverable);
};
</script>

<template>
  <article
    class="group/card relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(var(--elev-ink-rgb),0.04),0_8px_24px_-12px_rgba(var(--elev-ink-rgb),0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(var(--elev-ink-rgb),0.06),0_16px_32px_-16px_rgba(var(--elev-ink-rgb),0.18)]"
    :class="h.getDeliverableCardTone(deliverable.item).card"
    @click="onCardClick"
  >
    <span class="absolute inset-x-0 top-0 h-1" :class="h.getDeliverableCardTone(deliverable.item).accent"></span>
    <div class="flex h-full flex-col p-4 pt-[1.3125rem]">
      <div class="flex min-w-0 flex-col gap-3">
        <div
          class="-mx-4 -mt-[1.3125rem] flex cursor-pointer items-start justify-between gap-3 border-b px-4 pb-3 pt-3.5"
          :class="h.getDeliverableCardTone(deliverable.item).header"
          role="button"
          tabindex="0"
          aria-label="Abrir detalle del entregable"
          @keydown.enter.prevent="emit('open', deliverable)"
          @keydown.space.prevent="emit('open', deliverable)"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="flex items-center gap-1.5">
              <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-2xl" :class="h.getDeliverableCardTone(deliverable.item).iconChip">
                <component :is="h.getDeliverableStateIcon(deliverable.item)" class="h-3.5 w-3.5" />
              </span>
              <span class="truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em]" :class="h.getDeliverableCardTone(deliverable.item).responsibilityLabel">
                {{ h.getDeliverableUnitLabel(deliverable.item) || 'Unidad' }}
              </span>
              <span
                v-if="deliverable.item.attachment_count"
                class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-[0.62rem] font-bold text-muted"
                :title="`${deliverable.item.attachment_count} anexo(s)`"
              >
                <IconPaperclip class="h-3 w-3" />{{ deliverable.item.attachment_count }}
              </span>
            </div>
            <p class="m-0 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-strong" :title="deliverable.item.template_artifact_name">
              {{ deliverable.item.template_artifact_name || `Entregable #${deliverable.item.id}` }}
              <span v-if="deliverable.item.document_version" class="ml-0.5 whitespace-nowrap align-middle text-[0.72rem] font-bold" :class="h.getDeliverableCardTone(deliverable.item).responsibilityLabel">
                v{{ deliverable.item.document_version }}
              </span>
            </p>
            <p class="m-0 min-w-0 truncate text-[0.78rem] font-medium leading-snug text-muted">
              {{ h.getDeliverablePeriodLabel(deliverable.task) }}
            </p>
            <p v-if="deliverable.item.item_mode === 'routed' && deliverable.item.recipient_name" class="m-0 min-w-0 truncate text-[0.78rem] font-semibold leading-snug text-primary">
              Para: {{ deliverable.item.recipient_name }}
            </p>
          </div>
          <AppButton
            variant="plain"
            :class-name="['inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4', h.getDeliverableHeaderActionTone(deliverable.item)].join(' ')"
            aria-label="Abrir detalle del entregable"
            title="Abrir detalle del entregable"
            @click.stop
            @click="emit('open', deliverable)" icon-only>
            <IconEye class="h-[1.15rem] w-[1.15rem]" />
          </AppButton>
        </div>
      </div>

      <div v-show="!h.isDeliverableCollapsed(deliverable.item)" class="mt-3 flex flex-col gap-3">
        <div v-if="h.getDeliverableProgress(deliverable.item)" class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">{{ h.getDeliverableProgress(deliverable.item).label }}</p>
            <AppTag :variant="h.getDeliverableDueState(deliverable.item).variant" class-name="shrink-0">{{ h.getDeliverableDueState(deliverable.item).value }}</AppTag>
          </div>
          <p class="m-0 line-clamp-1 text-[0.9rem] font-semibold leading-snug text-body">{{ h.getDeliverableCurrentResponsibility(deliverable.item).name }}</p>
          <div class="flex items-center gap-2.5">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div class="h-full rounded-full transition-all duration-300" :class="h.getDeliverableCardTone(deliverable.item).accent" :style="{ width: `${h.getDeliverableProgress(deliverable.item).percent}%` }"></div>
            </div>
            <span class="shrink-0 text-[0.7rem] font-semibold text-muted">{{ h.getDeliverableProgress(deliverable.item).current }}/{{ h.getDeliverableProgress(deliverable.item).total }}</span>
          </div>
        </div>

        <div class="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 border-t border-line pt-3">
          <button v-if="h.shouldShowStartDeliverable(deliverable.item)" type="button" class="group deasy-deliverable-action deasy-deliverable-action--start" :disabled="processingFillItemId === deliverable.item.id || !h.canStartDeliverableAction(deliverable.item)" @click="emit('start', deliverable.item)">
            <div class="deasy-deliverable-action__chip"><IconPlayerPlayFilled class="h-4.5 w-4.5" /></div>
            <div class="deasy-deliverable-action__label"><span class="deasy-deliverable-action__text">{{ processingFillItemId === deliverable.item.id ? 'Iniciando...' : 'Iniciar' }}</span></div>
          </button>
          <PdfDropField v-else-if="h.shouldShowUploadDeliverable(deliverable.item)" class="h-full" :input-id="`deliverable-upload-${deliverable.item.id}`" variant="compact" :icon="IconUpload" :disabled="!deliverable.item.actions?.can_upload_deliverable || isUploadingDeliverable" :title="''" :action-text="h.getUploadActionLabel(deliverable.item)" help-text="" :accept="UPLOAD_ACCEPT" @files-selected="emit('upload', { item: deliverable.item, files: $event })" />
          <button v-else-if="h.shouldShowSign(deliverable.item)" type="button" class="group deasy-deliverable-action deasy-deliverable-action--sign" :disabled="!deliverable.item.actions?.implemented?.sign" @click="emit('sign', deliverable.item)">
            <div class="deasy-deliverable-action__chip"><IconSignature class="h-4.5 w-4.5" /></div>
            <div class="deasy-deliverable-action__label"><span class="deasy-deliverable-action__text">Firmar</span></div>
          </button>
          <button v-else type="button" class="group deasy-deliverable-action deasy-deliverable-action--open" @click="emit('open', deliverable)">
            <div class="deasy-deliverable-action__chip"><IconChecklist class="h-4.5 w-4.5" /></div>
            <div class="deasy-deliverable-action__label"><span class="deasy-deliverable-action__text">Abrir</span></div>
          </button>

          <div class="flex h-full items-center justify-end gap-1.5">
            <AppButton v-if="!h.shouldShowStartDeliverable(deliverable.item) && h.canApproveFillRequestForPayload(deliverable.item)" variant="softSuccess" size="sm" :disabled="fillWorkflowSubmitting" :aria-label="h.getFillApproveActionLabelForPayload(deliverable.item)" @click="emit('approve', deliverable.item)" icon-only><IconCircleCheck class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton v-else-if="!h.shouldShowStartDeliverable(deliverable.item) && h.getDeliverableSubject(deliverable.item).preloadFilePath" variant="softInfo" size="sm" aria-label="Descargar PDF" @click="emit('download', deliverable.item)" icon-only><IconDownload class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton v-else-if="!h.shouldShowStartDeliverable(deliverable.item) && h.shouldShowTemplateDownload(deliverable.item)" variant="softInfo" size="sm" aria-label="Descargar plantilla" @click="emit('template', deliverable.item)" icon-only><IconFileDescription class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton v-if="!h.shouldShowStartDeliverable(deliverable.item) && h.getDeliverableSubject(deliverable.item).preloadPdfPath" variant="softInfo" size="sm" aria-label="Ver PDF" @click="emit('preview', deliverable.item)" icon-only><IconEye class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton variant="plain" :class-name="['group inline-flex rounded-xl border bg-white transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4', h.getDeliverableHeaderActionTone(deliverable.item)].join(' ')" :disabled="!deliverable.item.actions?.can_open_process_chat" aria-label="Abrir chat" @click="emit('chat', deliverable.item)" icon-only><IconMessages class="h-[1.3rem] w-[1.3rem]" /></AppButton>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
