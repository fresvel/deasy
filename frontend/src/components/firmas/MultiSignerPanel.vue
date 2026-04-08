<template>
  <div class="w-full h-full flex flex-col">
    <div class="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-6 h-full">
      <div class="bg-white rounded-[24px] shadow-sm border border-slate-100 p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
        <!-- Page Header -->
        <div class="flex items-start gap-3">
          <button
            type="button"
            class="flex-shrink-0 inline-flex items-center justify-center p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm group"
            title="Regresar"
            aria-label="Regresar"
            @click="$emit('back')"
          >
            <IconArrowLeft class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div class="flex flex-col pt-0.5">
            <h2 class="text-xl font-black text-slate-800 m-0 leading-tight tracking-tight">Multifirmador</h2>
            <p class="text-slate-500 text-xs mt-1 font-medium leading-snug">
              Carga varios PDF y navega documento por documento antes de enviar la firma masiva.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3.5 flex flex-col justify-center items-center text-center">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Documentos</div>
            <div class="text-2xl font-black text-slate-800 leading-none">{{ documents.length }}</div>
          </div>
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex flex-col justify-center items-center text-center">
            <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1">Éxitos</div>
            <div class="text-2xl font-black text-emerald-700 leading-none">{{ successCount }}</div>
          </div>
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex flex-col justify-center items-center text-center">
            <div class="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Pendientes</div>
            <div class="text-2xl font-black text-amber-700 leading-none">{{ pendingCount }}</div>
          </div>
          <div class="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex flex-col justify-center items-center text-center">
            <div class="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-1">Fallos</div>
            <div class="text-2xl font-black text-rose-700 leading-none">{{ failedCount }}</div>
          </div>
        </div>

        <div class="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <div class="text-sm font-bold text-slate-800">Progreso del lote</div>
              <div class="text-[11px] font-medium text-slate-500 mt-0.5">
                {{ batchJob
                  ? `${batchJob.processed || 0} de ${batchJob.total || documents.length} procesados`
                  : `${documents.length} documento(s) en cola` }}
              </div>
            </div>
            <div class="text-sm font-black text-sky-600 bg-sky-100 px-2.5 py-1 rounded-lg">
              {{ progressPercent }}%
            </div>
          </div>
          <div class="h-2 w-full rounded-full bg-slate-200/70 overflow-hidden">
            <div
              class="h-full rounded-full bg-sky-500 transition-all duration-500 ease-out"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="text-sm font-bold text-slate-800 flex items-center justify-between">
            Modo de operación
          </div>
          <div class="grid grid-cols-1 gap-2.5">
            <label class="group relative flex cursor-pointer rounded-xl border p-3 transition-all hover:bg-slate-50"
                  :class="batchMode === 'token' ? 'border-sky-500 bg-sky-50/30' : 'border-slate-200 bg-white'">
              <div class="flex items-start gap-3 w-full">
                <div class="flex h-5 items-center">
                  <input v-model="batchMode" type="radio" value="token" class="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-600" />
                </div>
                <div class="flex flex-col">
                  <span class="block text-sm font-semibold text-slate-900">Firma por token</span>
                  <span class="block text-xs text-slate-500 mt-0.5">Busca el marcador del usuario de forma automática en cada PDF.</span>
                </div>
              </div>
            </label>

            <label class="group relative flex cursor-pointer rounded-xl border p-3 transition-all hover:bg-slate-50"
                  :class="batchMode === 'shared-coordinates' ? 'border-sky-500 bg-sky-50/30' : 'border-slate-200 bg-white'">
              <div class="flex items-start gap-3 w-full">
                <div class="flex h-5 items-center">
                  <input v-model="batchMode" type="radio" value="shared-coordinates" class="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-600" />
                </div>
                <div class="flex flex-col">
                  <span class="block text-sm font-semibold text-slate-900">Misma ubicación</span>
                  <span class="block text-xs text-slate-500 mt-0.5">Dibuja una vez, firma en las coordenadas de todos.</span>
                </div>
              </div>
            </label>

            <label class="group relative flex cursor-pointer rounded-xl border p-3 transition-all hover:bg-slate-50"
                  :class="batchMode === 'per-document' ? 'border-sky-500 bg-sky-50/30' : 'border-slate-200 bg-white'">
              <div class="flex items-start gap-3 w-full">
                <div class="flex h-5 items-center">
                  <input v-model="batchMode" type="radio" value="per-document" class="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-600" />
                </div>
                <div class="flex flex-col">
                  <span class="block text-sm font-semibold text-slate-900">Por documento</span>
                  <span class="block text-xs text-slate-500 mt-0.5">Prepara las cajas documento por documento manualmente.</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex flex-col gap-4">
          <div
            v-if="batchJob"
            class="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center justify-between gap-3 shadow-sm"
          >
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

          <div
            v-if="batchMode === 'shared-coordinates' || batchMode === 'per-document'"
            class="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-4 shadow-sm"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-[12px] font-bold uppercase tracking-wider text-slate-500">Configuración</div>
                <div class="text-sm font-semibold text-slate-800 mt-1">
                  {{ batchMode === 'shared-coordinates' ? 'Coordenadas comp.' : 'Cajas por documento' }}
                </div>
              </div>
              <button
                type="button"
                class="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                title="Limpiar firmas cargadas"
                :disabled="!currentModeFields.length"
                @click="clearCurrentModeFields"
              >
                <IconTrash class="w-4 h-4" stroke-width="2.5" />
              </button>
            </div>

            <div v-if="batchMode === 'shared-coordinates'" class="flex flex-col gap-2">
              <label class="text-[11px] font-bold tracking-wider uppercase text-slate-400">Referencia de página</label>
              <select
                v-model="sharedPageReference"
                class="block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-sky-500 focus:bg-white transition-colors"
              >
                <option value="start">Contar desde el inicio</option>
                <option value="end">Contar desde el final</option>
              </select>
            </div>

            <div v-if="currentModeFields.length" class="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-100 text-sm font-semibold text-emerald-700">
              <IconCheck class="w-4 h-4" />
              {{ currentModeFields.length }} preparada(s)
            </div>
            
            <div v-else class="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3">
              Haz clic en el visor del PDF para elegir dónde colocar la firma.
            </div>
          </div>

          <div v-if="batchError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mt-1 flex items-start gap-2 shadow-sm">
            <IconAlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
            <span class="font-medium">{{ batchError }}</span>
          </div>

          <AdminButton
            variant="primary"
            :disabled="!canRequestStart"
            @click="requestBatchStart"
            class="w-full flex justify-center py-3 rounded-xl font-bold shadow-md shadow-sky-500/20 transition-all hover:shadow-lg hover:shadow-sky-500/30"
          >
            {{ isBatchSubmitting ? 'Preparando...' : isBatchRunning ? 'Procesando...' : 'Firmar lote masivo' }}
          </AdminButton>
        </div>

        <div class="flex flex-col mt-2">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div class="text-sm font-bold text-slate-800">Archivos <span class="text-xs font-semibold text-slate-500 ml-1">({{ currentDocumentIndex + 1 }} de {{ Math.max(documents.length, 1) }})</span></div>
            <div class="flex items-center gap-1">
              <PdfDropField
                variant="inline"
                title=""
                action-text="Añadir PDF"
                help-text=""
                input-id="multisigner-input-sidebar"
                multiple
                @files-selected="onFilesSelected"
                class="text-xs font-bold"
              />
              <button
                v-if="documents.length"
                type="button"
                class="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                title="Limpiar cola completa"
                @click="clearQueue"
              >
                <IconTrash class="w-4 h-4" />
              </button>
            </div>
          </div>
          <div v-if="!documents.length" class="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center flex flex-col items-center justify-center text-slate-400 gap-3">
            <IconFiles class="w-8 h-8 opacity-50" />
            <span class="text-sm font-medium">Aún no hay PDFs cargados.</span>
          </div>
          <div v-else class="flex flex-col gap-2.5 max-h-[16rem] overflow-y-auto pr-2 custom-scrollbar">
            <button
              v-for="(doc, index) in documents"
              :key="doc.id"
              type="button"
              class="w-full group rounded-xl border p-3 flex flex-col items-start gap-1 transition-all"
              :class="index === currentDocumentIndex ? 'border-sky-400 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'"
              @click="selectDocument(index)"
            >
              <div class="flex items-start justify-between w-full gap-3">
                <div class="min-w-0 flex items-center gap-2">
                  <IconFileCheck v-if="doc.status === 'completed'" class="w-4 h-4 shrink-0 text-emerald-500" />
                  <IconAlertCircle v-else-if="doc.status === 'failed'" class="w-4 h-4 shrink-0 text-rose-500" />
                  <div class="truncate text-sm font-bold" :class="index === currentDocumentIndex ? 'text-sky-900' : 'text-slate-800'">{{ doc.name }}</div>
                </div>
                <!-- Prevent button inside button behavior by switching wrapper or catching click -->
                <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                  <BtnDelete message="Quitar" @onpress.stop="removeDocument(index)" />
                </div>
              </div>
              <div v-if="doc.error" class="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded w-full text-left truncate">{{ doc.error }}</div>
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-[24px] shadow-sm border border-slate-100 flex flex-col h-full overflow-hidden relative">
        <!-- Floating Actions Bar (Bottom) for PC/Mobile like FirmarPdf -->
        <div 
          v-if="documents.length > 0 && (batchMode === 'shared-coordinates' || batchMode === 'per-document')"
          class="absolute bottom-6 left-1/2 -translate-x-1/2 z-[50] flex flex-wrap items-center justify-center gap-2.5 bg-slate-950/75 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-slate-700/50"
        >
          <span class="text-white/90 text-sm font-semibold tracking-wide pr-2 border-r border-slate-600/50 hidden sm:inline">Navegar PDF</span>
          <button @click="prevPage" class="flex items-center justify-center p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition" :disabled="!canPrevPage">
            <IconChevronLeft class="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div class="flex items-center justify-center gap-1.5 bg-slate-800/80 rounded-lg px-2 py-1 sm:px-3 text-white border border-slate-700">
            <input 
              v-model="pageInput" 
              class="w-10 sm:w-12 bg-transparent text-center text-sm font-bold text-white border-0 outline-none p-0 focus:ring-0" 
              type="number" min="1" :max="totalPages" 
              @keyup.enter="goToPage" 
            />
            <span class="text-slate-400 whitespace-nowrap text-sm font-medium">de {{ totalPages }}</span>
          </div>
          <button @click="nextPage" class="flex items-center justify-center p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition" :disabled="!canNextPage">
            <IconChevronRight class="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <!-- Header Controls for Viewer -->
        <div v-if="currentDocument" class="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
               <IconFiles class="w-5 h-5" />
            </div>
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Previsualizando PDF</div>
              <div class="text-base font-bold text-slate-800 line-clamp-1" :title="currentDocument.name">{{ currentDocument.name }}</div>
            </div>
          </div>
          
          <div class="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
            <button @click="prevDocument" class="text-slate-500 hover:text-sky-600 p-2 rounded-lg hover:bg-sky-50 transition" :disabled="!canPrevDocument" title="Documento anterior">
              <IconChevronLeft class="w-5 h-5" />
            </button>
            <div class="px-3 py-1 flex flex-col items-center justify-center border-x border-slate-100 min-w-[70px]">
              <span class="text-xs font-bold text-slate-500">{{ currentDocumentIndex + 1 }} / {{ documents.length }}</span>
            </div>
            <button @click="nextDocument" class="text-slate-500 hover:text-sky-600 p-2 rounded-lg hover:bg-sky-50 transition" :disabled="!canNextDocument" title="Siguiente documento">
              <IconChevronRight class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Workspace Canvas -->
        <div class="flex-grow bg-slate-200 overflow-hidden relative" :class="(batchMode === 'shared-coordinates' || batchMode === 'per-document') ? 'cursor-crosshair' : 'cursor-default'">
          <div class="w-full h-full p-6 overflow-auto custom-scrollbar flex justify-center" ref="canvasHost" @click.self="selectedFieldId = null" id="pdf-scroll-container">
            <div
              v-if="currentDocument"
              ref="viewerRef"
              class="relative mx-auto shadow-md bg-white mb-28 border border-slate-300 transition-all duration-300"
              @mousedown="handlePointerDown"
              @mousemove="handlePointerMove"
              @mouseup="handlePointerUp"
              @mouseleave="handlePointerLeave"
            >
              <canvas ref="pdfCanvas" class="block w-full h-auto z-[0] bg-white"></canvas>

              <!-- Previsualización / Hover -->
              <SignatureBox
                v-if="selectionMode === 'preset' && previewBoxStyle.display !== 'none' && !isDragging"
                :is-preview="true"
                :left="parseFloat(previewBoxStyle.left)"
                :top="parseFloat(previewBoxStyle.top)"
                :width="parseFloat(previewBoxStyle.width)"
                :height="parseFloat(previewBoxStyle.height)"
                :label="currentUserLabel"
              />

              <!-- Dibujar los campos configurados -->
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
              />
              <!-- PREVIEW PREDEFINIDA BOX (Ghost Signature) -->
              <div
                v-if="isMouseOverPdf && !activeSelectionBox"
                class="absolute pointer-events-none border-sky-400 bg-sky-400/20 backdrop-blur-[1px] shadow-[0_0_15px_rgba(56,189,248,0.3)] z-[20]"
                :style="previewBoxStyle"
              >
                <!-- Ghost indicators -->
                <div class="absolute -top-1 -left-1 w-2 h-2 bg-sky-500 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.5)]"></div>
                <div class="absolute -top-1 -right-1 w-2 h-2 bg-sky-500 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.5)]"></div>
                <div class="absolute -bottom-1 -left-1 w-2 h-2 bg-sky-500 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.5)]"></div>
                <div class="absolute -bottom-1 -right-1 w-2 h-2 bg-sky-500 rounded-full shadow-[0_0_5px_rgba(14,165,233,0.5)]"></div>
              </div>
              <!-- Rectángulo de selección en dibujado -->
              <div
                v-if="activeSelectionBox && (batchMode === 'shared-coordinates' || batchMode === 'per-document')"
                class="absolute border-2 border-rose-500 border-dashed bg-rose-500/20 z-[20] rounded-sm pointer-events-none mix-blend-multiply"
                :style="activeSelectionBox"
              >
                  <div class="absolute -top-6 left-0 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                    <IconDragDrop class="w-3 h-3" />
                    <span>Calculando Área...</span>
                  </div>
              </div>
            </div>
            
            <div v-if="!currentDocument" class="flex flex-col items-center justify-center text-center h-full w-full max-w-sm mx-auto opacity-70 relative z-[5] animate-fade-in">
              <div class="w-20 h-20 bg-slate-300/50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-white/40">
                <IconFiles class="w-10 h-10 text-slate-500 ml-1" />
              </div>
              <h3 class="text-xl font-bold text-slate-700 mb-2">No hay ningún PDF para visualizar</h3>
              <p class="text-slate-500 font-medium text-sm">Añade uno o más documentos PDF a la cola desde el panel lateral izquierdo para comenzar a configurar el lote de firmas.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { pdfjsLib } from "@/utils/pdfjsSetup";
