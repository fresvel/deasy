<template>
  <div class="container-fluid py-4">
    <div class="profile-section-header">
      <div>
        <h2 class="text-start profile-section-title">
          {{ table?.label || "Administracion SQL" }}
        </h2>
        <p class="profile-section-subtitle">
          Gestiona registros en {{ table?.table || "la base de datos" }}.
        </p>
      </div>
      <div class="profile-section-actions">
        <div class="d-flex gap-2">
          <button
            class="btn btn-outline-secondary btn-lg"
            type="button"
            :disabled="!table"
            @click="handleSearchAction"
          >
            Buscar
          </button>
          <button
            class="btn btn-primary btn-lg profile-add-btn"
            type="button"
            :disabled="!table"
            @click="openCreate"
          >
            <font-awesome-icon icon="plus" class="me-2" />
            Agregar
          </button>
        </div>
      </div>
    </div>

    <div v-if="!table" class="row">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <p class="text-muted mb-0">Selecciona una tabla para administrar.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="row">
      <div class="col-12">
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-center mb-3">
              <div class="col-12 col-md-6">
                <input
                  ref="searchInput"
                  v-model="searchTerm"
                  type="text"
                  class="form-control"
                  placeholder="Buscar en la tabla"
                  @input="debouncedSearch"
                />
              </div>
              <div class="col-12 col-md-6 text-md-end">
                <button
                  class="btn btn-outline-secondary btn-sm"
                  type="button"
                  @click="fetchRows"
                >
                  Actualizar
                </button>
              </div>
            </div>

            <div v-if="loading" class="text-muted">Cargando datos...</div>
            <div v-else-if="error" class="text-danger">{{ error }}</div>
            <div v-else class="table-responsive table-actions">
              <div class="table-actions-scroll">
                <table class="table table-striped table-hover align-middle table-institutional table-actions">
                <thead>
                  <tr>
                    <th v-for="field in table.fields" :key="field.name" class="text-start">
                      {{ field.label || field.name }}
                    </th>
                    <th class="text-start">ACCION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="rows.length === 0">
                    <td :colspan="table.fields.length + 1" class="text-center text-muted">
                      <p class="my-3">No hay registros disponibles</p>
                    </td>
                  </tr>
                  <tr v-for="row in rows" :key="rowKey(row)">
                    <td v-for="field in table.fields" :key="field.name">
                      {{ formatCell(row[field.name], field) }}
                    </td>
                    <td>
                      <div class="dropdown" @click.stop>
                        <button
                          class="btn btn-outline-primary btn-sm dropdown-toggle"
                          type="button"
                          :aria-expanded="openDropdownId === rowKey(row)"
                          aria-label="Acciones"
                          title="Acciones"
                          @click="toggleDropdown(row)"
                        >
                          <font-awesome-icon icon="ellipsis-vertical" />
                        </button>
                        <ul
                          class="dropdown-menu dropdown-menu-end"
                          :class="{ show: openDropdownId === rowKey(row) }"
                        >
                          <li>
                            <button class="dropdown-item" type="button" @click="openEdit(row); closeDropdown()">
                              <font-awesome-icon icon="edit" class="me-2" />
                              Editar
                            </button>
                          </li>
                          <li>
                            <button class="dropdown-item text-danger" type="button" @click="openDelete(row); closeDropdown()">
                              <font-awesome-icon icon="trash" class="me-2" />
                              Eliminar
                            </button>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlEditorModal"
      tabindex="-1"
      aria-labelledby="sqlEditorModalLabel"
      aria-hidden="true"
      ref="editorModal"
    >
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlEditorModalLabel">
              {{ editorMode === "create" ? "Crear registro" : "Editar registro" }}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div v-if="modalError" class="alert alert-danger mb-3">
              {{ modalError }}
            </div>
            <form class="row g-3">
              <div
                v-for="field in formFields"
                :key="field.name"
                class="col-12 col-md-6"
              >
                <label class="form-label">
                  {{ field.label || field.name }}
                  <span v-if="field.required" class="text-danger">*</span>
                </label>
                <div v-if="isInputField(field) && isForeignKeyField(field)" class="input-group">
                  <input
                    v-model="fkDisplay[field.name]"
                    type="text"
                    class="form-control"
                    :placeholder="field.placeholder || ''"
                    :readonly="true"
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    :disabled="isFieldLocked(field)"
                    @click="openFkSearch(field)"
                  >
                    Buscar
                  </button>
                </div>
                <input
                  v-else-if="isInputField(field)"
                  v-model="formData[field.name]"
                  :type="inputType(field)"
                  class="form-control"
                  :placeholder="field.placeholder || ''"
                  :disabled="isFieldLocked(field)"
                />
                <textarea
                  v-else-if="field.type === 'textarea'"
                  v-model="formData[field.name]"
                  class="form-control"
                  rows="3"
                  :disabled="isFieldLocked(field)"
                ></textarea>
                <select
                  v-else-if="field.type === 'select'"
                  v-model="formData[field.name]"
                  class="form-select"
                  :disabled="isFieldLocked(field)"
                >
                  <option value="">Seleccionar</option>
                  <option v-for="option in field.options || []" :key="option" :value="option">
                    {{ option }}
                  </option>
                </select>
                <select
                  v-else-if="field.type === 'boolean'"
                  v-model="formData[field.name]"
                  class="form-select"
                  :disabled="isFieldLocked(field)"
                >
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
                <input
                  v-else
                  v-model="formData[field.name]"
                  type="text"
                  class="form-control"
                  :disabled="isFieldLocked(field)"
                />
              </div>
              <div v-if="isTemplateTable" class="col-12 col-md-6">
                <label class="form-label">Proceso</label>
                <div class="input-group">
                  <input
                    v-model="templateProcessLabel"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openTemplateProcessSearch"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-primary" @click="submitForm">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlDeleteModal"
      tabindex="-1"
      aria-labelledby="sqlDeleteModalLabel"
      aria-hidden="true"
      ref="deleteModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlDeleteModalLabel">Eliminar registro</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Confirma la eliminacion del registro seleccionado.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-danger" @click="confirmDelete">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="sqlFkModal"
      tabindex="-1"
      aria-labelledby="sqlFkModalLabel"
      aria-hidden="true"
      ref="fkModal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="sqlFkModalLabel">
              Buscar referencia {{ fkTable?.label || "" }}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3 align-items-center mb-3">
              <div class="col-12">
                <label class="form-label text-dark">Busqueda</label>
                <input
                  v-model="fkSearch"
                  type="text"
                  class="form-control"
                  placeholder="Buscar referencia"
                  @input="debouncedFkSearch"
                />
              </div>
            </div>
            <div v-if="fkLoading" class="text-muted">Cargando...</div>
            <div v-else-if="fkError" class="text-danger">{{ fkError }}</div>
            <div v-else class="table-responsive">
              <table class="table table-striped table-hover align-middle table-institutional">
                <thead>
                  <tr>
                    <th class="text-start">ID</th>
                    <th class="text-start">Detalle</th>
                    <th class="text-start">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="fkRows.length === 0">
                    <td colspan="3" class="text-center text-muted">
                      <p class="my-3">No hay registros disponibles</p>
                    </td>
                  </tr>
                  <tr v-for="row in fkRows" :key="row.id">
                    <td>{{ row.id }}</td>
                    <td>
                      {{ row[resolveDisplayField(fkTable) || "id"] || "—" }}
                    </td>
                    <td>
                      <button type="button" class="btn btn-outline-primary btn-sm" @click="selectFkRow(row)">
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="processSearchModal"
      tabindex="-1"
      aria-labelledby="processSearchModalLabel"
      aria-hidden="true"
      ref="processSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="processSearchModalLabel">Buscar procesos</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Unidad</label>
                <div class="input-group">
                  <input
                    v-model="processFilterLabels.unit_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona una unidad"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openProcessFkSearch('unit_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Programa</label>
                <div class="input-group">
                  <input
                    v-model="processFilterLabels.program_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un programa"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openProcessFkSearch('program_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Proceso padre</label>
                <div class="input-group">
                  <input
                    v-model="processFilterLabels.parent_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso padre"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openProcessFkSearch('parent_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Periodo</label>
                <div class="input-group">
                  <input
                    v-model="processFilterLabels.term_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un periodo"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openProcessFkSearch('term_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Tiene documento</label>
                <select v-model="processFilters.has_document" class="form-select">
                  <option value="">Todos</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label text-dark">Activo</label>
                <select v-model="processFilters.is_active" class="form-select">
                  <option value="">Todos</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearProcessFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" @click="applyProcessFilter">
              Buscar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="templateSearchModal"
      tabindex="-1"
      aria-labelledby="templateSearchModalLabel"
      aria-hidden="true"
      ref="templateSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="templateSearchModalLabel">Buscar plantillas</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Nombre</label>
                <input v-model="templateFilters.name" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Slug</label>
                <input v-model="templateFilters.slug" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Descripcion</label>
                <input v-model="templateFilters.description" type="text" class="form-control" />
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Proceso</label>
                <div class="input-group">
                  <input
                    v-model="templateFilterLabels.process_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openTemplateFkSearch"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearTemplateFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" @click="applyTemplateFilter">
              Buscar
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      class="modal fade"
      id="documentSearchModal"
      tabindex="-1"
      aria-labelledby="documentSearchModalLabel"
      aria-hidden="true"
      ref="documentSearchModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="documentSearchModalLabel">Buscar documentos</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label text-dark">Proceso</label>
                <div class="input-group">
                  <input
                    v-model="documentFilterLabels.process_id"
                    type="text"
                    class="form-control"
                    placeholder="Selecciona un proceso"
                    readonly
                    @keydown.prevent
                    @paste.prevent
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    @click="openDocumentFkSearch('process_id')"
                  >
                    Buscar
                  </button>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label text-dark">Estado</label>
                <select v-model="documentFilters.status" class="form-select">
                  <option value="">Todos</option>
                  <option value="Inicial">Inicial</option>
                  <option value="En proceso">En proceso</option>
                  <option value="Aprobado">Aprobado</option>
                  <option value="Rechazado">Rechazado</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-outline-primary" @click="clearDocumentFilter">
              Limpiar
            </button>
            <button type="button" class="btn btn-primary" @click="applyDocumentFilter">
              Buscar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineExpose, onBeforeUnmount, onMounted, ref, watch } from "vue";
import axios from "axios";
import { Modal } from "bootstrap";
import { API_ROUTES } from "@/services/apiConfig";

const props = defineProps({
  table: {
    type: Object,
    default: null
  },
  allTables: {
    type: Array,
    default: () => []
  }
});

const rows = ref([]);
const loading = ref(false);
const error = ref("");
const searchTerm = ref("");
const editorMode = ref("create");
const formData = ref({});
const selectedRow = ref(null);
const modalError = ref("");
const fkDisplay = ref({});

const editorModal = ref(null);
const deleteModal = ref(null);
const fkModal = ref(null);
const searchInput = ref(null);
let editorInstance = null;
let deleteInstance = null;
let fkInstance = null;
let returnModal = null;
let searchTimeout = null;

const fkTable = ref(null);
const fkRows = ref([]);
const fkSearch = ref("");
const fkLoading = ref(false);
const fkError = ref("");
const fkField = ref("");
const fkSetter = ref(null);
const openDropdownId = ref(null);

const processFilters = ref({
  unit_id: "",
  program_id: "",
  parent_id: "",
  term_id: "",
  has_document: "",
  is_active: ""
});
const processFilterLabels = ref({
  unit_id: "",
  program_id: "",
  parent_id: "",
  term_id: ""
});
const templateFilters = ref({
  name: "",
  slug: "",
  description: "",
  process_id: ""
});
const templateFilterLabels = ref({
  process_id: ""
});
const templateProcessId = ref("");
const templateProcessLabel = ref("");
const documentFilters = ref({
  process_id: "",
  term_id: "",
  status: ""
});
const documentFilterLabels = ref({
  process_id: "",
  term_id: ""
});
const templateSearchModal = ref(null);
let templateSearchInstance = null;
const documentSearchModal = ref(null);
let documentSearchInstance = null;
const processSearchModal = ref(null);
let processSearchInstance = null;

const editableFields = computed(() => {
  if (!props.table) {
    return [];
  }
  return props.table.fields.filter((field) => !field.readOnly);
});

const formFields = computed(() => {
  if (!props.table) {
    return [];
  }
  if (props.table.table === "templates") {
    return props.table.fields.filter(
      (field) => !field.readOnly || field.name === "version"
    );
  }
  return editableFields.value;
});

const isTemplateTable = computed(() => props.table?.table === "templates");

const allTablesMap = computed(() =>
  Object.fromEntries(props.allTables.map((table) => [table.table, table]))
);

const rowKey = (row) => {
  if (!props.table) {
    return JSON.stringify(row);
  }
  return props.table.primaryKeys.map((key) => row[key]).join("-");
};

const formatCell = (value, field) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (field.type === "boolean") {
    return Number(value) === 1 ? "Si" : "No";
  }
  return value;
};

const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
};

const toDateTimeInputValue = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
};

