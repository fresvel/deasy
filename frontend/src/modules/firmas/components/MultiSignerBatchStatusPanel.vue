<template>
  <div class="flex h-full flex-col gap-5 overflow-y-auto p-5 custom-scrollbar">
    <div class="deasy-card p-4 shadow-elev-1">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="block text-sm font-bold text-strong">Campos de Firma</div>
        <BtnDelete
          v-if="showFieldControls"
          :disabled="!canClearCurrentModeFields"
          message="Limpiar firmas cargadas"
          @onpress="$emit('clear-fields')"
        />
      </div>
      <div class="flex flex-col gap-3">
        <div class="flex items-center rounded-xl border border-line bg-surface/80 p-1 shadow-elev-1">
          <button
            v-if="showFieldControls"
            type="button"
            class="rounded-2xl p-2 text-muted transition hover:bg-white hover:text-info"
            title="Modo anterior"
            @click="$emit('previous-batch-mode')"
          >
            <IconChevronLeft class="h-5 w-5" />
          </button>
          <div
            class="flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-1 text-center"
            :class="showFieldControls ? 'border-x border-line' : ''"
          >
            <div class="text-[10px] font-bold uppercase tracking-wider text-muted">Modo</div>
            <div class="text-sm font-bold text-strong">{{ currentBatchModeLabel }}</div>
          </div>
          <button
            v-if="showFieldControls"
            type="button"
            class="rounded-2xl p-2 text-muted transition hover:bg-white hover:text-info"
            title="Siguiente modo"
            @click="$emit('next-batch-mode')"
          >
            <IconChevronRight class="h-5 w-5" />
          </button>
        </div>

        <div v-if="showPageReference" class="flex flex-col gap-2">
          <div class="text-xs font-semibold text-muted">Referencia de página</div>
          <div class="flex items-center rounded-xl border border-line bg-surface/80 p-1 shadow-elev-1">
            <button
              v-if="showFieldControls"
              type="button"
              class="rounded-2xl p-2 text-muted transition hover:bg-white hover:text-info"
              title="Referencia anterior"
              @click="$emit('previous-page-reference')"
            >
              <IconChevronLeft class="h-5 w-5" />
            </button>
            <div
              class="flex min-w-0 flex-1 flex-col items-center justify-center px-3 py-1 text-center"
              :class="showFieldControls ? 'border-x border-line' : ''"
            >
              <div class="text-[10px] font-bold uppercase tracking-wider text-muted">Referencia</div>
              <div class="text-sm font-bold text-strong">{{ currentPageReferenceLabel }}</div>
            </div>
            <button
              v-if="showFieldControls"
              type="button"
              class="rounded-2xl p-2 text-muted transition hover:bg-white hover:text-info"
              title="Siguiente referencia"
              @click="$emit('next-page-reference')"
            >
              <IconChevronRight class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          v-if="currentModeFieldsCount"
          class="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-success"
        >
          <IconCheck class="h-4 w-4" />
          {{ currentModeFieldsCount }} preparada(s)
        </div>
      </div>
    </div>

    <div class="text-sm font-bold text-strong">Resultados</div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Documentos</div>
        <div class="text-2xl font-black leading-none text-strong">{{ documentsCount }}</div>
      </div>
      <div class="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Éxitos</div>
        <div class="text-2xl font-black leading-none text-success">{{ successCount }}</div>
      </div>
      <div class="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">Pendientes</div>
        <div class="text-2xl font-black leading-none text-warning">{{ pendingCount }}</div>
      </div>
      <div class="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-center">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-rose-600">Fallos</div>
        <div class="text-2xl font-black leading-none text-rose-700">{{ failedCount }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-blue-light-100 bg-blue-light-50/50 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-bold text-strong">Progreso del lote</div>
          <div class="mt-0.5 text-[11px] font-medium text-muted">
            {{ progressLabel }}
          </div>
        </div>
        <div class="rounded-2xl bg-blue-light-100 px-2.5 py-1 text-sm font-black text-info">
          {{ progressPercent }}%
        </div>
      </div>
      <div class="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-200/70">
        <div class="h-full rounded-full bg-blue-light-500 transition-all duration-500 ease-out" :style="{ width: `${progressPercent}%` }" />
      </div>

      <div v-if="batchJob" class="mt-4 rounded-xl border border-line bg-white p-3.5 shadow-elev-1">
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col">
            <span class="deasy-eyebrow">Estado</span>
            <span class="text-sm font-semibold text-strong">{{ batchStatusLabel }}</span>
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

    <div v-if="batchError" class="mt-auto flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-elev-1">
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