import SignatureBox from "@/components/firmas/SignatureBox.vue";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconFiles,
  IconTrash,
  IconFileCheck,
  IconAlertCircle,
  IconDragDrop,
} from "@tabler/icons-vue";
import AdminButton from "@/components/AppButton.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import PdfDropField from "@/components/firmas/PdfDropField.vue";
const props = defineProps({
  batchJob: {
    type: Object,
    default: null
  },
  isBatchSubmitting: {
    type: Boolean,
    default: false
  },
  isDownloadingBatch: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(["back", "start-batch", "download-batch"]);

let inputSequence = 0;
const documents = ref([]);
const currentDocumentIndex = ref(0);
const currentPage = ref(1);
const totalPages = ref(0);
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

const currentDocument = computed(() => documents.value[currentDocumentIndex.value] || null);
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
const canNextDocument = computed(() => currentDocumentIndex.value < documents.value.length - 1);
const canPrevPage = computed(() => currentPage.value > 1);
const canNextPage = computed(() => currentPage.value < totalPages.value);
const isBatchRunning = computed(() => ["queued", "processing"].includes(props.batchJob?.status || ""));
const isCoordinateMode = computed(() => ["shared-coordinates", "per-document"].includes(batchMode.value));
const currentUserLabel = computed(() => "Firma");

const isMouseOverPdf = ref(false);
const isHoveringField = ref(false);
const previewBoxStyle = ref({ display: 'none' });

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

const buildDocumentItem = (file) => ({
  id: `multi-doc-${inputSequence += 1}`,
  file,
  fingerprint: `${file.name}-${file.size}-${file.lastModified}`,
  name: file.name,
  status: "Pendiente",
  progressLabel: "Sin procesar"
});

const loadCurrentDocument = async () => {
  const selected = currentDocument.value;
  if (!selected) {
    pdfDoc = null;
    totalPages.value = 0;
    currentPage.value = 1;
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
    .map(buildDocumentItem)
    .filter((doc) => !existingFingerprints.has(doc.fingerprint));

  if (!newDocuments.length) return;
  const shouldAutoload = !documents.value.length;
  documents.value = [...documents.value, ...newDocuments];
  if (shouldAutoload) {
    currentDocumentIndex.value = 0;
    await loadCurrentDocument();
  }
};

const selectDocument = async (index) => {
  if (index < 0 || index >= documents.value.length) return;
  currentDocumentIndex.value = index;
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
  documents.value = documents.value.filter((_, currentIndex) => currentIndex !== index);
  if (!documents.value.length) {
    pdfDoc = null;
    totalPages.value = 0;
    currentPage.value = 1;
    pageInput.value = 1;
    if (pdfCanvas.value) {
      const context = pdfCanvas.value.getContext("2d");
      context?.clearRect(0, 0, pdfCanvas.value.width, pdfCanvas.value.height);
    }
    currentDocumentIndex.value = 0;
    sharedFields.value = [];
    perDocumentFields.value = {};
    selectedFieldId.value = null;
    return;
  }
  if (currentDocumentIndex.value >= documents.value.length) {
    currentDocumentIndex.value = documents.value.length - 1;
  }
  await loadCurrentDocument();
};

const clearQueue = () => {
  documents.value = [];
  pdfDoc = null;
  totalPages.value = 0;
  currentPage.value = 1;
  pageInput.value = 1;
  currentDocumentIndex.value = 0;
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
  if (documents.value.length) {
    await loadCurrentDocument();
  }
});

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