const ensureEditorInstance = () => {
  if (!editorInstance && editorModal.value) {
    editorInstance = new Modal(editorModal.value);
  }
};

const ensureDeleteInstance = () => {
  if (!deleteInstance && deleteModal.value) {
    deleteInstance = new Modal(deleteModal.value);
  }
};

const ensureFkInstance = () => {
  if (!fkInstance && fkModal.value) {
    fkInstance = new Modal(fkModal.value);
    fkModal.value.addEventListener("hidden.bs.modal", () => {
      if (returnModal === "editor" && editorInstance) {
        editorInstance.show();
      }
      if (returnModal === "processSearch" && processSearchInstance) {
        processSearchInstance.show();
      }
      if (returnModal === "templateSearch" && templateSearchInstance) {
        templateSearchInstance.show();
      }
      if (returnModal === "documentSearch" && documentSearchInstance) {
        documentSearchInstance.show();
      }
      returnModal = null;
    });
  }
};

const ensureProcessSearchInstance = () => {
  if (!processSearchInstance && processSearchModal.value) {
    processSearchInstance = new Modal(processSearchModal.value);
  }
};

const ensureTemplateSearchInstance = () => {
  if (!templateSearchInstance && templateSearchModal.value) {
    templateSearchInstance = new Modal(templateSearchModal.value);
  }
};

