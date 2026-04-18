<template>
  <div class="w-full animate-fade-in">

    <!-- ===== BARRA SUPERIOR ===== -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200">

      <!-- Izquierda: volver + título -->
      <div class="flex items-center gap-3 min-w-0">
        <button
          type="button"
          @click="$emit('back')"
          class="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:-translate-x-0.5 transition-all font-semibold text-sm shadow-sm shrink-0"
          title="Volver a la lista"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          <span class="hidden sm:inline">Volver</span>
        </button>
        <div class="min-w-0">
          <h2 class="text-base sm:text-lg font-bold text-slate-800 leading-tight m-0">Vista de documento</h2>
          <p class="text-xs sm:text-sm text-slate-500 m-0 leading-snug truncate max-w-xs">{{ itemName }}</p>
        </div>
      </div>

      <!-- Derecha: acciones -->
      <div class="flex items-center gap-2 shrink-0 ml-auto flex-wrap">

        <!-- Descargar (solo con doc) -->
        <button
          v-if="hasDoc"
          type="button"
          @click="downloadPdf"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition font-medium text-sm shadow-sm"
          title="Descargar PDF"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span class="hidden md:inline">Descargar</span>
        </button>

        <!-- Subir / Actualizar PDF -->
        <button
          type="button"
          @click="triggerUpload"
          :disabled="isUploading"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition font-semibold text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          :title="hasDoc ? 'Actualizar PDF' : 'Subir PDF'"
        >
          <svg v-if="isUploading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <span class="hidden md:inline">{{ isUploading ? 'Subiendo…' : (hasDoc ? 'Actualizar' : 'Subir PDF') }}</span>
        </button>

        <!-- Eliminar PDF (solo con doc) -->
        <button
          v-if="hasDoc"
          type="button"
          @click="confirmingDelete = true"
          :disabled="isDeleting"
          class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition font-semibold text-sm shadow-sm disabled:opacity-60"
          title="Eliminar PDF"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24" />
          </svg>
          <span class="hidden md:inline">Eliminar</span>
        </button>

      </div>
    </div>

    <!-- ===== CONFIRMACIÓN ELIMINAR (inline) ===== -->
    <Transition name="slide-down">
      <div
        v-if="confirmingDelete"
        class="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" class="text-red-500 shrink-0">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <p class="text-sm font-medium text-red-700 m-0">¿Eliminar el documento PDF? El registro se mantendrá.</p>
        </div>
        <div class="flex items-center gap-2 ml-auto shrink-0">
          <button type="button" @click="confirmingDelete = false"
            class="text-sm font-medium text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 bg-white transition">
            Cancelar
          </button>
          <button type="button" @click="performDelete" :disabled="isDeleting"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-60">
            {{ isDeleting ? 'Eliminando…' : 'Sí, eliminar' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== ERROR DE ACCIÓN ===== -->
    <Transition name="slide-down">
      <div v-if="actionError"
        class="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        {{ actionError }}
      </div>
    </Transition>

    <!-- ===== CARGANDO ===== -->
    <div v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div class="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mb-4">
        <svg class="w-7 h-7 text-sky-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-slate-500">Cargando documento…</p>
    </div>

    <!-- ===== SIN DOCUMENTO ===== -->
    <div v-else-if="!hasDoc"
      class="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-sm">
      <div class="w-16 h-16 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <h3 class="text-base font-bold text-slate-700 mb-1">Sin documento adjunto</h3>
      <p class="text-sm text-slate-500 text-center max-w-xs mb-5">
        Este registro aún no tiene un PDF asociado. Usa el botón de arriba para subir uno.
      </p>
      <button type="button" @click="triggerUpload"
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-sm hover:bg-sky-700 transition shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        Subir PDF
      </button>
    </div>

    <!-- ===== ERROR DE CARGA ===== -->
    <div v-else-if="loadError"
      class="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-red-100 shadow-sm">
      <div class="w-14 h-14 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h3 class="text-base font-bold text-slate-700 mb-1">No se pudo cargar</h3>
      <p class="text-sm text-slate-500 text-center max-w-xs mb-5">{{ loadError }}</p>
      <button type="button" @click="loadPdf"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition">
        Reintentar
      </button>
    </div>

    <!-- ===== PDF VIEWER ===== -->
    <!--
      Sin scroll interno. El canvas se expande libremente y el body (scroll del layout)
      maneja el desplazamiento. Los controles de paginación solo aparecen con ≥ 2 páginas.
    -->
    <template v-else>

      <!-- Controles de página — solo si hay más de 1 página -->
      <div v-if="totalPages >= 2" class="flex items-center justify-center gap-2 mb-4">
        <button
          type="button"
          @click="prevPage"
          :disabled="currentPage <= 1"
          class="p-2 rounded-xl border border-slate-200 bg-white text-sky-600 hover:bg-sky-50 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          title="Página anterior"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div class="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2 select-none">
          <span class="text-sm text-slate-500 font-medium">Pág.</span>
          <input
            v-model.number="pageInput"
            type="number"
            min="1"
            :max="totalPages"
            class="w-12 text-center text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-1 py-0.5 outline-none focus:border-sky-400"
            style="appearance:textfield; -moz-appearance:textfield;"
            @keyup.enter="goToPage"
            @blur="goToPage"
          />
          <span class="text-sm font-semibold text-slate-600">de {{ totalPages }}</span>
        </div>

        <button
          type="button"
          @click="nextPage"
          :disabled="currentPage >= totalPages"
          class="p-2 rounded-xl border border-slate-200 bg-white text-sky-600 hover:bg-sky-50 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          title="Página siguiente"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      <!--
        Contenedor del canvas:
        - Sin overflow ni max-height → no genera scroll propio
        - El canvas crece al tamaño de la página y el body scroll se encarga de todo
        - rounded + shadow son solo decorativos
      -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div class="p-3 sm:p-5 flex justify-center" ref="colPdf">
          <canvas ref="pdfCanvas" class="block w-full shadow-md rounded-lg"></canvas>
        </div>
      </div>

    </template>

    <!-- Input de archivo oculto -->
    <input type="file" ref="fileInput" accept="application/pdf" style="display:none" @change="handleFileChange" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { pdfjsLib } from '@/core/utils/pdfjsSetup';
import DossierService from '@/modules/dossier/services/DossierService';

const props = defineProps({
  tipo:        { type: String,  required: true },
  recordId:    { type: String,  required: true },
  itemName:    { type: String,  default: 'Documento' },
  hasDocument: { type: Boolean, default: false }
});

const emit = defineEmits(['back', 'document-updated', 'document-deleted']);

// ── DOM refs ───────────────────────────────────────────
const colPdf    = ref(null);
const pdfCanvas = ref(null);
const fileInput = ref(null);

// ── PDF state ──────────────────────────────────────────
let pdfDoc     = null;
let renderTask = null;
let pdfBlob    = null;
let resizeObserver = null;
let resizeTimer    = null;

const hasDoc      = ref(props.hasDocument);
const isLoading   = ref(false);
const loadError   = ref('');
const currentPage = ref(1);
const pageInput   = ref(1);
const totalPages  = ref(0);

// ── Action state ───────────────────────────────────────
const isUploading      = ref(false);
const isDeleting       = ref(false);
const confirmingDelete = ref(false);
const actionError      = ref('');

// ── PDF loading ────────────────────────────────────────
const loadPdf = async () => {
  if (!hasDoc.value) return;
  isLoading.value = true;
  loadError.value = '';
  pdfDoc = null;
  try {
    const response = await DossierService.downloadDocument(props.tipo, props.recordId);
    pdfBlob = new Blob([response.data], { type: 'application/pdf' });
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const task = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    pdfDoc = await task.promise;
    totalPages.value  = pdfDoc.numPages;
    currentPage.value = 1;
    pageInput.value   = 1;
    await nextTick();
    await renderPage(1);
  } catch (err) {
    loadError.value = 'No se pudo cargar el PDF. Verifica que el documento esté disponible.';
    console.error('DossierPdfViewer – error al cargar:', err);
  } finally {
    isLoading.value = false;
  }
};

const renderPage = async (pageNum) => {
  if (!pdfDoc || !pdfCanvas.value || !colPdf.value) return;
  try {
    const page = await pdfDoc.getPage(pageNum);

    // Medir el ancho disponible del contenedor (menos padding interno ~40px)
    const containerWidth = Math.max((colPdf.value.clientWidth || 640) - 40, 200);
    const baseVp = page.getViewport({ scale: 1 });
    const scale  = containerWidth / baseVp.width;
    const vp     = page.getViewport({ scale });

    const canvas = pdfCanvas.value;
    const ctx    = canvas.getContext('2d');
    canvas.width  = vp.width;
    canvas.height = vp.height;

    if (renderTask) {
      try { renderTask.cancel(); } catch {}
    }
    renderTask = page.render({ canvasContext: ctx, viewport: vp });
    await renderTask.promise;

    currentPage.value = pageNum;
    pageInput.value   = pageNum;
  } catch (err) {
    if (err?.name === 'RenderingCancelledException') return;
    console.error('DossierPdfViewer – error al renderizar página:', err);
  }
};

// ── Navegación de páginas ──────────────────────────────
const prevPage = () => {
  if (currentPage.value > 1) renderPage(currentPage.value - 1);
};
const nextPage = () => {
  if (currentPage.value < totalPages.value) renderPage(currentPage.value + 1);
};
const goToPage = () => {
  const n = Math.min(Math.max(parseInt(pageInput.value, 10) || 1, 1), totalPages.value || 1);
  if (n !== currentPage.value) renderPage(n);
  else pageInput.value = currentPage.value; // corregir input inválido
};

// ── Descarga ───────────────────────────────────────────
const downloadPdf = () => {
  if (!pdfBlob) return;
  const url  = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href      = url;
  link.download  = `${props.itemName || 'documento'}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ── Upload ─────────────────────────────────────────────
const triggerUpload = () => {
  actionError.value = '';
  fileInput.value?.click();
};

const handleFileChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    actionError.value = 'Solo se permiten archivos PDF.';
    e.target.value = '';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    actionError.value = 'El archivo no puede superar los 10 MB.';
    e.target.value = '';
    return;
  }

  isUploading.value = true;
  actionError.value = '';
  try {
    await DossierService.uploadDocument(props.tipo, props.recordId, file);
    hasDoc.value    = true;
    loadError.value = '';
    await loadPdf();
    emit('document-updated');
  } catch (err) {
    actionError.value = err?.response?.data?.message || 'No se pudo subir el documento.';
  } finally {
    isUploading.value = false;
    e.target.value = '';
  }
};

// ── Eliminar PDF ───────────────────────────────────────
const performDelete = async () => {
  isDeleting.value  = true;
  actionError.value = '';
  try {
    await DossierService.deleteDocument(props.tipo, props.recordId);
    emit('document-deleted');
  } catch (err) {
    actionError.value      = err?.response?.data?.message || 'No se pudo eliminar el documento.';
    confirmingDelete.value = false;
  } finally {
    isDeleting.value = false;
  }
};

// ── Resize: re-renderizar si cambia el ancho del contenedor ─
const scheduleResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (pdfDoc && currentPage.value) renderPage(currentPage.value);
  }, 150);
};

// ── Lifecycle ──────────────────────────────────────────
onMounted(async () => {
  if (hasDoc.value) await loadPdf();

  window.addEventListener('resize', scheduleResize);

  // ResizeObserver en colPdf para detectar cambios de ancho del contenedor
  await nextTick();
  if (colPdf.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(colPdf.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect();
  if (resizeTimer)    clearTimeout(resizeTimer);
  window.removeEventListener('resize', scheduleResize);
  pdfBlob = null;
});
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.15s ease; }
.slide-down-enter-from,
.slide-down-leave-to     { opacity: 0; transform: translateY(-6px); }

@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fade-in 0.18s ease both; }

/* Quitar flechas del input numérico en WebKit */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>