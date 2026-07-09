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
    class="group/card relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(15,23,42,0.06),0_16px_32px_-16px_rgba(15,23,42,0.18)]"
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
              <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" :class="h.getDeliverableCardTone(deliverable.item).iconChip">
                <component :is="h.getDeliverableStateIcon(deliverable.item)" class="h-3.5 w-3.5" />
              </span>
              <span class="truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em]" :class="h.getDeliverableCardTone(deliverable.item).responsibilityLabel">
                {{ h.getDeliverableUnitLabel(deliverable.item) || 'Unidad' }}
              </span>
              <span
                v-if="deliverable.item.attachment_count"
                class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-slate-500"
                :title="`${deliverable.item.attachment_count} anexo(s)`"
              >
                <IconPaperclip class="h-3 w-3" />{{ deliverable.item.attachment_count }}
              </span>
            </div>
            <p class="m-0 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-slate-800" :title="deliverable.item.template_artifact_name">
              {{ deliverable.item.template_artifact_name || `Entregable #${deliverable.item.id}` }}
              <span v-if="deliverable.item.document_version" class="ml-0.5 whitespace-nowrap align-middle text-[0.72rem] font-bold" :class="h.getDeliverableCardTone(deliverable.item).responsibilityLabel">
                v{{ deliverable.item.document_version }}
              </span>
            </p>
            <p class="m-0 min-w-0 truncate text-[0.78rem] font-medium leading-snug text-slate-400">
              {{ h.getDeliverablePeriodLabel(deliverable.task) }}
            </p>
            <p v-if="deliverable.item.item_mode === 'routed' && deliverable.item.recipient_name" class="m-0 min-w-0 truncate text-[0.78rem] font-semibold leading-snug text-indigo-600">
              Para: {{ deliverable.item.recipient_name }}
            </p>
          </div>
          <AppButton
            variant="plain"
            :class-name="['inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4', h.getDeliverableHeaderActionTone(deliverable.item)].join(' ')"
            aria-label="Abrir detalle del entregable"
            title="Abrir detalle del entregable"
            @click.stop
            @click="emit('open', deliverable)"
          >
            <IconEye class="h-[1.15rem] w-[1.15rem]" />
          </AppButton>
        </div>
      </div>

      <div v-show="!h.isDeliverableCollapsed(deliverable.item)" class="mt-3 flex flex-col gap-3">
        <div v-if="h.getDeliverableProgress(deliverable.item)" class="flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">{{ h.getDeliverableProgress(deliverable.item).label }}</p>
            <AppTag :variant="h.getDeliverableDueState(deliverable.item).variant" class-name="shrink-0">{{ h.getDeliverableDueState(deliverable.item).value }}</AppTag>
          </div>
          <p class="m-0 line-clamp-1 text-[0.9rem] font-semibold leading-snug text-slate-700">{{ h.getDeliverableCurrentResponsibility(deliverable.item).name }}</p>
          <div class="flex items-center gap-2.5">
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full transition-all duration-300" :class="h.getDeliverableCardTone(deliverable.item).accent" :style="{ width: `${h.getDeliverableProgress(deliverable.item).percent}%` }"></div>
            </div>
            <span class="shrink-0 text-[0.7rem] font-semibold text-slate-400">{{ h.getDeliverableProgress(deliverable.item).current }}/{{ h.getDeliverableProgress(deliverable.item).total }}</span>
          </div>
        </div>

        <div class="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 border-t border-slate-100 pt-3">
          <button v-if="h.shouldShowStartDeliverable(deliverable.item)" type="button" class="group relative flex w-full items-center gap-2.5 rounded-[1rem] border border-indigo-200/90 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/60 disabled:cursor-not-allowed disabled:opacity-60" :disabled="processingFillItemId === deliverable.item.id || !h.canStartDeliverableAction(deliverable.item)" @click="emit('start', deliverable.item)">
            <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-indigo-200 bg-indigo-50/70 text-indigo-700"><IconPlayerPlayFilled class="h-4.5 w-4.5" /></div>
            <div class="flex min-w-0 flex-col"><span class="text-sm font-semibold text-slate-800">{{ processingFillItemId === deliverable.item.id ? 'Iniciando...' : 'Iniciar' }}</span></div>
          </button>
          <PdfDropField v-else-if="h.shouldShowUploadDeliverable(deliverable.item)" class="deliverable-inline-upload h-full" :input-id="`deliverable-upload-${deliverable.item.id}`" variant="compact" :icon="IconUpload" :disabled="!deliverable.item.actions?.can_upload_deliverable || isUploadingDeliverable" :title="''" :action-text="h.getUploadActionLabel(deliverable.item)" help-text="" :accept="UPLOAD_ACCEPT" @files-selected="emit('upload', { item: deliverable.item, files: $event })" />
          <button v-else-if="h.shouldShowSign(deliverable.item)" type="button" class="group relative flex w-full items-center gap-2.5 rounded-[1rem] border border-[#4BF1A1]/75 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#4BF1A1] hover:bg-[#4BF1A1]/10 disabled:cursor-not-allowed disabled:opacity-60" :disabled="!deliverable.item.actions?.implemented?.sign" @click="emit('sign', deliverable.item)">
            <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-[#4BF1A1]/55 bg-[#4BF1A1]/10 text-[#118a57]"><IconSignature class="h-4.5 w-4.5" /></div>
            <div class="flex min-w-0 flex-col"><span class="text-sm font-semibold text-slate-800">Firmar</span></div>
          </button>
          <button v-else type="button" class="group relative flex w-full items-center gap-2.5 rounded-[1rem] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/45" @click="emit('open', deliverable)">
            <div class="flex h-9 w-9 items-center justify-center rounded-[0.85rem] border border-sky-100/95 bg-sky-50/55 text-sky-700"><IconChecklist class="h-4.5 w-4.5" /></div>
            <div class="flex min-w-0 flex-col"><span class="text-sm font-semibold text-slate-800">Abrir</span></div>
          </button>

          <div class="flex h-full items-center justify-end gap-1.5">
            <AppButton v-if="!h.shouldShowStartDeliverable(deliverable.item) && h.canApproveFillRequestForPayload(deliverable.item)" variant="plain" class-name="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/90 bg-white text-emerald-700 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-200/70 disabled:cursor-not-allowed disabled:opacity-60" :disabled="fillWorkflowSubmitting" :aria-label="h.getFillApproveActionLabelForPayload(deliverable.item)" @click="emit('approve', deliverable.item)"><IconCircleCheck class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton v-else-if="!h.shouldShowStartDeliverable(deliverable.item) && h.getDeliverableSubject(deliverable.item).preloadFilePath" variant="plain" class-name="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200/90 bg-white text-sky-700 transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-4 focus:ring-sky-200/70" aria-label="Descargar PDF" @click="emit('download', deliverable.item)"><IconDownload class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton v-else-if="!h.shouldShowStartDeliverable(deliverable.item) && h.shouldShowTemplateDownload(deliverable.item)" variant="plain" class-name="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200/90 bg-white text-sky-700 transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-4 focus:ring-sky-200/70" aria-label="Descargar plantilla" @click="emit('template', deliverable.item)"><IconFileDescription class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton v-if="!h.shouldShowStartDeliverable(deliverable.item) && h.getDeliverableSubject(deliverable.item).preloadPdfPath" variant="plain" class-name="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200/90 bg-white text-sky-700 transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-4 focus:ring-sky-200/70" aria-label="Ver PDF" @click="emit('preview', deliverable.item)"><IconEye class="h-[1.15rem] w-[1.15rem]" /></AppButton>
            <AppButton variant="plain" :class-name="['group inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-4', h.getDeliverableHeaderActionTone(deliverable.item)].join(' ')" :disabled="!deliverable.item.actions?.can_open_process_chat" aria-label="Abrir chat" @click="emit('chat', deliverable.item)"><IconMessages class="h-[1.3rem] w-[1.3rem]" /></AppButton>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
