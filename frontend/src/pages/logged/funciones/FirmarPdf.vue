<template>
  
<div class="container-fluid py-4">
  <div class="profile-section-header">
    <div>
      <h2 class="text-start profile-section-title">Firmas electronicas</h2>
      <p class="profile-section-subtitle">
        Carga documentos y define las areas de estampado para la firma.
      </p>
    </div>
  </div>

  <div v-if="pdfReady" class="row align-items-center justify-content-center g-3">
    <div class="col-auto">
      <button type="button" class="btn btn-outline-secondary btn-sm" @click="goBackToStart">
        Regresar
      </button>
    </div>
    <div class="col-auto">
      <button type="button" class="btn btn-outline-primary btn-sm" @click="triggerChangePdf">
        Cambiar PDF
      </button>
      <input
        ref="changePdfInput"
        type="file"
        class="file-input-hidden"
        accept="application/pdf"
        @change="onChangePdf"
      />
    </div>
    <div class="col-auto">
      <select v-model="selectionMode" class="mode-select" @change="setSelectionMode(selectionMode)">
        <option value="drag">Seleccion manual</option>
        <option value="preset">Caja predefinida</option>
      </select>
    </div>
    <div class="col-auto">
      <button @click="prevPageBtn" class="btnav">
        <font-awesome-icon icon="backward" class="icon" />
        <span class="tooltip">Página Anterior</span>
      </button>
    </div>
    <div class="col-auto page-info-column">
      <div class="page-info">
        <span class="page-info-label">Pagina</span>
        <input
          v-model="pageInput"
          class="page-input"
          type="number"
          min="1"
          :max="totalPages"
          @keyup.enter="goToPage"
        />
        <span class="page-total">de {{ totalPages }}</span>
      </div>
    </div>
    <div class="col-auto">
      <button @click="nextPageBtn" class="btnav">
        <font-awesome-icon icon="forward" class="icon" />
        <span class="tooltip">Página Siguiente</span>
      </button>
    </div>
    <div class="col-auto">
      <button type="button" class="btn btn-outline-primary btn-sm" @click="addFieldAction">
        Agregar firma
      </button>
    </div>
    <div class="col-auto">
      <button type="button" class="btn btn-outline-danger btn-sm" @click="openDeleteModal">
        Eliminar firma
      </button>
    </div>
    <div class="col-auto">
      <button type="button" class="btn btn-primary btn-sm" @click="submitAction">
        {{ requestMode ? 'Enviar' : 'Firmar' }}
      </button>
    </div>
  </div>

  <div v-if="!pdfReady" class="row mt-3">
    <div class="col-12">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h3 class="text-start mb-3">Selecciona el documento a firmar</h3>
          <div class="row g-4 align-items-stretch">
            <div class="col-12 col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body d-flex flex-column">
                  <h3 class="text-start mb-3">Firmar documento</h3>
                  <div
                    class="drop-button btn btn-primary btn-lg w-100"
                    :class="{ 'drop-button--active': activeDropZone === 'sign' }"
                    @dragover.prevent="setActiveDrop('sign')"
                    @dragleave="clearActiveDrop('sign')"
                    @drop="onDropFiles($event, 'sign')"
                  >
                    <input
                      id="sign_pdf_input"
                      type="file"
                      class="file-input-hidden"
                      accept="application/pdf"
                      @change="onFileInput($event, 'sign')"
                    />
                    <label class="w-100 m-0" for="sign_pdf_input">
                      Seleccionar documento
                    </label>
                  </div>
                  <p class="text-muted mt-2 drop-help">
                    Arrastra y suelta o selecciona un PDF.
                  </p>
                </div>
              </div>
            </div>
            <div class="col-12 col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body d-flex flex-column">
                  <h3 class="text-start mb-3">Buscar en base de datos</h3>
                  <button type="button" class="btn btn-primary btn-lg w-100" disabled>
                  Proximamente
                  </button>
                  <p class="text-muted mt-2 drop-help">
                    Se mostraran solicitudes pendientes con detalles del documento.
                  </p>
                </div>
              </div>
            </div>
            <div class="col-12 col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body d-flex flex-column">
                  <h3 class="text-start mb-3">Solicitar firmas</h3>
                  <div
                    class="drop-button btn btn-primary btn-lg w-100"
                    :class="{ 'drop-button--active': activeDropZone === 'request' }"
                    @dragover.prevent="setActiveDrop('request')"
                    @dragleave="clearActiveDrop('request')"
                    @drop="onDropFiles($event, 'request')"
                  >
                    <input
                      id="request_pdf_input"
                      type="file"
                      class="file-input-hidden"
                      accept="application/pdf"
                      @change="onFileInput($event, 'request')"
                    />
                    <label class="w-100 m-0" for="request_pdf_input">
                      Iniciar solicitud
                    </label>
                  </div>
                  <p class="text-muted mt-2 drop-help">
                    Envia el documento a otros usuarios para firmarlo.
                  </p>
                </div>
              </div>
            </div>
            <div class="col-12 col-lg-4">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-body d-flex flex-column">
                  <h3 class="text-start mb-3">Validar documento</h3>
                  <div
                    class="drop-button btn btn-primary btn-lg w-100"
                    :class="{ 'drop-button--active': activeDropZone === 'validate' }"
                    @dragover.prevent="setActiveDrop('validate')"
                    @dragleave="clearActiveDrop('validate')"
                    @drop="onDropFiles($event, 'validate')"
                  >
                    <input
                      id="validate_pdf_input"
                      type="file"
                      class="file-input-hidden"
                      accept="application/pdf"
                      @change="onFileInput($event, 'validate')"
                    />
                    <label class="w-100 m-0" for="validate_pdf_input">
                      Validar documento
                    </label>
                  </div>
                  <p class="text-muted mt-2 drop-help">
                    Verifica firmas y estado del documento.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p v-if="uploadError" class="text-danger mt-3 mb-0">{{ uploadError }}</p>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="row mt-3">
        <div class="col-12">
          <div class="card shadow-sm">
            <div class="card-body p-2 pdf-container" ref="colPdf">
              <div class="pdf-viewer" ref="pdfViewer">
              <canvas ref="pdfCanvas" class="pdf-canvas"></canvas>
            </div>
          </div>
        </div>
        </div>        
  </div>
  <div v-if="pdfReady" class="row">
        <p class="col-12 text-center mt-3 coordinates-text" ref="coordinatesDisplay">
          Haz clic y arrastra para dibujar cuadros. Cada cuadro queda fijado.
        </p>
  </div>
  <div v-if="pdfReady && fields.length" class="row">
        <div class="col-12">
          <div class="card shadow-sm mt-3">
          <div class="card-body">
              <h4 class="text-start mb-3">Campos agregados</h4>
              <div class="list-group">
                <div
                  v-for="field in fields"
                  :key="field.id"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  :class="{ active: field.id === lastFieldId }"
                  @click="selectField(field.id)"
                >
                  <span>
                    Pagina {{ field.page }}: x1={{ formatCoord(field.x1) }},
                    y1={{ formatCoord(field.y1) }}, x2={{ formatCoord(field.x2) }},
                    y2={{ formatCoord(field.y2) }}
                    <span v-if="field.signer">
                      · {{ field.signer.nombre }} {{ field.signer.apellido }}
                    </span>
                  </span>
                  <button type="button" class="btn btn-outline-danger btn-sm" @click.stop="removeField(field.id)">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
  </div>
  <div v-if="pdfReady && fields.length" class="row">
        <div class="col-12">
          <pre class="fields-json">{{ fieldsJson }}</pre>
        </div>
  </div>

