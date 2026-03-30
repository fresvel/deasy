<template>
  <div class="w-full h-full flex flex-col gap-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-start gap-3">
        <button
          type="button"
          class="inline-flex items-center justify-center p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
          title="Regresar"
          aria-label="Regresar"
          @click="$emit('back')"
        >
          <IconArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h2 class="text-2xl font-bold text-slate-800 m-0 leading-tight">Multifirmador</h2>
          <p class="text-slate-500 text-sm m-0 font-medium leading-snug">
            Carga varios PDF y navega documento por documento antes de enviar la firma masiva.
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <PdfDropField
          variant="inline"
          title=""
          action-text="Agregar PDFs"
          help-text="Selecciona uno o varios archivos"
          :icon="IconFiles"
          input-id="multisigner-input"
          multiple
          @files-selected="onFilesSelected"
        />
        <button
          type="button"
          class="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition font-semibold text-sm"
          :disabled="!documents.length"
          @click="clearQueue"
        >
          Limpiar cola
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-5">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Documentos</div>
            <div class="text-2xl font-bold text-slate-800 mt-1">{{ documents.length }}</div>
          </div>
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div class="text-xs font-semibold uppercase tracking-wide text-emerald-500">Éxitos</div>
            <div class="text-2xl font-bold text-emerald-700 mt-1">{{ successCount }}</div>
          </div>
          <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div class="text-xs font-semibold uppercase tracking-wide text-amber-500">Pendientes</div>
            <div class="text-2xl font-bold text-amber-700 mt-1">{{ pendingCount }}</div>
          </div>
          <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div class="text-xs font-semibold uppercase tracking-wide text-rose-500">Fallos</div>
            <div class="text-2xl font-bold text-rose-700 mt-1">{{ failedCount }}</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-bold text-slate-800">Resumen del lote</div>
              <div class="text-xs text-slate-500">
                {{ batchJob
                  ? `${batchJob.processed || 0} de ${batchJob.total || documents.length} documento(s) procesados`
                  : `${documents.length} documento(s) listos para preparar` }}
              </div>
            </div>
            <div class="text-sm font-semibold text-slate-700">
              {{ progressPercent }}%
            </div>
          </div>
          <div class="mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              class="h-full rounded-full bg-sky-600 transition-all duration-300"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-sm font-bold text-slate-800">Modo de operación</div>
          <div class="mt-3 flex flex-col gap-2">
            <label class="inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <input v-model="batchMode" type="radio" value="token" class="mt-1" />
              <span>
                <span class="font-semibold text-slate-900">Firma por token</span>
                <span class="block text-xs text-slate-500">Buscará el marcador del usuario en cada PDF.</span>
              </span>
            </label>
            <label class="inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <input v-model="batchMode" type="radio" value="shared-coordinates" class="mt-1" />
              <span>
                <span class="font-semibold text-slate-900">Coordenadas compartidas</span>
                <span class="block text-xs text-slate-500">Una misma ubicación para todos los PDF.</span>
              </span>
            </label>
            <label class="inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <input v-model="batchMode" type="radio" value="per-document" class="mt-1" />
              <span>
                <span class="font-semibold text-slate-900">Coordenadas por documento</span>
                <span class="block text-xs text-slate-500">Se preparará documento por documento.</span>
              </span>
            </label>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-4">
          <div>
            <div class="text-sm font-bold text-slate-800">Inicio de firma</div>
            <div class="text-xs text-slate-500 mt-1">
              El lote usará el mismo modal de certificados y contraseña del firmador normal.
            </div>
          </div>

          <div
            v-if="batchJob"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="font-semibold text-slate-800">Estado del lote</div>
                <div class="mt-1">
                  {{ batchJob.status === 'completed' ? 'Completado' : batchJob.status === 'processing' ? 'Procesando' : 'En cola' }}
                  · {{ batchJob.processed || 0 }} / {{ batchJob.total || documents.length }} documento(s)
                </div>
              </div>
              <AdminButton
                v-if="batchJob.status === 'completed' && successCount > 0"
                variant="outlinePrimary"
                size="sm"
                :disabled="isDownloadingBatch"
                @click="emit('download-batch')"
              >
                {{ isDownloadingBatch ? 'Descargando lote...' : 'Descargar lote' }}
              </AdminButton>
            </div>
          </div>

          <div
            v-if="batchMode === 'shared-coordinates' || batchMode === 'per-document'"
            class="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-slate-800">
                  {{ batchMode === 'shared-coordinates' ? 'Coordenadas compartidas' : 'Coordenadas por documento' }}
                </div>
                <div class="text-xs text-slate-500">
                  {{ batchMode === 'shared-coordinates'
                    ? 'Define uno o varios campos que se aplicarán al mismo número de página en todos los documentos.'
                    : 'Define uno o varios campos para el documento actual y navega documento por documento.' }}
                </div>
              </div>
              <button
                type="button"
                class="inline-flex items-center justify-center px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition text-sm font-medium"
                :disabled="!currentModeFields.length"
                @click="clearCurrentModeFields"
              >
                Limpiar
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <label class="text-sm font-semibold text-slate-600">Modo</label>
              <select
                v-model="selectionMode"
                class="block min-w-[12rem] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none"
              >
                <option value="drag">Manual</option>
                <option value="preset">Predefinida</option>
              </select>
            </div>

            <div v-if="batchMode === 'shared-coordinates'" class="flex flex-wrap items-center gap-3">
              <label class="text-sm font-semibold text-slate-600">Página de referencia</label>
              <select
                v-model="sharedPageReference"
                class="block min-w-[14rem] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none"
              >
                <option value="start">Contar desde inicio</option>
                <option value="end">Contar desde fin</option>
              </select>
            </div>

            <div class="text-xs text-slate-500">
              {{ selectionMode === 'preset'
                ? 'Haz clic en el visor para colocar un campo de firma.'
                : 'Haz clic y arrastra en el visor para definir el campo de firma.' }}
            </div>

            <div v-if="currentModeFields.length" class="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
              {{ currentModeFields.length }} campo(s) preparado(s) para
              {{ batchMode === 'shared-coordinates' ? 'todos los documentos' : 'este documento' }}.
            </div>
          </div>

          <div v-if="batchError" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ batchError }}
          </div>

          <AdminButton
            variant="primary"
            :disabled="!canRequestStart"
            @click="requestBatchStart"
          >
            {{ isBatchSubmitting ? 'Preparando lote...' : isBatchRunning ? 'Procesando lote...' : 'Iniciar firma masiva' }}
          </AdminButton>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <div class="text-sm font-bold text-slate-800">Cola de documentos</div>
            <div class="text-xs text-slate-500">{{ currentDocumentIndex + 1 }} / {{ Math.max(documents.length, 1) }}</div>
          </div>
          <div v-if="!documents.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Aún no has cargado documentos.
          </div>
          <div v-else class="flex flex-col gap-2 max-h-[28rem] overflow-y-auto pr-1 custom-scrollbar">
            <button
              v-for="(doc, index) in documents"
              :key="doc.id"
              type="button"
              class="w-full rounded-xl border px-3 py-3 text-left transition"
              :class="index === currentDocumentIndex ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
              @click="selectDocument(index)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-800">{{ doc.name }}</div>
                  <div class="mt-1 text-xs text-slate-500">Estado: {{ doc.status }}</div>
                  <div v-if="doc.error" class="mt-1 text-xs text-red-600">{{ doc.error }}</div>
                </div>
                <BtnDelete message="Quitar" @onpress="removeDocument(index)" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-5">
        <div v-if="currentDocument" class="flex flex-col gap-4">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Documento actual</div>
              <div class="text-lg font-bold text-slate-800 mt-1">{{ currentDocument.name }}</div>
              <div class="text-sm text-slate-500 mt-1">
                {{ currentDocument.status }} · {{ currentDocument.progressLabel }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <button @click="prevDocument" class="text-sky-600 hover:text-sky-800 p-2 transition" :disabled="!canPrevDocument">
                <IconArrowLeft class="w-5 h-5" />
              </button>
              <div class="rounded-xl bg-sky-50 px-4 py-2 text-sm font-semibold text-slate-700">
                PDF {{ currentDocumentIndex + 1 }} de {{ documents.length }}
              </div>
              <button @click="nextDocument" class="text-sky-600 hover:text-sky-800 p-2 transition" :disabled="!canNextDocument">
                <IconArrowRight class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <button @click="prevPage" class="text-sky-600 hover:text-sky-800 p-2 transition" :disabled="!canPrevPage">
              <IconChevronLeft class="w-6 h-6" />
            </button>
            <div class="page-selector flex items-center gap-2 bg-sky-50 text-slate-800 rounded-xl px-4 py-2 font-semibold">
              <span class="text-sm text-slate-600">Página</span>
              <input
                v-model="pageInput"
                class="page-selector-input w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm outline-none"
                type="number"
                min="1"
                :max="totalPages"
                @keyup.enter="goToPage"
              />
              <span class="text-sm">de {{ totalPages }}</span>
            </div>
            <button @click="nextPage" class="text-sky-600 hover:text-sky-800 p-2 transition" :disabled="!canNextPage">
              <IconChevronRight class="w-6 h-6" />
            </button>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div class="w-full relative flex justify-center" ref="canvasHost">
              <div
                ref="viewerRef"
                class="relative shadow-sm border border-slate-200"
                @mousedown="handlePointerDown"
                @mousemove="handlePointerMove"
                @mouseup="handlePointerUp"
                @mouseleave="handlePointerUp"
              >
                <canvas ref="pdfCanvas" class="block relative z-10 w-full multisigner-canvas"></canvas>
                <div
                  v-for="field in currentPageFields"
                  :key="field.id"
                  class="box saved-box"
                  :class="{ 'saved-box--active': field.id === selectedFieldId }"
                  :style="getFieldBoxStyle(field)"
                  @mousedown.stop
                  @click.stop="selectedFieldId = field.id"
                >
                  <div class="saved-box-signer">
                    {{ currentUserLabel }}
                  </div>
                  <div class="saved-box-actions" @mousedown.stop @click.stop>
                    <BtnDelete message="Eliminar" @onpress="removeField(field.id)" />
                  </div>
                </div>
                <div
                  v-if="activeSelectionBox && isCoordinateMode"
                  class="box shared-box--active"
                  :style="activeSelectionBox"
                />
              </div>
            </div>
          </div>

          <div v-if="currentModeFields.length && isCoordinateMode" class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="text-sm font-bold text-slate-800 mb-3">
              {{ batchMode === 'shared-coordinates' ? 'Campos compartidos' : 'Campos del documento actual' }}
            </div>
            <div class="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
              <div
                v-for="field in currentModeFields"
                :key="field.id"
                class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                :class="field.id === selectedFieldId ? 'border-sky-500 bg-sky-50' : ''"
              >
                <div class="text-xs text-slate-600">
                  Página {{ describeFieldPage(field) }} · x1={{ field.x1.toFixed(2) }}, y1={{ field.y1.toFixed(2) }},
                  x2={{ field.x2.toFixed(2) }}, y2={{ field.y2.toFixed(2) }}
                </div>
                <BtnDelete message="Eliminar" @onpress="removeField(field.id)" />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-slate-500">
          Carga varios PDF para comenzar a preparar la firma masiva.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconFiles
} from "@tabler/icons-vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import PdfDropField from "@/components/PdfDropField.vue";
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
const installPdfJsCollectionPolyfills = () => {
  if (typeof Map !== "undefined" && !Map.prototype.getOrInsertComputed) {
    Object.defineProperty(Map.prototype, "getOrInsertComputed", {
      value(key, compute) {
        if (this.has(key)) return this.get(key);
        const value = compute(key);
        this.set(key, value);
        return value;
      },
      configurable: true,
      writable: true
    });
  }

  if (typeof WeakMap !== "undefined" && !WeakMap.prototype.getOrInsertComputed) {
    Object.defineProperty(WeakMap.prototype, "getOrInsertComputed", {
      value(key, compute) {
        if (this.has(key)) return this.get(key);
        const value = compute(key);
        this.set(key, value);
        return value;
      },
      configurable: true,
      writable: true
    });
  }
};

