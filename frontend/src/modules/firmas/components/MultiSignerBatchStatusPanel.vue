<template>
  <div class="flex h-full flex-col gap-5 overflow-y-auto p-5 custom-scrollbar">
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-3 flex items-center justify-between gap-3">
        <label class="block text-sm font-bold text-slate-800">Campos de Firma</label>
        <BtnDelete
          v-if="showFieldControls"
          :disabled="!canClearCurrentModeFields"
          message="Limpiar firmas cargadas"
          @onpress="$emit('clear-fields')"
        />
      </div>
      <div class="flex flex-col gap-3">
        <div class="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm">
          <button
            v-if="showFieldControls"
            type="button"
            class="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-sky-600"
            title="Modo anterior"
            @click="$emit('previous-batch-mode')"
          >
            <IconChevronLeft class="h-5 w-5" />
          </button>
          <div
            class="flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-1 text-center"
            :class="showFieldControls ? 'border-x border-slate-200' : ''"
          >
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Modo</div>
            <div class="text-sm font-bold text-slate-800">{{ currentBatchModeLabel }}</div>
          </div>
          <button
            v-if="showFieldControls"
            type="button"
            class="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-sky-600"
            title="Siguiente modo"
            @click="$emit('next-batch-mode')"
          >
            <IconChevronRight class="h-5 w-5" />
          </button>
        </div>

        <div v-if="showPageReference" class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-slate-500">Referencia de página</label>
          <div class="flex items-center rounded-xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm">
            <button
              v-if="showFieldControls"
              type="button"
              class="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-sky-600"
              title="Referencia anterior"
              @click="$emit('previous-page-reference')"
            >
              <IconChevronLeft class="h-5 w-5" />
            </button>
            <div
              class="flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-1 text-center"
              :class="showFieldControls ? 'border-x border-slate-200' : ''"
            >
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Referencia</div>
              <div class="text-sm font-bold text-slate-800">{{ currentPageReferenceLabel }}</div>
            </div>
            <button
              v-if="showFieldControls"
              type="button"
              class="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-sky-600"
              title="Siguiente referencia"
              @click="$emit('next-page-reference')"
            >
              <IconChevronRight class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          v-if="currentModeFieldsCount"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
        >
          <IconCheck class="h-4 w-4" />
          {{ currentModeFieldsCount }} preparada(s)
        </div>
      </div>
    </div>

    <div class="text-sm font-bold text-slate-800">Resultados</div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Documentos</div>
        <div class="text-2xl font-black leading-none text-slate-800">{{ documentsCount }}</div>
      </div>
      <div class="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Éxitos</div>
        <div class="text-2xl font-black leading-none text-emerald-700">{{ successCount }}</div>
      </div>
      <div class="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">Pendientes</div>
        <div class="text-2xl font-black leading-none text-amber-700">{{ pendingCount }}</div>
      </div>
      <div class="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">Fallos</div>
        <div class="text-2xl font-black leading-none text-rose-700">{{ failedCount }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-bold text-slate-800">Progreso del lote</div>
          <div class="mt-0.5 text-[11px] font-medium text-slate-500">
            {{ progressLabel }}
          </div>
        </div>
        <div class="rounded-lg bg-sky-100 px-2.5 py-1 text-sm font-black text-sky-600">
          {{ progressPercent }}%
        </div>
      </div>
      <div class="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
        <div class="h-full rounded-full bg-sky-500 transition-all duration-500 ease-out" :style="{ width: `${progressPercent}%` }" />
      </div>

      <div v-if="batchJob" class="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col">
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado</span>
            <span class="text-sm font-semibold text-slate-800">{{ batchStatusLabel }}</span>
          </div>
          <AdminButton
            v-if="showDownloadButton"
            :disabled="isDownloadingBatch"
            size="sm"
            variant="outlinePrimary"
            @click="$emit('download-batch')"
          >
            {{ isDownloadingBatch ? 'Descargando...' : 'Descargar' }}
          </AdminButton>
        </div>
      </div>
    </div>

    <div v-if="batchError" class="mt-auto flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
      <IconAlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
      <span class="font-medium">{{ batchError }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { IconAlertCircle, IconCheck, IconChevronLeft, IconChevronRight } from "@tabler/icons-vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import BtnDelete from "@/shared/components/buttons/BtnDelete.vue";

const props = defineProps({
  batchJob: {
    type: Object,
    default: null
  },
  currentBatchModeLabel: {
    type: String,
    default: ""
  },
  currentModeFieldsCount: {
    type: Number,
    default: 0
  },
  currentPageReferenceLabel: {
    type: String,
    default: ""
  },
  documentsCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  isDownloadingBatch: {
    type: Boolean,
    default: false
  },
  pendingCount: {
    type: Number,
    default: 0
  },
  progressPercent: {
    type: Number,
    default: 0
  },
  showFieldControls: {
    type: Boolean,
    default: true
  },
  showPageReference: {
    type: Boolean,
    default: false
  },
  successCount: {
    type: Number,
    default: 0
  },
  batchError: {
    type: String,
    default: ""
  },
  canClearCurrentModeFields: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  "clear-fields",
  "download-batch",
  "next-batch-mode",
  "next-page-reference",
  "previous-batch-mode",
  "previous-page-reference"
]);

const progressLabel = computed(() =>
  props.batchJob
    ? `${props.batchJob.processed || 0} de ${props.batchJob.total || props.documentsCount} procesados`
    : `${props.documentsCount} documento(s) en cola`
);

const batchStatusLabel = computed(() => {
  if (props.batchJob?.status === "completed") return "Completado";
  if (props.batchJob?.status === "processing") return "Procesando";
  return "En cola";
});

const showDownloadButton = computed(() =>
  props.batchJob?.status === "completed" && props.successCount > 0
);
</script>