</div>

<div class="modal fade" id="deleteFieldsModal" tabindex="-1" aria-hidden="true" ref="deleteModal">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Eliminar campos</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div v-if="!fields.length" class="text-muted">No hay firmas para eliminar.</div>
        <div v-else>
          <div class="row g-3 align-items-start">
            <div class="col-12 col-lg-6">
              <div class="d-flex align-items-center gap-2 mb-3">
                <label class="form-label mb-0">Filtrar por pagina</label>
                <select v-model="filterPage" class="form-select form-select-sm w-auto">
                  <option value="all">Todas</option>
                  <option v-for="page in pagesWithFields" :key="page" :value="page">
                    {{ page }}
                  </option>
                </select>
              </div>
              <div class="list-group">
                <div
                  v-for="field in filteredFields"
                  :key="field.id"
                  class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  :class="{ active: field.id === lastFieldId }"
                  @mouseenter="selectField(field.id, true)"
                  @focus="selectField(field.id, true)"
                >
                  <span>
                    {{ field.name }}
                    <span class="field-signer text-muted">
                      · {{ field.signer ? `${field.signer.nombre} ${field.signer.apellido}` : 'Sin asignar' }}
                    </span>
                  </span>
                  <button type="button" class="btn btn-outline-danger btn-sm" @click.stop="removeField(field.id)">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
            <div class="col-12 col-lg-6">
              <div class="preview-card">
                <h6 class="mb-2">Previsualizacion</h6>
                <canvas ref="previewCanvas" class="preview-canvas"></canvas>
                <p v-if="!selectedField" class="text-muted small mt-2 mb-0">
                  Selecciona un campo para ver el recorte.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="assignSignerModal" tabindex="-1" aria-hidden="true" ref="assignSignerModal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Asignar firmante</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <label class="form-label mb-0">Buscar usuario</label>
          <select v-model="statusFilter" class="form-select form-select-sm w-auto">
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
          class="form-control"
          placeholder="Correo, cedula o nombre"
        />
        <div class="user-results mt-3">
          <div v-if="isSearchingUsers" class="text-muted small">Buscando usuarios...</div>
          <div v-else-if="userResults.length === 0" class="text-muted small">
            No hay usuarios disponibles.
          </div>
          <div v-else class="list-group">
            <button
              v-for="user in userResults"
              :key="user.id || user._id"
              type="button"
              class="list-group-item list-group-item-action"
              :class="{ active: selectedSigner?.id === user.id || selectedSigner?._id === user._id }"
              @click="selectSigner(user)"
            >
              <div class="fw-semibold">{{ user.nombre }} {{ user.apellido }}</div>
              <div class="small text-muted">{{ user.email }} · {{ user.cedula }}</div>
            </button>
          </div>
        </div>
        <p v-if="userSearchError" class="text-danger small mt-2 mb-0">{{ userSearchError }}</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary" @click="confirmSigner">
          Guardar
        </button>
      </div>
    </div>
  </div>