const ensureDocumentSearchInstance = () => {
  if (!documentSearchInstance && documentSearchModal.value) {
    documentSearchInstance = new Modal(documentSearchModal.value);
  }
};

const resetForm = () => {
  const payload = {};
  formFields.value.forEach((field) => {
    if (field.type === "boolean") {
      payload[field.name] = String(field.defaultValue ?? 1);
      return;
    }
    if (field.type === "date") {
      payload[field.name] = "";
      return;
    }
    if (field.type === "datetime") {
      payload[field.name] = "";
      return;
    }
    payload[field.name] = field.defaultValue ?? "";
  });
  formData.value = payload;
};

const buildFormFromRow = (row) => {
  const payload = {};
  const displayPayload = {};
  formFields.value.forEach((field) => {
    let value = row?.[field.name] ?? "";
    if (field.type === "boolean") {
      value = String(Number(value) === 1 ? 1 : 0);
    }
    if (field.type === "date") {
      value = toDateInputValue(value);
    }
    if (field.type === "datetime") {
      value = toDateTimeInputValue(value);
    }
    payload[field.name] = value;
    if (isForeignKeyField(field)) {
      displayPayload[field.name] = value ? String(value) : "";
    }
  });
  formData.value = payload;
  fkDisplay.value = displayPayload;
};

