<template>
  <div class="flex h-full w-full flex-col gap-6">
    <div class="grid h-full grid-cols-1 gap-6 xl:grid-cols-[17rem_minmax(0,1fr)_18rem] 2xl:grid-cols-[17.5rem_minmax(0,1fr)_19rem]">
      <aside class="flex h-full min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div class="flex h-full flex-col gap-5 overflow-y-auto p-5 custom-scrollbar">
          <div v-if="allowManualUpload" class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div class="mb-3 flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-slate-800">Añadir PDFs</div>
              </div>
              <button
                v-if="documents.length"
                type="button"
                class="inline-flex items-center justify-center rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                title="Limpiar cola completa"
                @click="clearQueue"
              >
                <IconTrash class="h-4 w-4" />
              </button>
            </div>
            <PdfDropField
              title=""
              action-text="Seleccionar documentos"
              help-text="Arrastra y suelta varios PDF."
              input-id="multisigner-input-rail"
              multiple
              class="multisigner-upload-card"
              @files-selected="onFilesSelected"
            />
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label class="mb-2 block text-sm font-bold text-slate-800">Modo de operación</label>
            <select
              v-model="batchMode"
              class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white"
            >
              <option value="token">Firma por token</option>
              <option value="shared-coordinates">Misma ubicación</option>
              <option value="per-document">Por documento</option>
            </select>
          </div>

          <div
            v-if="batchMode === 'shared-coordinates' || batchMode === 'per-document'"
            class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-slate-800">
                  {{ batchMode === 'shared-coordinates' ? 'Coordenadas compartidas' : 'Cajas por documento' }}
                </div>
              </div>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                title="Limpiar firmas cargadas"
                :disabled="!currentModeFields.length"
                @click="clearCurrentModeFields"
              >
                <IconTrash class="h-4 w-4" stroke-width="2.5" />
              </button>
            </div>

            <div v-if="batchMode === 'shared-coordinates'" class="flex flex-col gap-2">
              <label class="text-xs font-semibold text-slate-500">Referencia de página</label>
              <select
                v-model="sharedPageReference"
                class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white"
              >
                <option value="start">Contar desde el inicio</option>
                <option value="end">Contar desde el final</option>
              </select>
            </div>

            <div v-if="currentModeFields.length" class="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              <IconCheck class="h-4 w-4" />
              {{ currentModeFields.length }} preparada(s)
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="text-sm font-bold text-slate-800">
                Archivos
                <span class="ml-1 text-xs font-semibold text-slate-500">({{ currentDocumentIndex + 1 }} de {{ Math.max(filteredDocuments.length, 1) }})</span>
              </div>
            </div>

            <div v-if="!documents.length" class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-slate-400">
              <IconFiles class="h-8 w-8 opacity-50" />
              <span class="text-sm font-medium">Aún no hay PDFs cargados.</span>
            </div>

            <div v-else-if="!filteredDocuments.length" class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-slate-400">
              <IconInfoCircle class="h-8 w-8 opacity-50" />
              <span class="text-sm font-medium">Ningún PDF coincide con los filtros actuales.</span>
            </div>

            <div v-else class="max-h-72 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
              <div
                v-for="(doc, index) in filteredDocuments"
                :key="doc.id"
                class="group flex w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all"
                :class="index === currentDocumentIndex ? 'border-sky-400 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
              >
                <div class="flex w-full items-start justify-between gap-3">
                  <button
                    type="button"
                    class="min-w-0 flex flex-1 items-center gap-2 text-left"
                    @click="selectDocument(index)"
                  >
                    <IconFileCheck v-if="doc.status === 'completed'" class="h-4 w-4 shrink-0 text-emerald-500" />
                    <IconAlertCircle v-else-if="doc.status === 'failed'" class="h-4 w-4 shrink-0 text-rose-500" />
                    <div class="truncate text-sm font-bold" :class="index === currentDocumentIndex ? 'text-sky-900' : 'text-slate-800'" :title="doc.name">{{ formatDisplayFileName(doc.name) }}</div>
                  </button>
                  <div class="shrink-0" @click.stop>
                    <BtnDelete message="Quitar" @onpress="removeDocument(index)" />
                  </div>
                </div>
                <div v-if="doc.error" class="w-full truncate rounded bg-rose-50 px-2 py-1 text-left text-[11px] font-semibold text-rose-600">{{ doc.error }}</div>
              </div>
            </div>
          </div>

          <AdminButton
            variant="primary"
            :disabled="!canRequestStart"
            @click="requestBatchStart"
            class-name="w-full justify-center rounded-xl py-3 font-bold shadow-md shadow-sky-500/20 transition-all hover:shadow-lg hover:shadow-sky-500/30"
          >
            {{ isBatchSubmitting ? 'Preparando...' : isBatchRunning ? 'Procesando...' : 'Firmar lote masivo' }}
          </AdminButton>
        </div>
      </aside>

      <section class="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div
          v-if="currentDocument"
          class="border-b border-slate-100 bg-slate-50/70 px-5 py-4"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <IconFiles class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Previsualizando PDF</div>
                <div class="truncate text-base font-bold text-slate-800" :title="currentDocument.name">{{ formatDisplayFileName(currentDocument.name) }}</div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <AppCounterNavigator
                label="Documento"
                v-model="documentInput"
                editable
                :min="1"
                :current="currentDocumentIndex + 1"
                :total="filteredDocuments.length"
                :previous-disabled="!canPrevDocument"
                :next-disabled="!canNextDocument"
                previous-title="Documento anterior"
                next-title="Siguiente documento"
                @previous="prevDocument"
                @next="nextDocument"
                @submit="goToDocument"
              />

              <AppCounterNavigator
                label="Página"
                v-model="pageInput"
                editable
                :min="1"
                :current="currentPage"
                :total="totalPages"
                :previous-disabled="!canPrevPage"
                :next-disabled="!canNextPage"
                previous-title="Página anterior"
                next-title="Página siguiente"
                @previous="prevPage"
                @next="nextPage"
                @submit="goToPage"
              />
            </div>
          </div>
        </div>

        <div
          class="relative grow overflow-hidden bg-slate-200"
          :class="(batchMode === 'shared-coordinates' || batchMode === 'per-document') ? 'cursor-crosshair' : 'cursor-default'"
        >
          <div
            id="pdf-scroll-container"
            ref="canvasHost"
            class="flex h-full w-full justify-center overflow-auto p-6 pb-28 custom-scrollbar"
            @click.self="selectedFieldId = null"
          >
            <div
              v-if="currentDocument"
              ref="viewerRef"
              class="relative mb-6 border border-slate-300 bg-white shadow-md transition-all duration-300"
              @mousedown="handlePointerDown"
              @mousemove="handlePointerMove"
              @mouseup="handlePointerUp"
              @mouseleave="handlePointerLeave"
            >
              <canvas ref="pdfCanvas" class="z-0 block h-auto w-full bg-white"></canvas>

              <SignatureBox
                v-if="selectionMode === 'preset' && previewBoxStyle.display !== 'none' && !isDragging && !isHoveringField"
                :is-preview="true"
                :left="parseFloat(previewBoxStyle.left)"
                :top="parseFloat(previewBoxStyle.top)"
                :width="parseFloat(previewBoxStyle.width)"
                :height="parseFloat(previewBoxStyle.height)"
                :label="currentUserLabel"
              />

              <SignatureBox
                v-for="field in currentPageFields"
                :key="field.id"
                :field="field"
                :is-active="field.id === selectedFieldId"
                :pdf-scale="pdfScale"
                :page-height-pdf="pageHeightPdf"
                :page-width-pdf="pageWidthPdf"
                :label="currentUserLabel"
                @select="selectedFieldId = field.id"
                @delete="removeField(field.id)"
                @update:position="updateFieldCoordinates"
                @hover-enter="isHoveringField = true"
                @hover-leave="isHoveringField = false"
              />

              <div
                v-if="activeSelectionBox && (batchMode === 'shared-coordinates' || batchMode === 'per-document')"
                class="pointer-events-none absolute z-20 rounded-sm border-2 border-dashed border-rose-500 bg-rose-500/20 mix-blend-multiply"
                :style="activeSelectionBox"
              >
                <div class="absolute -top-6 left-0 flex items-center gap-1 rounded bg-rose-500 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                  <IconDragDrop class="h-3 w-3" />
                  <span>Calculando Área...</span>
                </div>
              </div>
            </div>

            <div
              v-if="!currentDocument"
              class="relative z-5 mx-auto flex h-full w-full max-w-sm animate-fade-in flex-col items-center justify-center text-center opacity-70"
            >
              <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-300/50 shadow-inner ring-8 ring-white/40">
                <IconFiles class="ml-1 h-10 w-10 text-slate-500" />
              </div>
              <h3 class="mb-2 text-xl font-bold text-slate-700">No hay ningún PDF para visualizar</h3>
              <p class="text-sm font-medium text-slate-500">
                Añade uno o más documentos PDF a la cola desde el panel lateral izquierdo para comenzar a configurar el lote de firmas.
              </p>
            </div>
          </div>

          <div
            v-if="currentDocument"
            class="border-t border-slate-200/80 bg-white/90 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="text-xs font-medium text-slate-500">
                {{ isCoordinateMode ? 'Usa el visor para ubicar la firma en el documento actual.' : 'Revisa el PDF antes de iniciar el lote.' }}
              </div>
              <AppCounterNavigator
                label="Página"
                v-model="pageInput"
                editable
                :min="1"
                :current="currentPage"
                :total="totalPages"
                :previous-disabled="!canPrevPage"
                :next-disabled="!canNextPage"
                previous-title="Página anterior"
                next-title="Página siguiente"
                @previous="prevPage"
                @next="nextPage"
                @submit="goToPage"
              />
            </div>
          </div>
        </div>
      </section>

      <aside class="flex h-full min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div class="flex h-full flex-col gap-5 overflow-y-auto p-5 custom-scrollbar">
          <div
            v-if="showDocumentFilters"
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-slate-800">Filtros de la cola</div>
                <div class="mt-1 text-xs font-medium text-slate-500">Organiza los PDF pendientes por su contexto académico.</div>
              </div>
              <button
                type="button"
                class="text-xs font-semibold text-sky-700 transition hover:text-sky-900"
                @click="resetFilters"
              >
                Limpiar
              </button>
            </div>

            <div class="grid grid-cols-1 gap-3">
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Buscar</span>
                <input
                  v-model="filters.query"
                  type="text"
                  placeholder="Documento, proceso, unidad o periodo"
                  class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white"
                />
              </label>

              <div class="grid grid-cols-1 gap-3">
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Unidad</span>
                  <select v-model="filters.unit" class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white">
                    <option value="all">Todas</option>
                    <option v-for="option in unitOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Proceso</span>
                  <select v-model="filters.process" class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white">
                    <option value="all">Todos</option>
                    <option v-for="option in processOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Año</span>
                  <select v-model="filters.year" class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white">
                    <option value="all">Todos</option>
                    <option v-for="option in yearOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Periodo</span>
                  <select v-model="filters.period" class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors focus:border-sky-500 focus:bg-white">
                    <option value="all">Todos</option>
                    <option v-for="option in periodOptions" :key="option" :value="option">{{ option }}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div class="text-sm font-bold text-slate-800">Resultados</div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-center">
              <div class="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Documentos</div>
              <div class="text-2xl font-black leading-none text-slate-800">{{ documents.length }}</div>
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
                  {{ batchJob
                    ? `${batchJob.processed || 0} de ${batchJob.total || documents.length} procesados`
                    : `${documents.length} documento(s) en cola` }}
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
                  <span class="text-sm font-semibold text-slate-800">
                    {{ batchJob.status === 'completed' ? 'Completado' : batchJob.status === 'processing' ? 'Procesando' : 'En cola' }}
                  </span>
                </div>
                <AdminButton
                  v-if="batchJob.status === 'completed' && successCount > 0"
                  variant="outlinePrimary"
                  size="sm"
                  :disabled="isDownloadingBatch"
                  @click="emit('download-batch')"
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
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { pdfjsLib } from "@/core/utils/pdfjsSetup";
import SignatureBox from "@/modules/firmas/components/SignatureBox.vue";
import {
  IconCheck,
  IconFiles,
  IconTrash,
  IconFileCheck,
  IconAlertCircle,
  IconDragDrop,
} from "@tabler/icons-vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import BtnDelete from "@/shared/components/buttons/BtnDelete.vue";
import PdfDropField from "@/modules/firmas/components/PdfDropField.vue";
import AppCounterNavigator from "@/shared/components/widgets/AppCounterNavigator.vue";
const props = defineProps({
  batchJob: {
    type: Object,
    default: null
  },
  initialFiles: {
    type: Array,
    default: () => []
  },
  isBatchSubmitting: {
    type: Boolean,
    default: false
  },
  isDownloadingBatch: {
    type: Boolean,
    default: false
  },
  initialDocuments: {
    type: Array,
    default: () => []
  },
  allowManualUpload: {
    type: Boolean,
    default: true
  },
  enableDocumentFilters: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(["back", "start-batch", "download-batch"]);

let inputSequence = 0;
const documents = ref([]);
const currentDocumentId = ref("");
const currentPage = ref(1);
const totalPages = ref(0);
const documentInput = ref(1);
const pageInput = ref(1);
const batchMode = ref("token");
const selectionMode = ref("preset");
const sharedPageReference = ref("start");
const pdfCanvas = ref(null);
const canvasHost = ref(null);
const viewerRef = ref(null);
const batchError = ref("");

let pdfDoc = null;
let renderTask = null;
let pdfScale = 1;
let pageHeightPdf = 0;
let pageWidthPdf = 0;
const FIELD_WIDTH = 124;
const FIELD_HEIGHT = 48;
const DISPLAY_FILE_NAME_LIMIT = 20;
const PDF_LOAD_OPTIONS = {
  enableXfa: true,
  stopAtErrors: false
};
const sharedFields = ref([]);
const perDocumentFields = ref({});
const activeSelectionBox = ref(null);
const lastSelection = ref(null);
const selectedFieldId = ref(null);
let isDragging = false;
let startX = 0;
let startY = 0;

const normalizeJobStatus = (status) => {
  if (status === "processing") return "Procesando";
  if (status === "success") return "Firmado";
  if (status === "error") return "Fallido";
  return "Pendiente";
};

const formatDisplayFileName = (value = "") => {
  const normalized = String(value || "");
  if (normalized.length <= DISPLAY_FILE_NAME_LIMIT) return normalized;
  return `${normalized.slice(0, DISPLAY_FILE_NAME_LIMIT)}...`;
};

const successCount = computed(() => documents.value.filter((doc) => doc.status === "Firmado").length);
const failedCount = computed(() => documents.value.filter((doc) => doc.status === "Fallido").length);
const pendingCount = computed(() =>
  documents.value.filter((doc) => ["Pendiente", "Procesando"].includes(doc.status)).length
);
const progressPercent = computed(() => {
  const total = Number(props.batchJob?.total || documents.value.length || 0);
  const processed = Number(props.batchJob?.processed || 0);
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
});
const canPrevDocument = computed(() => currentDocumentIndex.value > 0);
const canNextDocument = computed(() => currentDocumentIndex.value < filteredDocuments.value.length - 1);
const canPrevPage = computed(() => currentPage.value > 1);
const canNextPage = computed(() => currentPage.value < totalPages.value);
const isBatchRunning = computed(() => ["queued", "processing"].includes(props.batchJob?.status || ""));
const isCoordinateMode = computed(() => ["shared-coordinates", "per-document"].includes(batchMode.value));
const currentUserLabel = computed(() => "Firma");
const batchModeHelp = computed(() => {
  if (batchMode.value === "token") {
    return "Busca el marcador del usuario de forma automática en cada PDF.";
  }
  if (batchMode.value === "shared-coordinates") {
    return "Dibuja una vez y reutiliza la misma ubicación en todos los documentos.";
  }
  return "Configura las cajas de firma manualmente para cada documento del lote.";
});

const isMouseOverPdf = ref(false);
const isHoveringField = ref(false);
const previewBoxStyle = ref({ display: 'none' });
const filters = ref({
  query: "",
  unit: "all",
  process: "all",
  year: "all",
  period: "all"
});

const currentModeFields = computed(() => {
  if (batchMode.value === "shared-coordinates") return sharedFields.value;
  if (batchMode.value === "per-document" && currentDocument.value) {
    return perDocumentFields.value[currentDocument.value.id] || [];
  }
  return [];
});
const resolveFieldPage = (field) => {
  if (batchMode.value !== "shared-coordinates") {
    return field.page;
  }
  if (field.pageReference === "end") {
    return Math.max(1, totalPages.value - Number(field.pageOffset || 0));
  }
  return Number(field.pageValue || field.page || 1);
};
const describeFieldPage = (field) => {
  if (field.pageReference === "end") {
    return `${field.pageOffset === 0 ? "última" : `${field.pageOffset + 1} desde fin`}`;
  }
  return String(field.pageValue || field.page || 1);
};
const currentPageFields = computed(() =>
  currentModeFields.value.filter((field) => resolveFieldPage(field) === currentPage.value)
);
const unitOptions = computed(() => getUniqueMetadataValues("unitLabel"));
const processOptions = computed(() => getUniqueMetadataValues("processName"));
const yearOptions = computed(() => getUniqueMetadataValues("termYear").sort((a, b) => Number(b) - Number(a)));
const periodOptions = computed(() => getUniqueMetadataValues("termName"));
const showDocumentFilters = computed(() =>
  props.enableDocumentFilters && documents.value.some((doc) => hasDocumentMetadata(doc))
);
const filteredDocuments = computed(() => {
  if (!showDocumentFilters.value) return documents.value;

  const query = String(filters.value.query || "").trim().toLowerCase();
  return documents.value.filter((doc) => {
    const metadata = doc.metadata || {};
    if (filters.value.unit !== "all" && String(metadata.unitLabel || "") !== String(filters.value.unit)) return false;
    if (filters.value.process !== "all" && String(metadata.processName || "") !== String(filters.value.process)) return false;
    if (filters.value.year !== "all" && String(metadata.termYear || "") !== String(filters.value.year)) return false;
    if (filters.value.period !== "all" && String(metadata.termName || "") !== String(filters.value.period)) return false;
    if (query) {
      const haystack = [
        doc.name,
        metadata.processName,
        metadata.unitLabel,
        metadata.termName,
        metadata.stepName
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
});
const currentDocument = computed(() =>
  filteredDocuments.value.find((doc) => doc.id === currentDocumentId.value)
  || filteredDocuments.value[0]
  || null
);
const currentDocumentIndex = computed(() => {
  const index = filteredDocuments.value.findIndex((doc) => doc.id === currentDocument.value?.id);
  return index < 0 ? 0 : index;
});
const canRequestStart = computed(() =>
  documents.value.length &&
  !props.isBatchSubmitting &&
  !isBatchRunning.value &&
  (
    batchMode.value === "token" ||
    (batchMode.value === "shared-coordinates" && sharedFields.value.length > 0) ||
    (
      batchMode.value === "per-document" &&
      documents.value.length > 0 &&
      documents.value.every((doc) => (perDocumentFields.value[doc.id] || []).length > 0)
    )
  )
);

const normalizeMetadata = (metadata = {}) => ({
  signatureRequestId: metadata.signatureRequestId || null,
  documentId: metadata.documentId || null,
  documentVersionId: metadata.documentVersionId || null,
  processName: metadata.processName || "",
  unitLabel: metadata.unitLabel || "",
  termName: metadata.termName || "",
  termYear: metadata.termYear ? String(metadata.termYear) : "",
  termTypeName: metadata.termTypeName || "",
  stepName: metadata.stepName || "",
  requestedAt: metadata.requestedAt || ""
});

const buildDocumentItem = (file, metadata = {}) => ({
  id: `multi-doc-${inputSequence += 1}`,
  file,
  fingerprint: `${file.name}-${file.size}-${file.lastModified}`,
  name: file.name,
  status: "Pendiente",
  progressLabel: "Sin procesar",
  metadata: normalizeMetadata(metadata)
});

const loadCurrentDocument = async () => {
  const selected = currentDocument.value;
  if (!selected) {
    pdfDoc = null;
    totalPages.value = 0;
    currentPage.value = 1;
    documentInput.value = 1;
    pageInput.value = 1;
    return;
  }

  const fileBuffer = await selected.file.arrayBuffer();
  pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(fileBuffer),
    ...PDF_LOAD_OPTIONS
  }).promise;
  totalPages.value = pdfDoc.numPages;
  currentPage.value = 1;
  documentInput.value = currentDocumentIndex.value + 1;
  pageInput.value = 1;
  await nextTick();
  await renderPage(1);
};

const renderPage = async (pageNum) => {
  if (!pdfDoc || !pdfCanvas.value) return;
  const page = await pdfDoc.getPage(pageNum);
  const baseViewport = page.getViewport({ scale: 1 });
  pageHeightPdf = baseViewport.height;
  pageWidthPdf = baseViewport.width;
  const containerWidth = canvasHost.value?.clientWidth || baseViewport.width;
  pdfScale = containerWidth / baseViewport.width;
  const viewport = page.getViewport({ scale: pdfScale });
  const canvas = pdfCanvas.value;
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  if (renderTask) {
    try {
      renderTask.cancel();
    } catch {
      // noop
    }
  }

  renderTask = page.render({
    canvasContext: context,
    viewport
  });
  await renderTask.promise;
  currentPage.value = pageNum;
  pageInput.value = pageNum;
};

const getViewerRect = () => viewerRef.value?.getBoundingClientRect();

const toPdfUnits = (cssValue) => cssValue / pdfScale;
const toCssUnits = (pdfValue) => pdfValue * pdfScale;

const updateSharedSelection = (left, top, right, bottom, rectHeight) => {
  lastSelection.value = {
    page: currentPage.value,
    x1: toPdfUnits(left),
    y1: pageHeightPdf - toPdfUnits(top),
    x2: toPdfUnits(right),
    y2: pageHeightPdf - toPdfUnits(bottom)
  };
};



const clearCurrentModeFields = () => {
  if (batchMode.value === "shared-coordinates") {
    sharedFields.value = [];
  } else if (batchMode.value === "per-document" && currentDocument.value) {
    perDocumentFields.value = {
      ...perDocumentFields.value,
      [currentDocument.value.id]: []
    };
  }
  selectedFieldId.value = null;
  lastSelection.value = null;
  activeSelectionBox.value = null;
};

const updateFieldCoordinates = (updatedField) => {
  if (batchMode.value === "shared-coordinates") {
    const idx = sharedFields.value.findIndex(f => f.id === updatedField.id);
    if (idx !== -1) sharedFields.value[idx] = updatedField;
  } else if (batchMode.value === "per-document" && currentDocument.value) {
    const docFields = perDocumentFields.value[currentDocument.value.id] || [];
    const idx = docFields.findIndex(f => f.id === updatedField.id);
    if (idx !== -1) {
      docFields[idx] = updatedField;
      perDocumentFields.value = {
        ...perDocumentFields.value,
        [currentDocument.value.id]: [...docFields]
      };
    }
  }
};

const appendField = (selection) => {
  if (!selection) return;
  const field = {
    id: `multi-field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    page: selection.page,
    pageReference: batchMode.value === "shared-coordinates" ? sharedPageReference.value : "start",
    pageValue: batchMode.value === "shared-coordinates" ? selection.page : selection.page,
    pageOffset: batchMode.value === "shared-coordinates" ? Math.max(0, totalPages.value - selection.page) : 0,
    x1: Number(selection.x1.toFixed(2)),
    y1: Number(selection.y1.toFixed(2)),
    x2: Number(selection.x2.toFixed(2)),
    y2: Number(selection.y2.toFixed(2))
  };
  if (batchMode.value === "shared-coordinates") {
    sharedFields.value = [...sharedFields.value, field];
  } else if (batchMode.value === "per-document" && currentDocument.value) {
    perDocumentFields.value = {
      ...perDocumentFields.value,
      [currentDocument.value.id]: [...(perDocumentFields.value[currentDocument.value.id] || []), field]
    };
  }
  selectedFieldId.value = field.id;
};

const handlePointerDown = (event) => {
  if (!isCoordinateMode.value || !viewerRef.value || !pdfDoc) return;
  const rect = getViewerRect();
  if (!rect) return;

  const currentX = event.clientX - rect.left;
  const currentY = event.clientY - rect.top;

  // En modo preset, simplemente usamos el click currentX/Y
  if (selectionMode.value === "preset") {
    const width = toCssUnits(FIELD_WIDTH);
    const height = toCssUnits(FIELD_HEIGHT);
    const left = Math.min(Math.max(currentX - width / 2, 0), rect.width - width);
    const top = Math.min(Math.max(currentY - height / 2, 0), rect.height - height);
    updateSharedSelection(left, top, left + width, top + height, rect.height);
    appendField(lastSelection.value);
    activeSelectionBox.value = null;
    return;
  }

  startX = currentX;
  startY = currentY;
  activeSelectionBox.value = {
    left: `${startX}px`,
    top: `${startY}px`,
    width: "0px",
    height: "0px",
    position: "absolute"
  };
  isDragging = true;
};

const handlePointerMove = (event) => {
  if (!isCoordinateMode.value || !viewerRef.value) return;
  
  const rect = getViewerRect();
  if (!rect) return;
  
  const currentX = event.clientX - rect.left;
  const currentY = event.clientY - rect.top;

  isMouseOverPdf.value = true;
  
  // Lógica de "ghost/preview" cuando no se está arrastrando para dibujar
  if (!isDragging && selectionMode.value === "preset") {
    const presetWidth = toCssUnits(FIELD_WIDTH);
    const presetHeight = toCssUnits(FIELD_HEIGHT);
    
    const maxLeft = Math.max(0, rect.width - presetWidth);
    const maxTop = Math.max(0, rect.height - presetHeight);
    
    // Centrar la caja en el mouse
    const left = Math.min(Math.max(currentX - presetWidth / 2, 0), maxLeft);
    const top = Math.min(Math.max(currentY - presetHeight / 2, 0), maxTop);

    previewBoxStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
      width: `${presetWidth}px`,
      height: `${presetHeight}px`
    };
  }

  // Lógica de dibujado manual
  if (isDragging && selectionMode.value !== "preset") {
    const left = Math.max(Math.min(currentX, startX), 0);
    const top = Math.max(Math.min(currentY, startY), 0);
    const right = Math.min(Math.max(currentX, startX), rect.width);
    const bottom = Math.min(Math.max(currentY, startY), rect.height);

    activeSelectionBox.value = {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(0, right - left)}px`,
      height: `${Math.max(0, bottom - top)}px`,
      position: "absolute"
    };
    updateSharedSelection(left, top, right, bottom, rect.height);
  }
};

const handlePointerLeave = () => {
  isMouseOverPdf.value = false;
  handlePointerUp();
};

const handlePointerUp = () => {
  if (!isDragging || !isCoordinateMode.value) return;
  isDragging = false;
  if (lastSelection.value) {
    appendField(lastSelection.value);
  }
  activeSelectionBox.value = null;
};

const onFilesSelected = async (files) => {
  const pdfFiles = Array.from(files || []).filter(
    (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
  if (!pdfFiles.length) return;

  const existingFingerprints = new Set(documents.value.map((doc) => doc.fingerprint));
  const newDocuments = pdfFiles
    .map((file) => buildDocumentItem(file))
    .filter((doc) => !existingFingerprints.has(doc.fingerprint));

  if (!newDocuments.length) return;
  const shouldAutoload = !documents.value.length;
  documents.value = [...documents.value, ...newDocuments];
  if (shouldAutoload) {
    currentDocumentId.value = newDocuments[0]?.id || "";
    await loadCurrentDocument();
  }
};

const hasDocumentMetadata = (doc) => Boolean(
  doc?.metadata?.processName
  || doc?.metadata?.unitLabel
  || doc?.metadata?.termName
  || doc?.metadata?.termYear
  || doc?.metadata?.stepName
);

const getUniqueMetadataValues = (key) => {
  const values = new Set(
    documents.value
      .map((doc) => String(doc?.metadata?.[key] || "").trim())
      .filter(Boolean)
  );
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

const resetFilters = () => {
  filters.value = {
    query: "",
    unit: "all",
    process: "all",
    year: "all",
    period: "all"
  };
};

const addInitialDocuments = async (seedDocuments = []) => {
  const normalizedDocuments = Array.isArray(seedDocuments) ? seedDocuments : [];
  if (!normalizedDocuments.length) return;

  const existingFingerprints = new Set(documents.value.map((doc) => doc.fingerprint));
  const newDocuments = normalizedDocuments
    .filter((entry) => entry?.file instanceof File)
    .map((entry) => buildDocumentItem(entry.file, entry.metadata))
    .filter((doc) => !existingFingerprints.has(doc.fingerprint));

  if (!newDocuments.length) return;
  const shouldAutoload = !documents.value.length;
  documents.value = [...documents.value, ...newDocuments];
  if (shouldAutoload) {
    currentDocumentId.value = newDocuments[0]?.id || "";
    await loadCurrentDocument();
  }
};

watch(
  () => props.initialFiles,
  async (files) => {
    const normalizedFiles = Array.isArray(files) ? files : [];
    if (!normalizedFiles.length) return;
    await onFilesSelected(normalizedFiles);
  },
  { immediate: true }
);

watch(
  () => props.initialDocuments,
  async (seedDocuments) => {
    if (!Array.isArray(seedDocuments) || !seedDocuments.length) return;
    await addInitialDocuments(seedDocuments);
  },
  { immediate: true }
);

const selectDocument = async (index) => {
  if (index < 0 || index >= filteredDocuments.value.length) return;
  currentDocumentId.value = filteredDocuments.value[index]?.id || "";
  await loadCurrentDocument();
};

const prevDocument = async () => {
  if (!canPrevDocument.value) return;
  await selectDocument(currentDocumentIndex.value - 1);
};

const nextDocument = async () => {
  if (!canNextDocument.value) return;
  await selectDocument(currentDocumentIndex.value + 1);
};

const prevPage = async () => {
  if (!canPrevPage.value) return;
  await renderPage(currentPage.value - 1);
};

const nextPage = async () => {
  if (!canNextPage.value) return;
  await renderPage(currentPage.value + 1);
};

const goToDocument = async () => {
  const parsed = Number.parseInt(documentInput.value, 10);
  if (Number.isNaN(parsed)) {
    documentInput.value = currentDocumentIndex.value + 1;
    return;
  }
  const target = Math.min(Math.max(parsed, 1), filteredDocuments.value.length || 1);
  await selectDocument(target - 1);
};

const goToPage = async () => {
  const parsed = Number.parseInt(pageInput.value, 10);
  if (Number.isNaN(parsed)) {
    pageInput.value = currentPage.value;
    return;
  }
  const target = Math.min(Math.max(parsed, 1), totalPages.value || 1);
  await renderPage(target);
};

const removeDocument = async (index) => {
  const target = filteredDocuments.value[index];
  documents.value = documents.value.filter((doc) => doc.id !== target?.id);
  if (!documents.value.length) {
    pdfDoc = null;
    totalPages.value = 0;
    currentPage.value = 1;
    documentInput.value = 1;
    pageInput.value = 1;
    if (pdfCanvas.value) {
      const context = pdfCanvas.value.getContext("2d");
      context?.clearRect(0, 0, pdfCanvas.value.width, pdfCanvas.value.height);
    }
    currentDocumentId.value = "";
    sharedFields.value = [];
    perDocumentFields.value = {};
    selectedFieldId.value = null;
    return;
  }
  if (!filteredDocuments.value.some((doc) => doc.id === currentDocumentId.value)) {
    currentDocumentId.value = filteredDocuments.value[0]?.id || documents.value[0]?.id || "";
  }
  await loadCurrentDocument();
};

const clearQueue = () => {
  documents.value = [];
  pdfDoc = null;
  totalPages.value = 0;
  currentPage.value = 1;
  documentInput.value = 1;
  pageInput.value = 1;
  currentDocumentId.value = "";
  if (pdfCanvas.value) {
    const context = pdfCanvas.value.getContext("2d");
    context?.clearRect(0, 0, pdfCanvas.value.width, pdfCanvas.value.height);
  }
  sharedFields.value = [];
  perDocumentFields.value = {};
  selectedFieldId.value = null;
};

const removeField = (fieldId) => {
  if (batchMode.value === "shared-coordinates") {
    sharedFields.value = sharedFields.value.filter((field) => field.id !== fieldId);
  } else if (batchMode.value === "per-document" && currentDocument.value) {
    perDocumentFields.value = {
      ...perDocumentFields.value,
      [currentDocument.value.id]: (perDocumentFields.value[currentDocument.value.id] || []).filter((field) => field.id !== fieldId)
    };
  }
  if (selectedFieldId.value === fieldId) {
    selectedFieldId.value = null;
  }
};

const requestBatchStart = async () => {
  if (!canRequestStart.value) return;
  batchError.value = "";
  emit("start-batch", {
    mode: batchMode.value,
    documents: documents.value.map((doc) => ({
      id: doc.id,
      name: doc.name,
      file: doc.file
    })),
    sharedFields: sharedFields.value.map((field) => ({
      page: field.page,
      pageReference: field.pageReference || "start",
      pageValue: field.pageValue || field.page,
      pageOffset: Number(field.pageOffset || 0),
      x1: field.x1,
      y1: field.y1,
      x2: field.x2,
      y2: field.y2
    })),
    documentFields: documents.value.map((doc) => ({
      id: doc.id,
      name: doc.name,
      fields: (perDocumentFields.value[doc.id] || []).map((field) => ({
        page: field.page,
        x1: field.x1,
        y1: field.y1,
        x2: field.x2,
        y2: field.y2
      }))
    }))
  });
};

watch(
  () => props.batchJob,
  (job) => {
    if (!job?.results?.length) return;
    documents.value = documents.value.map((doc, index) => {
      const result = job.results[index];
      if (!result) return doc;
      return {
        ...doc,
        status: normalizeJobStatus(result.status),
        progressLabel:
          result.status === "processing"
            ? "Firmando..."
            : result.status === "success"
              ? "Documento firmado"
              : result.status === "error"
                ? "Proceso fallido"
                : "Sin procesar",
        error: result.error || ""
      };
    });
  },
  { deep: true }
);

watch(batchMode, () => {
  batchError.value = "";
  activeSelectionBox.value = null;
  lastSelection.value = null;
  selectedFieldId.value = null;
  if (batchMode.value !== "shared-coordinates") {
    sharedPageReference.value = "start";
  }
});

watch(currentDocumentIndex, async () => {
  if (filteredDocuments.value.length) {
    await loadCurrentDocument();
  }
});

watch(
  filteredDocuments,
  async (nextDocuments) => {
    if (!nextDocuments.length) {
      currentDocumentId.value = "";
      pdfDoc = null;
      totalPages.value = 0;
      currentPage.value = 1;
      documentInput.value = 1;
      pageInput.value = 1;
      return;
    }
    if (!nextDocuments.some((doc) => doc.id === currentDocumentId.value)) {
      currentDocumentId.value = nextDocuments[0]?.id || "";
      await loadCurrentDocument();
    }
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (renderTask) {
    try {
      renderTask.cancel();
    } catch {
      // noop
    }
  }
});
</script>

<style scoped>
.multisigner-upload-card :deep(.deasy-dropzone) {
  height: auto;
}

.multisigner-upload-card :deep(.deasy-dropzone__surface) {
  flex: none;
  width: 100%;
}

.multisigner-upload-card :deep(.deasy-dropzone__surface--card) {
  min-height: 5.75rem;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
}

.multisigner-upload-card :deep(.deasy-dropzone__trigger) {
  gap: 0.25rem;
}

.multisigner-upload-card :deep(.deasy-dropzone__action) {
  font-size: 0.95rem;
}

.multisigner-upload-card :deep(.deasy-dropzone__help) {
  font-size: 0.75rem;
}

.multisigner-upload-card :deep(.deasy-dropzone__selected) {
  margin-top: 0.75rem;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
  align-items: flex-start;
}

.multisigner-canvas {
  cursor: crosshair;
}



.shared-box {
  position: absolute;
  border: 2px dashed #0ea5e9;
  background: rgba(14, 165, 233, 0.18);
  border-radius: 0.75rem;
  z-index: 20;
  pointer-events: none;
}

.shared-box--active {
  background: rgba(56, 189, 248, 0.22);
  border-color: #0284c7;
}
</style>