installPdfJsCollectionPolyfills();
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

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
const FIELD_WIDTH = 124;
const FIELD_HEIGHT = 48;
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
  pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(fileBuffer) }).promise;
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

const getFieldBoxStyle = (field) => {
  const rect = getViewerRect();
  if (!rect) return {};
  const left = toCssUnits(field.x1);
  const right = toCssUnits(field.x2);
  const top = toCssUnits(pageHeightPdf - field.y1);
  const bottom = toCssUnits(pageHeightPdf - field.y2);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, right - left)}px`,
    height: `${Math.max(0, bottom - top)}px`,
    position: "absolute"
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

  if (selectionMode.value === "preset") {
    const width = toCssUnits(FIELD_WIDTH);
    const height = toCssUnits(FIELD_HEIGHT);
    const left = Math.min(Math.max(currentX, 0), Math.max(0, rect.width - width));
    const top = Math.min(Math.max(currentY, 0), Math.max(0, rect.height - height));
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
  if (!isDragging || !isCoordinateMode.value || !viewerRef.value) return;
  const rect = getViewerRect();
  if (!rect) return;
  const currentX = event.clientX - rect.left;
  const currentY = event.clientY - rect.top;
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

.box {
  border: 2px dashed var(--brand-accent, #0ea5e9);
  position: absolute;
  background-color: rgba(14, 165, 233, 0.25);
  border-radius: 5%;
  z-index: 20;
}

.saved-box {
  cursor: pointer;
}

.saved-box-actions {
  position: absolute;
  top: 0;
  right: 0;
  transform: translate(105%, -8%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  pointer-events: auto;
}

.saved-box-signer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem 0.45rem;
  text-align: center;
  font-size: 0.95rem;
  line-height: 1.1;
  font-weight: 700;
  color: #0f172a;
}

.saved-box--active {
  border-color: #0284c7;
  background: rgba(14, 165, 233, 0.32);
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
