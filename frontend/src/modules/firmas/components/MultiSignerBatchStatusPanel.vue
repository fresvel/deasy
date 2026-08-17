<template>
  <div class="flex h-full flex-col gap-5 overflow-y-auto p-5 custom-scrollbar">
    <div class="deasy-card p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div class="block text-sm font-bold text-strong">Campos de Firma</div>
        <AppDeleteButton v-if="showFieldControls" :disabled="!canClearCurrentModeFields" label="Limpiar firmas cargadas" @click="$emit('clear-fields')" />
      </div>
      <div class="flex flex-col gap-3">
        <AppCounterNavigator
          label="Modo"
          :value-label="currentBatchModeLabel"
          :controls="showFieldControls"
          previous-title="Modo anterior"
          next-title="Siguiente modo"
          @previous="$emit('previous-batch-mode')"
          @next="$emit('next-batch-mode')"
        />

        <div v-if="showPageReference" class="flex flex-col gap-2">
          <div class="text-xs font-semibold text-muted">Referencia de página</div>
          <AppCounterNavigator
            label="Referencia"
            :value-label="currentPageReferenceLabel"
            :controls="showFieldControls"
            previous-title="Referencia anterior"
            next-title="Siguiente referencia"
            @previous="$emit('previous-page-reference')"
            @next="$emit('next-page-reference')"
          />
        </div>

        <AppTag v-if="currentModeFieldsCount" variant="success">
          <IconCheck class="h-4 w-4" />
          {{ currentModeFieldsCount }} preparada(s)
        </AppTag>
      </div>
    </div>

    <div class="text-sm font-bold text-strong">Resultados</div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col items-center justify-center rounded-xl border border-line bg-surface p-3.5 text-center">
        <div class="mb-1 text-theme-xs font-bold uppercase tracking-wider text-muted">Documentos</div>
        <div class="text-2xl font-black leading-none text-strong">{{ documentsCount }}</div>
      </div>
      <div class="deasy-alert deasy-alert--success flex flex-col items-center justify-center text-center">
        <div class="mb-1 text-theme-xs font-bold uppercase tracking-wider text-success">Éxitos</div>
        <div class="text-2xl font-black leading-none text-success">{{ successCount }}</div>
      </div>
      <div class="deasy-alert deasy-alert--warning flex flex-col items-center justify-center text-center">
        <div class="mb-1 text-theme-xs font-bold uppercase tracking-wider text-warning">Pendientes</div>
        <div class="text-2xl font-black leading-none text-warning">{{ pendingCount }}</div>
      </div>
      <div class="deasy-alert deasy-alert--danger flex flex-col items-center justify-center text-center">
        <div class="mb-1 text-theme-xs font-bold uppercase tracking-wider text-danger">Fallos</div>
        <div class="text-2xl font-black leading-none text-danger">{{ failedCount }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-blue-light-100 bg-blue-light-50/50 p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-bold text-strong">Progreso del lote</div>
          <div class="mt-0.5 text-theme-xs font-medium text-muted">
            {{ progressLabel }}
          </div>
        </div>
        <div class="rounded-2xl bg-blue-light-100 px-2.5 py-1 text-sm font-black text-info">
          {{ progressPercent }}%
        </div>
      </div>
      <div class="deasy-progress deasy-progress--lg mb-4">
        <div class="deasy-progress__bar bg-blue-light-500" :style="{ width: `${progressPercent}%` }" />
      </div>

      <div v-if="batchJob" class="mt-4 rounded-xl border border-line bg-white p-3.5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex flex-col">
            <span class="deasy-overline">Estado</span>
            <span class="text-sm font-semibold text-strong">{{ batchStatusLabel }}</span>
          </div>
          <AdminButton
            v-if="showDownloadButton"
            :disabled="isDownloadingBatch"
            size="sm"
            variant="primary-outline"
            @click="$emit('download-batch')"
          >
            {{ isDownloadingBatch ? 'Descargando...' : 'Descargar' }}
          </AdminButton>
        </div>
      </div>
    </div>

    <div v-if="batchError" class="deasy-alert deasy-alert--danger mt-auto flex items-start gap-2">
      <IconAlertCircle class="mt-0.5 h-5 w-5 shrink-0" />
      <span class="font-medium">{{ batchError }}</span>
    </div>
  </div>
</template>

<script setup>
import AppCounterNavigator from "@/shared/components/widgets/AppCounterNavigator.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { computed } from "vue";
import { IconAlertCircle, IconCheck} from "@tabler/icons-vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDeleteButton from "@/shared/components/buttons/AppDeleteButton.vue";

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
