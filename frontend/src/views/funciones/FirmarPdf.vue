<template>
  <div class="w-full h-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
    <div class="flex flex-col gap-2 relative">
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-2xl font-bold text-slate-800 m-0 leading-tight">Firmas electrónicas</h2>
          <p class="text-slate-500 text-sm m-0 font-medium leading-snug">
            Carga documentos y define las areas de estampado para la firma.
          </p>
        </div>
        <button 
          v-if="isFirmarActivo"
          @click="setFirmarActivo(false)" 
          class="inline-flex items-center justify-center p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0" 
          title="Cerrar vista de firmas"
        >
          <IconX class="w-5 h-5" />
          <span class="ml-2 font-semibold text-sm">Cerrar</span>
        </button>
      </div>
    </div>

    <div v-if="pdfReady" class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start lg:items-center mt-4 border-b border-slate-100 pb-4">
      <div class="flex flex-wrap gap-3 items-center justify-start order-1 lg:order-1">
        <button
          type="button"
          class="inline-flex items-center justify-center p-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
          title="Regresar"
          aria-label="Regresar"
          @click="goBackToStart"
        >
          <IconArrowLeft class="w-5 h-5" />
        </button>
        <button type="button" class="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-sky-700 text-sky-700 hover:bg-sky-50 transition font-semibold text-sm" @click="triggerChangePdf">
          Cambiar PDF
        </button>
        <input
          ref="changePdfInput"
          type="file"
          class="hidden"
          accept="application/pdf"
          @change="onChangePdf"
        />
        <select
          v-if="!compactTopBar"
          v-model="selectionMode"
          class="block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          @change="setSelectionMode(selectionMode)"
        >
          <option value="drag">Manual</option>
          <option value="preset">Predefinida</option>
        </select>
      </div>
      
      <div class="flex flex-col items-center gap-3 order-2 lg:order-2">
        <div class="flex items-center gap-3">
          <button @click="prevPageBtn" class="text-sky-600 hover:text-sky-800 p-2 transition group relative">
            <IconChevronLeft class="w-6 h-6" />
            <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">Página Anterior</span>
          </button>
          <div class="flex items-center gap-2 bg-sky-50 text-slate-800 rounded-xl px-4 py-2 font-semibold">
            <span class="text-sm">P</span>
            <input
              v-model="pageInput"
              class="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 text-center text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              type="number"
              min="1"
              :max="totalPages"
              @keyup.enter="goToPage"
            />
            <span class="text-sm">de {{ totalPages }}</span>
          </div>
          <button @click="nextPageBtn" class="text-sky-600 hover:text-sky-800 p-2 transition group relative">
            <IconChevronRight class="w-6 h-6" />
            <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">Página Siguiente</span>
          </button>
        </div>
        
        <div v-if="compactTopBar" class="flex flex-wrap gap-3 justify-center w-full mt-2">
          <select
            v-model="selectionMode"
            class="block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            @change="setSelectionMode(selectionMode)"
          >
            <option value="drag">Manual</option>
            <option value="preset">Predefinida</option>
          </select>
          <button type="button" class="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-sky-700 text-white hover:bg-sky-800 transition font-semibold text-sm" @click="submitAction">
            {{ requestMode ? 'Enviar' : 'Firmar' }}
          </button>
        </div>
      </div>
      
      <div class="flex flex-wrap gap-3 items-center justify-end order-3 lg:order-3">
        <button type="button" class="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-sky-700 text-sky-700 hover:bg-sky-50 transition font-semibold text-sm" @click="addFieldAction">
          Agregar firma
        </button>
        <button type="button" class="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-red-600 text-red-600 hover:bg-red-50 transition font-semibold text-sm" @click="openDeleteModal">
          Eliminar
        </button>
        <button
          v-if="!compactTopBar"
          type="button"
          class="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-sky-700 text-white hover:bg-sky-800 transition font-semibold text-sm"
          @click="submitAction"
        >
          {{ requestMode ? 'Enviar' : 'Firmar' }}
        </button>
      </div>
    </div>

    <div v-if="!pdfReady" class="mt-4 border border-slate-100 bg-white rounded-3xl p-6 lg:p-8 shadow-sm">
      <h3 class="text-xl font-bold text-slate-800 mb-6 text-left">Selecciona el documento</h3>
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div class="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 text-left">Firmar documento</h3>
          <div
            class="relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition cursor-pointer w-full flex-grow"
            :class="activeDropZone === 'sign' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-300 bg-white hover:bg-slate-50'"
            @dragover.prevent="setActiveDrop('sign')"
            @dragleave="clearActiveDrop('sign')"
            @drop="onDropFiles($event, 'sign')"
          >
            <IconSignature class="w-8 h-8 text-sky-600 mb-3" />
            <input
              id="sign_pdf_input"
              type="file"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="application/pdf"
              @change="onFileInput($event, 'sign')"
            />
            <label class="text-sm font-semibold text-slate-700 w-full m-0 pointer-events-none" for="sign_pdf_input">
              Seleccionar documento
            </label>
            <p class="text-slate-500 text-xs mt-2">Arrastra y suelta o selecciona un PDF.</p>
          </div>
        </div>
        
        <div class="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 text-left">Buscar en base de datos</h3>
          <div class="flex flex-col items-center justify-center flex-grow">
            <button type="button" class="inline-flex w-full items-center justify-center px-4 py-3 rounded-xl bg-slate-200 text-slate-400 cursor-not-allowed font-semibold text-sm" disabled>
              Próximamente
            </button>
            <p class="text-slate-500 text-xs mt-3 text-left">Se mostraran solicitudes pendientes con detalles del documento.</p>
          </div>
        </div>
        
        <div class="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 text-left">Solicitar firmas</h3>
          <div
            class="relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition cursor-pointer w-full flex-grow"
            :class="activeDropZone === 'request' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-300 bg-white hover:bg-slate-50'"
            @dragover.prevent="setActiveDrop('request')"
            @dragleave="clearActiveDrop('request')"
            @drop="onDropFiles($event, 'request')"
          >
            <IconSend class="w-8 h-8 text-sky-600 mb-3" />
            <input
              id="request_pdf_input"
              type="file"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="application/pdf"
              @change="onFileInput($event, 'request')"
            />
            <label class="text-sm font-semibold text-slate-700 w-full m-0 pointer-events-none" for="request_pdf_input">
              Iniciar solicitud
            </label>
            <p class="text-slate-500 text-xs mt-2">Envía el documento a otros usuarios.</p>
          </div>
        </div>
        
        <div class="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 text-left">Validar documento</h3>
          <div
            class="relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition cursor-pointer w-full flex-grow"
            :class="activeDropZone === 'validate' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-300 bg-white hover:bg-slate-50'"
            @dragover.prevent="setActiveDrop('validate')"
            @dragleave="clearActiveDrop('validate')"
            @drop="onDropFiles($event, 'validate')"
          >
            <IconShieldCheck class="w-8 h-8 text-sky-600 mb-3" />
            <input
              id="validate_pdf_input"
              type="file"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="application/pdf"
              @change="onFileInput($event, 'validate')"
            />
            <label class="text-sm font-semibold text-slate-700 w-full m-0 pointer-events-none" for="validate_pdf_input">
              Validar documento
            </label>
            <p class="text-slate-500 text-xs mt-2">Verifica firmas y estado del documento.</p>
          </div>
        </div>

      </div>
      <p v-if="uploadError" class="text-red-500 font-medium mt-4 text-sm">{{ uploadError }}</p>
    </div>

    <div v-else class="mt-4">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 lg:p-6 w-full max-h-[80vh] overflow-y-auto overflow-x-hidden relative">
        <div class="w-full relative flex justify-center" ref="colPdf">
          <div class="relative shadow-sm border border-slate-200" ref="pdfViewer">
            <canvas ref="pdfCanvas" class="block cursor-crosshair relative z-10 w-full"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pdfReady" class="text-center font-medium text-slate-500 mt-2 text-sm" ref="coordinatesDisplay">
      Haz clic y arrastra para dibujar cuadros. Cada cuadro queda fijado.
    </div>

    <div v-if="pdfReady && fields.length" class="mt-6">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h4 class="text-lg font-semibold text-slate-800 mb-4 text-left">Campos agregados</h4>
        <div class="flex flex-col gap-3">
          <div
            v-for="field in fields"
            :key="field.id"
            class="flex flex-wrap sm:flex-nowrap items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer gap-4"
            :class="field.id === lastFieldId ? 'border-sky-500 bg-sky-50/50' : 'bg-white'"
            @click="selectField(field.id)"
          >
            <span class="text-sm text-slate-700">
              <span class="font-semibold text-slate-900 bg-slate-100 px-2 py-1 rounded mr-1">Pag {{ field.page }}</span>
              <span class="mx-2 text-slate-400">|</span>
              x1={{ formatCoord(field.x1) }}, y1={{ formatCoord(field.y1) }}, 
              x2={{ formatCoord(field.x2) }}, y2={{ formatCoord(field.y2) }}
              <template v-if="field.signer">
                <span class="mx-2 text-slate-400">|</span>
                <span class="text-sky-700 font-medium">
                  {{ field.signer.first_name }} {{ field.signer.last_name }}
                </span>
              </template>
            </span>
            <button type="button" class="inline-flex px-3 py-1.5 text-sm rounded-lg border border-red-600 text-red-600 hover:bg-red-50 transition font-medium" @click.stop="removeField(field.id)">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="pdfReady && fields.length" class="mt-6 mb-8">
      <div class="bg-slate-800 text-slate-300 rounded-2xl shadow-sm border border-slate-700 p-4">
        <div class="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">JSON Output</div>
        <pre class="text-xs whitespace-pre-wrap overflow-auto font-mono custom-scrollbar">{{ fieldsJson }}</pre>
      </div>
    </div>

  </div>

  <div class="modal fixed inset-0 z-50 hidden overflow-y-auto bg-slate-950/40 backdrop-blur-sm" id="deleteFieldsModal" tabindex="-1" aria-hidden="true" ref="deleteModal">
    <div class="flex items-center justify-center min-h-screen px-4 py-8">
      <div class="modal-dialog relative w-full max-w-4xl mx-auto my-12">
        <div class="modal-content bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-100">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h5 class="text-xl font-bold text-slate-800">Eliminar campos</h5>
            <button type="button" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition" data-modal-dismiss aria-label="Close">
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-6 overflow-y-auto max-h-[80vh]">
            <div v-if="!fields.length" class="text-slate-500 text-center font-medium py-8 bg-slate-50 rounded-xl border border-slate-100">No hay firmas para eliminar.</div>
            <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <label class="font-semibold text-sm text-slate-700 ml-2">Filtrar por pagina</label>
                  <select v-model="filterPage" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500">
                    <option value="all">Todas</option>
                    <option v-for="page in pagesWithFields" :key="page" :value="page">
                      Pagina {{ page }}
                    </option>
                  </select>
                </div>
                <div class="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div
                    v-for="field in filteredFields"
                    :key="field.id"
                    class="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
                    :class="field.id === lastFieldId ? 'border-sky-500 bg-sky-50/50' : 'bg-white'"
                    @mouseenter="selectField(field.id, true)"
                    @focus="selectField(field.id, true)"
                  >
                    <span class="text-sm font-medium text-slate-800 flex flex-col gap-1">
                      {{ field.name }}
                      <span class="text-slate-500 text-xs font-normal">
                        {{ field.signer ? `${field.signer.first_name} ${field.signer.last_name}` : 'Sin asignar' }}
                      </span>
                    </span>
                    <button type="button" class="inline-flex px-3 py-1.5 text-xs rounded-lg border border-red-600 text-red-600 hover:bg-red-50 transition font-medium" @click.stop="removeField(field.id)">
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
              <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 min-h-[320px] flex flex-col relative sticky top-0">
                <h6 class="text-sm font-semibold text-slate-700 mb-3">Previsualizacion del área</h6>
                <div class="flex-grow flex items-center justify-center bg-slate-200/50 rounded-lg overflow-hidden border border-slate-200 relative">
                  <canvas ref="previewCanvas" class="max-w-full block bg-white"></canvas>
                  <p v-if="!selectedField" class="text-slate-500 text-sm absolute">
                    Selecciona un campo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fixed inset-0 z-50 hidden bg-slate-950/40 backdrop-blur-sm" id="assignSignerModal" tabindex="-1" aria-hidden="true" ref="assignSignerModal">
    <div class="flex items-center justify-center min-h-[calc(100vh-3rem)] px-4 py-8">
      <div class="modal-dialog relative w-full max-w-lg mx-auto">
        <div class="modal-content bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-100">
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h5 class="text-xl font-bold text-slate-800">Asignar firmante</h5>
            <button type="button" class="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition" data-modal-dismiss aria-label="Close">
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-6">
            <div class="flex flex-col gap-4">
              <div class="flex flex-wrap items-center gap-3">
                <label class="font-semibold text-sm text-slate-700 mb-0">Listado de usuarios</label>
                <select v-model="statusFilter" class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500">
                  <option value="all">Todos</option>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Verificado">Verificado</option>
                  <option value="Reportado">Reportado</option>
                </select>
              </div>
              <input
                v-model="signerInput"
                type="text"
                class="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Correo, cédula o nombre"
              />
              
              <div class="mt-2 min-h-[220px] max-h-[300px] overflow-y-auto bg-slate-50 border border-slate-100 rounded-xl p-2 custom-scrollbar">
                <div v-if="isSearchingUsers" class="text-slate-500 text-sm text-center py-10 font-medium">Buscando usuarios...</div>
                <div v-else-if="userResults.length === 0" class="text-slate-500 text-sm text-center py-10 font-medium">
                  No se han encontrado resultados.
                </div>
                <div v-else class="flex flex-col gap-2">
                  <button
                    v-for="user in userResults"
                    :key="user.id || user._id"
                    type="button"
                    class="flex flex-col p-3 border rounded-xl text-left transition w-full shadow-sm"
                    :class="selectedSigner?.id === user.id || selectedSigner?._id === user._id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
                    @click="selectSigner(user)"
                  >
                    <div class="font-semibold text-slate-800 text-sm flex items-center justify-between w-full">
                      <span>{{ user.first_name }} {{ user.last_name }}</span>
                      <span v-if="selectedSigner?.id === user.id || selectedSigner?._id === user._id" class="text-sky-600 bg-sky-100 px-2 py-0.5 rounded text-xs">Seleccionado</span>
                    </div>
                    <div class="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{{ user.cedula }}</span>
                      <span>{{ user.email }}</span>
                    </div>
                  </button>
                </div>
              </div>
              <p v-if="userSearchError" class="text-red-500 text-sm font-medium mt-1 mb-0">{{ userSearchError }}</p>
            </div>
          </div>
          <div class="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50 rounded-b-2xl">
            <button type="button" class="inline-flex items-center px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 transition" data-modal-dismiss>
              Cancelar
            </button>
            <button type="button" class="inline-flex items-center justify-center px-6 py-2 rounded-xl bg-sky-700 text-white hover:bg-sky-800 transition font-semibold shadow-sm" @click="confirmSigner">
              Guardar y Asignar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
  <script setup>
  import { onMounted, onBeforeUnmount, ref, watch, nextTick, computed, defineExpose } from 'vue';
  import * as pdfjsLib from "pdfjs-dist/webpack"; // Usa esta línea para Webpack
  import { Modal } from '@/utils/modalController';
  import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconSignature, IconSend, IconShieldCheck, IconX } from '@tabler/icons-vue';
  import { API_ROUTES } from '@/services/apiConfig';
  import { useFirmar } from '@/composables/useFirmar';
  
  const { isFirmarActivo, setFirmarActivo } = useFirmar();

  let ctx;
  const colPdf=ref(null)
  let pdfDoc = null;
  const pdfViewer=ref(null), pdfCanvas=ref(null), coordinatesDisplay=ref(null);
  const currentPage = ref(1);
  const pageInput = ref(1);
  const totalPages = ref(0);
  const selectionMode = ref('preset');
  const uploadedFiles = ref([]);
  const uploadError = ref('');
  const pdfReady = ref(false);
  const requestMode = ref(false);
  const deleteModal = ref(null);
  const changePdfInput = ref(null);
  const activeDropZone = ref(null);
  const assignSignerModal = ref(null);
  const signerInput = ref('');
  const userResults = ref([]);
  const userSearchError = ref('');
  const isSearchingUsers = ref(false);
  const selectedSigner = ref(null);
  const statusFilter = ref('all');
  const currentUser = ref(null);
  const fields = ref([]);
  const lastSelection = ref(null);
  const lastFieldId = ref(null);
  const fieldCounter = ref(1);
  const fieldsJson = computed(() => JSON.stringify(fields.value, null, 2));
  const previewCanvas = ref(null);
  const selectedField = ref(null);
  const filterPage = ref('all');
  const filteredFields = computed(() => {
    if (filterPage.value === 'all') return fields.value;
    return fields.value.filter((field) => field.page === Number(filterPage.value));
  });
  const pagesWithFields = computed(() => {
    const pages = new Set(fields.value.map((field) => field.page));
    return Array.from(pages).sort((a, b) => a - b);
  });
  let viewport = null;
  let pdfScale = 1.75; 
  let pdfObjectUrl = null;
  let deleteModalInstance = null;
  let assignSignerModalInstance = null;
  let searchTimeout = null;
  let resizeObserver = null;
  let resizeTimer = null;
  let lastContainerWidth = null;
  const compactTopBar = ref(false);

  const FIELD_WIDTH = 110;
  const FIELD_HEIGHT = 80;
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let activeBox = null;

  const removeBox = () => {
    const signbox = document.getElementById('active-signbox');
    if (signbox) {
      signbox.remove();
    }
  };

  const clearAllBoxes = () => {
    pdfViewer.value?.querySelectorAll('.box')?.forEach((box) => box.remove());
  };

  const getViewerRect = () => pdfViewer.value.getBoundingClientRect();

  const getDisplayScale = () => {
    const rect = getViewerRect();
    if (!rect.width) return 1;
    return pdfCanvas.value.width / rect.width;
  };

  const toPdfUnits = (cssValue) => {
    const displayScale = getDisplayScale();
    return (cssValue * displayScale) / pdfScale;
  };

  const toCssUnits = (pdfUnits) => {
    const displayScale = getDisplayScale();
    return (pdfUnits * pdfScale) / displayScale;
  };

  const updateCoordinates = (left, top, right, bottom, rectHeight) => {
    const x1 = toPdfUnits(left);
    const y1 = toPdfUnits(rectHeight - top);
    const x2 = toPdfUnits(right);
    const y2 = toPdfUnits(rectHeight - bottom);
    coordinatesDisplay.value.textContent =
      `Coordenadas Cartesianas: Superior Izquierda (x1=${x1}, y1=${y1}), Inferior Derecha (x2=${x2}, y2=${y2})`;
    lastSelection.value = {
      page: currentPage.value,
      x1,
      y1,
      x2,
      y2
    };
  };

  const attachDeleteButton = (box, fieldId) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('saved-box-delete');
    button.textContent = 'Eliminar';
    button.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      removeField(fieldId);
    });
    box.appendChild(button);
  };

  const createBox = (left, top, width, height) => {
    removeBox();
    const box = document.createElement('div');
    box.classList.add('box');
    box.id = 'active-signbox';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.position = 'absolute';
    box.style.pointerEvents = 'none';
    pdfViewer.value.appendChild(box);
    return box;
  };

  const handleMouseDown = (event) => {
    if (!pdfDoc || !pdfViewer.value) return;

    const rect = getViewerRect();
    const ofx = rect.left + window.scrollX;
    const ofy = rect.top + window.scrollY;
    const currentX = event.pageX - ofx;
    const currentY = event.pageY - ofy;

    if (selectionMode.value === 'preset') {
      const presetWidth = toCssUnits(FIELD_WIDTH);
      const presetHeight = toCssUnits(FIELD_HEIGHT);
      const maxLeft = Math.max(0, rect.width - presetWidth);
      const maxTop = Math.max(0, rect.height - presetHeight);
      const left = Math.min(Math.max(currentX, 0), maxLeft);
      const top = Math.min(Math.max(currentY, 0), maxTop);
      const box = createBox(left, top, presetWidth, presetHeight);
      updateCoordinates(left, top, left + presetWidth, top + presetHeight, rect.height);
      activeBox = box;
      return;
    }

    startX = currentX;
    startY = currentY;
    activeBox = createBox(startX, startY, 0, 0);
    isDragging = true;
  };

  const handleMouseMove = (event) => {
    if (!isDragging || !activeBox || !pdfViewer.value) return;

    const rect = getViewerRect();
    const ofx = rect.left + window.scrollX;
    const ofy = rect.top + window.scrollY;
    const currentX = event.pageX - ofx;
    const currentY = event.pageY - ofy;

    const left = Math.max(Math.min(currentX, startX), 0);
    const top = Math.max(Math.min(currentY, startY), 0);
    const right = Math.min(Math.max(currentX, startX), rect.width);
    const bottom = Math.min(Math.max(currentY, startY), rect.height);

    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    activeBox.style.left = `${left}px`;
    activeBox.style.top = `${top}px`;
    activeBox.style.width = `${width}px`;
    activeBox.style.height = `${height}px`;

    updateCoordinates(left, top, right, bottom, rect.height);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
  };

  const registerEvents = () => {
    if (!pdfViewer.value) return;
    pdfViewer.value.addEventListener('mousedown', handleMouseDown);
    pdfViewer.value.addEventListener('mousemove', handleMouseMove);
    pdfViewer.value.addEventListener('mouseup', handleMouseUp);
    pdfViewer.value.addEventListener('mouseleave', handleMouseUp);
  };

  onMounted(() => {
    registerEvents();
    if (deleteModal.value) {
      deleteModalInstance = Modal.getOrCreateInstance(deleteModal.value);
    }
    if (assignSignerModal.value) {
      assignSignerModalInstance = Modal.getOrCreateInstance(assignSignerModal.value);
    }
    const userDataString = localStorage.getItem('user');
    if (userDataString) {
      try {
        currentUser.value = JSON.parse(userDataString);
      } catch (error) {
        console.error('Error al cargar usuario en firmador:', error);
      }
    }
    ensureResizeObserver();
    window.addEventListener('resize', scheduleResizeRender);
  });

  watch(pdfReady, async (ready) => {
    if (!ready) return;
    await nextTick();
    registerEvents();
    ensureResizeObserver();
  });

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    window.removeEventListener('resize', scheduleResizeRender);
  });

  watch(signerInput, (value) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchTimeout = setTimeout(() => {
      fetchUsers(value);
    }, 300);
  });

  watch(statusFilter, () => {
    fetchUsers(signerInput.value);
  });
  


  const renderPage=(pageNum)=> {
    pdfDoc.getPage(pageNum).then(page => {
      if (!pdfCanvas.value) return;
      ctx = pdfCanvas.value.getContext('2d');
      const baseViewport = page.getViewport({ scale: 1 });
      const containerWidth = colPdf.value?.clientWidth || baseViewport.width;
      pdfScale = containerWidth / baseViewport.width;
      viewport = page.getViewport({ scale: pdfScale });
      pdfCanvas.value.width = viewport.width;
      pdfCanvas.value.height = viewport.height;
      colPdf.value.style.width = '100%';
      pdfViewer.value.style.width = `${viewport.width}px`;
      pdfViewer.value.style.height = `${viewport.height}px`;
      



      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };
      page.render(renderContext);

      currentPage.value = pageNum;
      pageInput.value = pageNum;
      clearAllBoxes();
      renderFieldsForPage();
    });
  }

  const scheduleResizeRender = () => {
    if (!pdfReady.value || !pdfDoc) return;
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      if (!pdfReady.value || !pdfDoc) return;
      renderPage(currentPage.value);
    }, 150);
  };

  const ensureResizeObserver = () => {
    if (!colPdf.value || typeof ResizeObserver === 'undefined') return;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        const width = entries?.[0]?.contentRect?.width;
        if (!width || width === lastContainerWidth) return;
        lastContainerWidth = width;
        compactTopBar.value = width < 900;
        scheduleResizeRender();
      });
    }
    resizeObserver.observe(colPdf.value);
  };


    const prevPageBtn= () => {
      if (currentPage.value <= 1) return;
      renderPage(currentPage.value - 1);
    }

    const nextPageBtn=() => {
      if (currentPage.value >= totalPages.value) return;
      renderPage(currentPage.value + 1);
    }

    const goToPage = () => {
      const parsed = Number.parseInt(pageInput.value, 10);
      if (Number.isNaN(parsed)) {
        pageInput.value = currentPage.value;
        return;
      }
      const target = Math.min(Math.max(parsed, 1), totalPages.value || 1);
      renderPage(target);
    }

    const setSelectionMode = (mode) => {
      selectionMode.value = mode;
    }

    const resetPdfState = () => {
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
        pdfObjectUrl = null;
      }
      pdfDoc = null;
      pdfReady.value = false;
      totalPages.value = 0;
      currentPage.value = 1;
      pageInput.value = 1;
      lastSelection.value = null;
      lastFieldId.value = null;
      selectionMode.value = 'preset';
    };

    const loadPdfFromFile = (file, mode = 'sign') => {
      resetPdfState();
      fields.value = [];
      lastSelection.value = null;
      lastFieldId.value = null;
      fieldCounter.value = 1;
      clearAllBoxes();
      selectedField.value = null;
      filterPage.value = 'all';
      statusFilter.value = 'all';
      requestMode.value = mode === 'request';
      pdfObjectUrl = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument(pdfObjectUrl);
      loadingTask.promise.then(pdf => {
        pdfDoc = pdf;
        totalPages.value = pdfDoc.numPages;
        pdfReady.value = true;
        renderPage(currentPage.value);
      }).catch(err => {
        uploadError.value = 'No se pudo cargar el PDF seleccionado.';
        console.error('Error al cargar el PDF:', err);
        resetPdfState();
      });
    };

    const onAddFiles = (files, mode = 'sign') => {
      uploadError.value = '';
      const file = files?.[0];
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        uploadError.value = 'El archivo debe ser un PDF.';
        return;
      }
      uploadedFiles.value = [{ content: file, isRenaming: false, name: file.name }];
      loadPdfFromFile(file, mode);
    };

    const onFileInput = (event, mode) => {
      const files = event.target.files;
      onAddFiles(files, mode);
      event.target.value = '';
    };

    const onDropFiles = (event, mode) => {
      event.preventDefault();
      activeDropZone.value = null;
      const files = event.dataTransfer.files;
      onAddFiles(files, mode);
    };

    const setActiveDrop = (zone) => {
      activeDropZone.value = zone;
    };

    const clearActiveDrop = (zone) => {
      if (activeDropZone.value === zone) {
        activeDropZone.value = null;
      }
    };

    const triggerChangePdf = () => {
      changePdfInput.value?.click();
    };

    const onChangePdf = (event) => {
      const files = event.target.files;
      if (files?.length) {
        onAddFiles(files, requestMode.value ? 'request' : 'sign');
      }
      event.target.value = '';
    };

    const fetchUsers = async (term) => {
      isSearchingUsers.value = true;
      userSearchError.value = '';
      try {
        const query = encodeURIComponent(term || '');
        const statusQuery = statusFilter.value !== 'all'
          ? `&status=${encodeURIComponent(statusFilter.value)}`
          : '';
        const url = `${API_ROUTES.BASE}/easym/v1/users?search=${query}&limit=8${statusQuery}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('No se pudo obtener usuarios');
        }
        const data = await response.json();
        userResults.value = Array.isArray(data) ? data : [];
      } catch (error) {
        userSearchError.value = 'No se pudo cargar la lista de usuarios.';
        userResults.value = [];
      } finally {
        isSearchingUsers.value = false;
      }
    };

    const selectSigner = (user) => {
      selectedSigner.value = user;
      signerInput.value = user?.email || user?.cedula || '';
      userSearchError.value = '';
    };

    const addFieldAction = () => {
      if (requestMode.value) {
        openAssignSignerModal();
        return;
      }
      saveFieldWithSigner(currentUser.value);
    };

    const saveFieldWithSigner = (signer) => {
      if (!activeBox || !lastSelection.value) return;
      const selection = lastSelection.value;
      if (selection.x1 === selection.x2 || selection.y1 === selection.y2) return;
      const fieldName = `Firma ${fieldCounter.value}`;
      fieldCounter.value += 1;
      const resolvedSigner = signer
        ? {
            id: signer.id ?? signer._id,
            cedula: signer.cedula,
            first_name: signer.first_name,
            last_name: signer.last_name,
            email: signer.email
          }
        : null;
      const field = {
        id: `field-${Date.now()}`,
        name: fieldName,
        page: selection.page,
        x1: Number(selection.x1.toFixed(2)),
        y1: Number(selection.y1.toFixed(2)),
        x2: Number(selection.x2.toFixed(2)),
        y2: Number(selection.y2.toFixed(2)),
        signer: resolvedSigner
      };
      fields.value = [...fields.value, field];
      lastFieldId.value = field.id;
      activeBox.removeAttribute('id');
      activeBox.classList.add('saved-box');
      activeBox.dataset.fieldId = field.id;
      attachDeleteButton(activeBox, field.id);
      activeBox.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
      activeBox.addEventListener('click', () => {
        selectField(field.id);
      });
      updateSavedHighlight();
      activeBox = null;
      lastSelection.value = null;
    };

    const submitAction = () => {
      if (requestMode.value) {
        console.log('Enviar solicitud de firmas');
        return;
      }
      console.log('Firmar documento');
    };

  const updateSavedHighlight = () => {
      pdfViewer.value?.querySelectorAll('.saved-box')?.forEach((box) => {
        box.classList.remove('saved-box--active');
      });
      if (!lastFieldId.value) return;
      const activeSaved = pdfViewer.value?.querySelector(
        `[data-field-id="${lastFieldId.value}"]`
      );
      if (activeSaved) {
        activeSaved.classList.add('saved-box--active');
      }
    };

    const selectField = (fieldId, preview = false) => {
      lastFieldId.value = fieldId;
      updateSavedHighlight();
      selectedField.value = fields.value.find((item) => item.id === fieldId) || null;
      if (preview) {
        const field = fields.value.find((item) => item.id === fieldId);
        if (field && field.page !== currentPage.value) {
          renderPage(field.page);
        }
        if (field) {
          renderFieldPreview(field);
        }
      }
    };

    const renderFieldsForPage = () => {
      if (!pdfViewer.value) return;
      const rect = getViewerRect();
      fields.value
        .filter((field) => field.page === currentPage.value)
        .forEach((field) => {
          const left = toCssUnits(field.x1);
          const right = toCssUnits(field.x2);
          const top = rect.height - toCssUnits(field.y1);
          const bottom = rect.height - toCssUnits(field.y2);
          const width = Math.max(0, right - left);
          const height = Math.max(0, bottom - top);
          const box = document.createElement('div');
          box.classList.add('box', 'saved-box');
          if (field.id === lastFieldId.value) {
            box.classList.add('saved-box--active');
          }
          box.dataset.fieldId = field.id;
          box.addEventListener('mousedown', (event) => {
            event.stopPropagation();
          });
          box.addEventListener('click', () => {
            selectField(field.id);
          });
          box.style.left = `${left}px`;
          box.style.top = `${top}px`;
          box.style.width = `${width}px`;
          box.style.height = `${height}px`;
          box.style.position = 'absolute';
          box.style.pointerEvents = 'auto';
          attachDeleteButton(box, field.id);
          pdfViewer.value.appendChild(box);
        });
    };

    const removeField = (fieldId) => {
      fields.value = fields.value.filter((field) => field.id !== fieldId);
      const box = pdfViewer.value?.querySelector(`[data-field-id="${fieldId}"]`);
      if (box) {
        box.remove();
      }
      if (lastFieldId.value === fieldId) {
        lastFieldId.value = fields.value[fields.value.length - 1]?.id || null;
      }
      if (selectedField.value?.id === fieldId) {
        selectedField.value = null;
        if (previewCanvas.value) {
          const ctx = previewCanvas.value.getContext('2d');
          ctx?.clearRect(0, 0, previewCanvas.value.width, previewCanvas.value.height);
        }
      }
      updateSavedHighlight();
    };

    const formatCoord = (value) => {
      return Number(value).toFixed(2);
    };

    const renderFieldPreview = (field) => {
      if (!previewCanvas.value || !pdfDoc) return;
      pdfDoc.getPage(field.page).then((page) => {
        const previewCtx = previewCanvas.value.getContext('2d');
        if (!previewCtx) return;
        const fullViewport = page.getViewport({ scale: 1 });
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = fullViewport.width;
        tempCanvas.height = fullViewport.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        page.render({ canvasContext: tempCtx, viewport: fullViewport }).promise.then(() => {
          const padding = 40;
          const rawWidth = Math.max(1, field.x2 - field.x1);
          const rawHeight = Math.max(1, field.y1 - field.y2);
          const cropLeft = Math.max(0, field.x1 - padding);
          const cropTop = Math.max(0, fullViewport.height - field.y1 - padding);
          const cropWidth = Math.min(fullViewport.width - cropLeft, rawWidth + padding * 2);
          const cropHeight = Math.min(fullViewport.height - cropTop, rawHeight + padding * 2);
          const maxWidth = 420;
          const scale = maxWidth / cropWidth;
          previewCanvas.value.width = Math.round(cropWidth * scale);
          previewCanvas.value.height = Math.round(cropHeight * scale);
          previewCtx.clearRect(0, 0, previewCanvas.value.width, previewCanvas.value.height);
          previewCtx.drawImage(
            tempCanvas,
            cropLeft,
            cropTop,
            cropWidth,
            cropHeight,
            0,
            0,
            previewCanvas.value.width,
            previewCanvas.value.height
          );
        });
      });
    };

    const goBackToStart = () => {
      resetToStart();
    };

    const openDeleteModal = () => {
      if (!deleteModal.value) return;
      deleteModalInstance = Modal.getOrCreateInstance(deleteModal.value);
      deleteModalInstance.show();
    };

    const openAssignSignerModal = () => {
      if (!assignSignerModal.value) return;
      signerInput.value = '';
      userSearchError.value = '';
      selectedSigner.value = null;
      statusFilter.value = 'all';
      assignSignerModalInstance = Modal.getOrCreateInstance(assignSignerModal.value);
      assignSignerModalInstance.show();
      fetchUsers('');
    };

    const confirmSigner = () => {
      if (!activeBox || !lastSelection.value) {
        userSearchError.value = 'Selecciona un area de firma antes de asignar.';
        return;
      }
      if (!selectedSigner.value) {
        userSearchError.value = 'Selecciona un usuario de la lista.';
        return;
      }
      saveFieldWithSigner(selectedSigner.value);
      assignSignerModalInstance?.hide();
    };

    const resetToStart = () => {
      uploadedFiles.value = [];
      uploadError.value = '';
      fields.value = [];
      lastSelection.value = null;
      lastFieldId.value = null;
      fieldCounter.value = 1;
      activeBox = null;
      clearAllBoxes();
      selectedField.value = null;
      filterPage.value = 'all';
      signerInput.value = '';
      statusFilter.value = 'all';
      userResults.value = [];
      userSearchError.value = '';
      selectedSigner.value = null;
      resetPdfState();
    };

    defineExpose({ resetToStart });

  </script>
<style scoped>
.pdf-viewer {
  position: relative;
  max-width: 100%;
}

:deep(.box) {
  border: 2px dashed var(--brand-accent, #0ea5e9);
  position: absolute;
  background-color: rgba(14, 165, 233, 0.25);
  z-index: 2;
}

:deep(.saved-box) {
  cursor: pointer;
}

:deep(.saved-box-delete) {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  background: var(--state-danger, #dc3545);
  color: var(--brand-white, #fff);
  border: none;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 3;
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 0.2s;
}

:deep(.saved-box-delete:hover) {
  background: #b02a37;
}

:deep(.saved-box--active) {
  border-color: var(--brand-accent, #0ea5e9);
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.35);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--brand-border, #e2e8f0);
  border-radius: 10px;
}
</style>