</div>


  </template>
  
  <script setup>
  import { onMounted, ref, watch, nextTick, computed, defineExpose } from 'vue';
  import * as pdfjsLib from "pdfjs-dist/webpack"; // Usa esta línea para Webpack
  import { Modal } from 'bootstrap';
  import { API_ROUTES } from '@/services/apiConfig';
  
  let ctx;
  const colPdf=ref(null)
  let pdfDoc = null;
  const pdfViewer=ref(null), pdfCanvas=ref(null), coordinatesDisplay=ref(null);
  const currentPage = ref(1);
  const pageInput = ref(1);
  const totalPages = ref(0);
  const selectionMode = ref('drag');
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
  let bootstrapDeleteModal = null;
  let bootstrapAssignSignerModal = null;
  let searchTimeout = null;

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
      bootstrapDeleteModal = Modal.getOrCreateInstance(deleteModal.value);
    }
    if (assignSignerModal.value) {
      bootstrapAssignSignerModal = Modal.getOrCreateInstance(assignSignerModal.value);
    }
    const userDataString = localStorage.getItem('user');
    if (userDataString) {
      try {
        currentUser.value = JSON.parse(userDataString);
      } catch (error) {
        console.error('Error al cargar usuario en firmador:', error);
      }
    }
  });

  watch(pdfReady, async (ready) => {
    if (!ready) return;
    await nextTick();
    registerEvents();
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
            nombre: signer.nombre,
            apellido: signer.apellido,
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
      bootstrapDeleteModal = Modal.getOrCreateInstance(deleteModal.value);
      bootstrapDeleteModal.show();
    };

    const openAssignSignerModal = () => {
      if (!assignSignerModal.value) return;
      signerInput.value = '';
      userSearchError.value = '';
      selectedSigner.value = null;
      statusFilter.value = 'all';
      bootstrapAssignSignerModal = Modal.getOrCreateInstance(assignSignerModal.value);
      bootstrapAssignSignerModal.show();
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
      bootstrapAssignSignerModal?.hide();
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

    .page-info-column {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .page-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: var(--brand-info-soft);
      color: var(--brand-navy);
      border-radius: var(--radius-md);
      padding: 0.6rem 1rem;
      font-size: 1rem;
      font-weight: 600;
    }

    .page-info-label {
      font-size: 1rem;
    }

    .page-input {
      width: 5rem;
      padding: 0.35rem 0.5rem;
      border-radius: 0.5rem;
      border: 1px solid var(--brand-navy);
      font-size: 1rem;
      text-align: center;
      color: var(--brand-navy);
      background-color: var(--brand-white);
    }

    .page-total {
      font-size: 1rem;
    }

    .mode-select {
      border: 1px solid var(--brand-navy);
      border-radius: var(--radius-md);
      padding: 0.35rem 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--brand-navy);
      background-color: var(--brand-white);
      min-width: 180px;
      height: 2.1rem;
    }

    .pdf-viewer {
      position: relative;
      max-width: 100%;
    }

    .drop-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: rgba(44, 123, 229, 0.08);
      border: 2px dashed rgba(44, 123, 229, 0.5);
      color: var(--brand-navy);
    }

    .drop-button label {
      cursor: pointer;
    }

    .drop-button--active {
      background: rgba(44, 123, 229, 0.18);
      border-color: rgba(44, 123, 229, 0.85);
      color: var(--brand-navy);
    }

    .drop-help {
      font-size: 1rem;
    }

    .user-results {
      max-height: 280px;
      overflow: auto;
    }

    .list-group-item.active .field-signer.text-muted {
      color: var(--brand-white) !important;
    }

    .file-input-hidden {
      display: none;
    }

    .pdf-canvas {
      border: 1px solid var(--brand-navy);
      cursor: crosshair;
      position: relative;
      z-index: 1;
      width: 100%;
      height: auto;
      display: block;
    }

    :deep(.box) {
      border: 2px dashed var(--brand-accent, #2b8a3e);
      position: absolute;
      background-color: rgba(var(--brand-accent-rgb, 0, 150, 80), 0.25);
      z-index: 2;
    }

    :deep(.saved-box) {
      cursor: pointer;
    }

    :deep(.saved-box-delete) {
      position: absolute;
      top: -0.5rem;
      right: -0.5rem;
      background: var(--brand-danger, #dc3545);
      color: var(--brand-white, #fff);
      border: none;
      border-radius: 999px;
      padding: 0.2rem 0.45rem;
      font-size: 0.7rem;
      z-index: 3;
      pointer-events: auto;
      cursor: pointer;
    }

    :deep(.saved-box--active) {
      border-color: var(--brand-accent);
      box-shadow: 0 0 0 2px rgba(var(--brand-accent-rgb, 0, 150, 80), 0.35);
    }

    .coordinates-text {
      font-size: 1.05rem;
      font-weight: 600;
    }

    .fields-json {
      background: var(--brand-info-soft);
      border-radius: var(--radius-md);
      padding: 1rem;
      font-size: 0.9rem;
      color: var(--brand-navy);
      white-space: pre-wrap;
    }

    .preview-card {
      border: 1px solid var(--brand-line);
      border-radius: var(--radius-md);
      padding: 0.9rem;
      background: var(--brand-surface-alt);
      min-height: 320px;
    }

    .preview-canvas {
      width: 100%;
      border-radius: var(--radius-sm);
      border: 1px solid var(--brand-line);
      background: var(--brand-white);
      display: block;
    }

  .btnav {
    position: relative;
    margin-left: 5px;
    margin-top: 5px;
    padding: 0.35rem 0.6rem;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 2.4rem;
    font-weight: bold;
    color: var(--brand-accent);
    --tooltip-bg: var(--brand-accent);
    transition: color 0.3s ease-in-out;
}

.tooltip {
  visibility: hidden; /* Inicialmente oculto */
  position: absolute;
  bottom: 100%; /* Lo coloca justo encima del botón */
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--tooltip-bg);
  color: var(--brand-white);
  padding: 5px;
  height:100%;
  font-family: var(--font-base);
  border-radius: 3px;
  font-size: 16px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s;
}

.btnav:hover .tooltip {
  visibility: visible;
  opacity: 1; /* Lo hace visible cuando el hover es activado */
}
  </style>
  