const isFieldLocked = (field) => {
  if (field.readOnly) {
    return true;
  }
  if (
    editorMode.value === "edit" &&
    props.table?.primaryKeys?.includes(field.name) &&
    !props.table?.allowPrimaryKeyUpdate
  ) {
    return true;
  }
  return false;
};

const isInputField = (field) => {
  return ["text", "email", "number", "date", "datetime"].includes(field.type);
};

const inputType = (field) => {
  if (field.type === "datetime") {
    return "datetime-local";
  }
  return field.type || "text";
};

const buildPayload = () => {
  const payload = {};
  editableFields.value.forEach((field) => {
    let value = formData.value[field.name];
    if (value === "") {
      value = null;
    }
    if (field.type === "number") {
      value = value === null ? null : Number(value);
      if (Number.isNaN(value)) {
        value = null;
      }
    }
    if (field.type === "boolean") {
      value = Number(value) === 1 ? 1 : 0;
    }
    payload[field.name] = value;
  });
  return payload;
};

const FK_TABLE_MAP = {
  parent_id: "processes",
  process_id: "processes",
  term_id: "terms",
  unit_id: "units",
  program_id: "programs",
  template_id: "templates",
  document_id: "documents",
  person_id: "persons",
  role_id: "roles",
  permission_id: "permissions",
  cargo_id: "cargos",
  signer_user_id: "persons",
  vacancy_id: "vacancies"
};

const isForeignKeyField = (field) => FK_TABLE_MAP[field.name] !== undefined;

const resolveFkTable = (fieldName) => FK_TABLE_MAP[fieldName] || null;

const resolveDisplayField = (tableMeta) => {
  if (!tableMeta) {
    return null;
  }
  const preferred = ["name", "title", "email", "code", "slug"];
  const match = preferred.find((field) => tableMeta.fields.some((meta) => meta.name === field));
  return match || tableMeta.fields.find((meta) => meta.name !== "id")?.name || "id";
};

const fetchFkRows = async () => {
  if (!fkTable.value) {
    fkRows.value = [];
    return;
  }
  fkLoading.value = true;
  fkError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(fkTable.value.table), {
      params: {
        q: fkSearch.value || undefined,
        limit: 25
      }
    });
    fkRows.value = response.data || [];
  } catch (err) {
    fkError.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
  } finally {
    fkLoading.value = false;
  }
};

const openFkSearch = async (field, onSelect = null) => {
  const tableName = resolveFkTable(field.name);
  if (!tableName) {
    return;
  }
  if (editorInstance && editorModal.value?.classList.contains("show")) {
    editorInstance.hide();
    returnModal = "editor";
  }
  if (processSearchInstance && processSearchModal.value?.classList.contains("show")) {
    processSearchInstance.hide();
    returnModal = "processSearch";
  }
  if (templateSearchInstance && templateSearchModal.value?.classList.contains("show")) {
    templateSearchInstance.hide();
    returnModal = "templateSearch";
  }
  if (documentSearchInstance && documentSearchModal.value?.classList.contains("show")) {
    documentSearchInstance.hide();
    returnModal = "documentSearch";
  }
  fkSetter.value = onSelect;
  fkField.value = field.name;
  fkTable.value = allTablesMap.value[tableName] || null;
  fkSearch.value = "";
  await fetchFkRows();
  ensureFkInstance();
  fkInstance?.show();
};

const selectFkRow = (row) => {
  if (!fkField.value || !row) {
    return;
  }
  if (fkSetter.value) {
    fkSetter.value(row);
    fkSetter.value = null;
  } else {
    formData.value[fkField.value] = row.id ?? row[fkField.value] ?? "";
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    fkDisplay.value = {
      ...fkDisplay.value,
      [fkField.value]: labelValue ? String(labelValue) : ""
    };
  }
  fkInstance?.hide();
};

const debouncedFkSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    fetchFkRows();
  }, 350);
};

const buildKeys = (row) => {
  const keys = {};
  props.table?.primaryKeys?.forEach((key) => {
    keys[key] = row?.[key];
  });
  return keys;
};

const fetchRows = async () => {
  if (!props.table) {
    rows.value = [];
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const filters = {};
    if (props.table?.table === "processes") {
      Object.entries(processFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = value;
        }
      });
    }
    if (props.table?.table === "templates") {
      Object.entries(templateFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = value;
        }
      });
    }
    if (props.table?.table === "documents") {
      Object.entries(documentFilters.value).forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          filters[`filter_${key}`] = value;
        }
      });
    }
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
      params: {
        q: searchTerm.value || undefined,
        limit: 50,
        ...filters
      }
    });
    rows.value = response.data || [];
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudo cargar la informacion.";
  } finally {
    closeDropdown();
    loading.value = false;
  }
};

const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    fetchRows();
  }, 400);
};

const focusSearch = () => {
  searchInput.value?.focus();
};

const handleSearchAction = () => {
  if (props.table?.table === "processes") {
    openProcessSearch();
    return;
  }
  if (props.table?.table === "templates") {
    openTemplateSearch();
    return;
  }
  if (props.table?.table === "documents") {
    openDocumentSearch();
    return;
  }
  focusSearch();
};

const toggleDropdown = (row) => {
  const key = rowKey(row);
  openDropdownId.value = openDropdownId.value === key ? null : key;
};

const closeDropdown = () => {
  openDropdownId.value = null;
};

const handleDocumentClick = () => {
  closeDropdown();
};

const openProcessSearch = () => {
  ensureProcessSearchInstance();
  processSearchInstance?.show();
};

const openTemplateSearch = () => {
  ensureTemplateSearchInstance();
  templateSearchInstance?.show();
};

const openDocumentSearch = () => {
  ensureDocumentSearchInstance();
  documentSearchInstance?.show();
};

const applyProcessFilter = async () => {
  await fetchRows();
  processSearchInstance?.hide();
};

const clearProcessFilter = async () => {
  processFilters.value = {
    unit_id: "",
    program_id: "",
    parent_id: "",
    term_id: "",
    has_document: "",
    is_active: ""
  };
  processFilterLabels.value = {
    unit_id: "",
    program_id: "",
    parent_id: "",
    term_id: ""
  };
  await fetchRows();
};

const applyTemplateFilter = async () => {
  await fetchRows();
  templateSearchInstance?.hide();
};

const clearTemplateFilter = async () => {
  templateFilters.value = {
    name: "",
    slug: "",
    description: "",
    process_id: ""
  };
  templateFilterLabels.value = {
    process_id: ""
  };
  await fetchRows();
};

const applyDocumentFilter = async () => {
  await fetchRows();
  documentSearchInstance?.hide();
};

const clearDocumentFilter = async () => {
  documentFilters.value = {
    process_id: "",
    term_id: "",
    status: ""
  };
  documentFilterLabels.value = {
    process_id: "",
    term_id: ""
  };
  await fetchRows();
};

const openTemplateFkSearch = () => {
  openFkSearch({ name: "process_id" }, (row) => {
    const idValue = row.id ?? "";
    templateFilters.value = {
      ...templateFilters.value,
      process_id: idValue
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    templateFilterLabels.value = {
      process_id: labelValue ? String(labelValue) : ""
    };
  });
};

const openDocumentFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    documentFilters.value = {
      ...documentFilters.value,
      [fieldName]: idValue
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    documentFilterLabels.value = {
      ...documentFilterLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
};

const openProcessFkSearch = (fieldName) => {
  if (!fieldName) {
    return;
  }
  openFkSearch({ name: fieldName }, (row) => {
    const idValue = row.id ?? "";
    processFilters.value = {
      ...processFilters.value,
      [fieldName]: idValue
    };
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    processFilterLabels.value = {
      ...processFilterLabels.value,
      [fieldName]: labelValue ? String(labelValue) : ""
    };
  });
};

const resetTemplateProcessSelection = () => {
  templateProcessId.value = "";
  templateProcessLabel.value = "";
};

const getProcessLabelById = async (processId) => {
  if (!processId) {
    return "";
  }
  const processMeta = allTablesMap.value?.processes;
  const displayField = resolveDisplayField(processMeta);
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("processes"), {
      params: {
        filter_id: processId,
        limit: 1
      }
    });
    const row = response.data?.[0];
    if (!row) {
      return String(processId);
    }
    return String(row[displayField] ?? row.id ?? processId);
  } catch (err) {
    return String(processId);
  }
};

const loadTemplateProcessMapping = async (templateId) => {
  resetTemplateProcessSelection();
  if (!templateId) {
    return;
  }
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_templates"), {
      params: {
        filter_template_id: templateId,
        limit: 1
      }
    });
    const link = response.data?.[0];
    if (!link?.process_id) {
      return;
    }
    templateProcessId.value = link.process_id;
    templateProcessLabel.value = await getProcessLabelById(link.process_id);
  } catch (err) {
    resetTemplateProcessSelection();
  }
};

const openTemplateProcessSearch = () => {
  openFkSearch({ name: "process_id" }, (row) => {
    const idValue = row.id ?? "";
    templateProcessId.value = idValue;
    const displayField = resolveDisplayField(fkTable.value);
    const labelValue = row[displayField] ?? row.id;
    templateProcessLabel.value = labelValue ? String(labelValue) : "";
  });
};

const openCreate = () => {
  if (!props.table) {
    return;
  }
  editorMode.value = "create";
  selectedRow.value = null;
  modalError.value = "";
  resetForm();
  fkDisplay.value = {};
  if (isTemplateTable.value) {
    resetTemplateProcessSelection();
  }
  ensureEditorInstance();
  editorInstance?.show();
};

const openEdit = async (row) => {
  editorMode.value = "edit";
  selectedRow.value = row;
  modalError.value = "";
  buildFormFromRow(row);
  if (isTemplateTable.value) {
    loadTemplateProcessMapping(row?.id);
  }
  ensureEditorInstance();
  editorInstance?.show();
};

const openDelete = (row) => {
  selectedRow.value = row;
  ensureDeleteInstance();
  deleteInstance?.show();
};

const submitForm = async () => {
  if (!props.table) {
    return;
  }
  error.value = "";
  modalError.value = "";
  if (props.table.table === "processes") {
    const unitId = formData.value.unit_id ? Number(formData.value.unit_id) : null;
    const programId = formData.value.program_id ? Number(formData.value.program_id) : null;
    const personId = formData.value.person_id ? Number(formData.value.person_id) : null;
    const termId = formData.value.term_id ? Number(formData.value.term_id) : null;
    if (!unitId && !programId) {
      modalError.value = "Selecciona una unidad o un programa.";
      return;
    }
    if (!personId) {
      modalError.value = "Selecciona un responsable para el proceso.";
      return;
    }
    if (!termId) {
      modalError.value = "Selecciona un periodo para el proceso.";
      return;
    }
  }
  if (isTemplateTable.value) {
    const processId = templateProcessId.value ? Number(templateProcessId.value) : null;
    if (!processId) {
      modalError.value = "Selecciona un proceso para la plantilla.";
      return;
    }
  }
  try {
    const payload = buildPayload();
    if (isTemplateTable.value) {
      payload.process_id = Number(templateProcessId.value);
    }
    if (editorMode.value === "create") {
      await axios.post(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), payload);
    } else {
      const keys = buildKeys(selectedRow.value || {});
      await axios.put(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), {
        keys,
        data: payload
      });
    }
    editorInstance?.hide();
    await fetchRows();
  } catch (err) {
    modalError.value = err?.response?.data?.message || "No se pudo guardar el registro.";
  }
};

const confirmDelete = async () => {
  if (!props.table || !selectedRow.value) {
    return;
  }
  error.value = "";
  try {
    const keys = buildKeys(selectedRow.value);
    await axios.delete(API_ROUTES.ADMIN_SQL_TABLE(props.table.table), { data: { keys } });
    deleteInstance?.hide();
    await fetchRows();
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudo eliminar el registro.";
  }
};

watch(
  () => props.table?.table,
  () => {
    resetForm();
    resetTemplateProcessSelection();
    processFilters.value = {
      unit_id: "",
      program_id: "",
      parent_id: "",
      term_id: "",
      has_document: "",
      is_active: ""
    };
    processFilterLabels.value = {
      unit_id: "",
      program_id: "",
      parent_id: "",
      term_id: ""
    };
    templateFilters.value = {
      name: "",
      slug: "",
      description: "",
      process_id: ""
    };
    templateFilterLabels.value = {
      process_id: ""
    };
    documentFilters.value = {
      process_id: "",
      term_id: "",
      status: ""
    };
    documentFilterLabels.value = {
      process_id: "",
      term_id: ""
    };
    fetchRows();
  },
  { immediate: true }
);

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  document.removeEventListener("click", handleDocumentClick);
});

defineExpose({
  openCreate
});
</script>
