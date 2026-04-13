<template>
  <ProfileModalLayout 
    :title="isEditing ? 'Editar investigación' : 'Agregar investigación'" 
    description="Registra tus productos de investigación, artículos, libros y proyectos." 
    :errorMessage="errorMessage" 
    :isSubmitting="isSubmitting" 
    :submitText="isEditing ? 'Actualizar' : 'Guardar'" 
    @submit="onSubmit" 
    @cancel="onCancel"
  >
    <div class="w-full space-y-2">
      <label class="profile-field-label">Tipo de producción</label>
      <select v-model="form.tipoProduccion" class="profile-select-input" :disabled="isEditing">
        <option v-for="option in tipoOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <small v-if="isEditing" class="profile-inline-note">El tipo de producción no se puede cambiar al editar.</small>
    </div>

    <!-- Artículos -->
    <template v-if="form.tipoProduccion === 'articulos'">
      <div class="w-full">
        <label class="profile-field-label">Título</label>
        <input v-model="form.titulo" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Revista</label>
        <input v-model="form.revista" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Base indexada</label>
        <input v-model="form.base_indexada" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">DOI</label>
        <input v-model="form.doi" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">ISSN</label>
        <input v-model="form.issn" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">SJR</label>
        <input v-model="form.sjr" type="number" step="0.01" min="0" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Estado</label>
        <select v-model="form.estado" class="profile-select-input">
          <option value="Aceptado">Aceptado</option>
          <option value="Publicado">Publicado</option>
        </select>
      </div>
      <div class="w-full">
        <label class="profile-field-label">Rol</label>
        <select v-model="form.rolArticulo" class="profile-select-input">
          <option value="Autor">Autor</option>
          <option value="Coautor">Coautor</option>
          <option value="Revisor">Revisor</option>
        </select>
      </div>
      <div class="w-full">
        <label class="profile-field-label">Fecha</label>
        <input v-model="form.fecha" type="date" class="profile-text-input" />
      </div>
    </template>

    <!-- Libros y Capítulos -->
    <template v-if="form.tipoProduccion === 'libros'">
      <div class="w-full">
        <label class="profile-field-label">Título</label>
        <input v-model="form.titulo" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Editorial</label>
        <input v-model="form.editorial" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">ISBN</label>
        <input v-model="form.isbn" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">ISNN</label>
        <input v-model="form.isnn" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Año</label>
        <input v-model="form.anio" type="number" min="1900" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Tipo</label>
        <select v-model="form.tipoLibro" class="profile-select-input">
          <option value="Libro">Libro</option>
          <option value="Capítulo">Capítulo</option>
        </select>
      </div>
    </template>

    <!-- Ponencias -->
    <template v-if="form.tipoProduccion === 'ponencias'">
      <div class="w-full">
        <label class="profile-field-label">Título</label>
        <input v-model="form.titulo" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Evento</label>
        <input v-model="form.evento" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Año</label>
        <input v-model="form.anio" type="number" min="1900" class="profile-text-input" />
      </div>
    </template>

    <!-- Tesis -->
    <template v-if="form.tipoProduccion === 'tesis'">
      <div class="w-full">
        <label class="profile-field-label">Institución (IES)</label>
        <input v-model="form.ies" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Tema</label>
        <input v-model="form.tema" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Programa</label>
        <input v-model="form.programa" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Nivel</label>
        <select v-model="form.nivel" class="profile-select-input">
          <option v-for="nivel in nivelOptions" :key="nivel" :value="nivel">
            {{ nivel }}
          </option>
        </select>
      </div>
      <div class="w-full">
        <label class="profile-field-label">Año</label>
        <input v-model="form.anio" type="number" min="1900" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Rol</label>
        <select v-model="form.rolTesis" class="profile-select-input">
          <option value="Revisor">Revisor</option>
          <option value="Asesor">Asesor</option>
        </select>
      </div>
    </template>

    <!-- Proyectos -->
    <template v-if="form.tipoProduccion === 'proyectos'">
      <div class="w-full">
        <label class="profile-field-label">Tema</label>
        <input v-model="form.tema" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Institución</label>
        <input v-model="form.institucion" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Tipo</label>
        <select v-model="form.tipoProyecto" class="profile-select-input">
          <option value="Investigación">Investigación</option>
          <option value="Vinculación">Vinculación</option>
        </select>
      </div>
      <div class="w-full">
        <label class="profile-field-label">Programa / grupo</label>
        <input v-model="form.programa_group" type="text" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Avance (%)</label>
        <input v-model="form.avance" type="number" min="0" max="100" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Inicio</label>
        <input v-model="form.inicio" type="date" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Fin</label>
        <input v-model="form.fin" type="date" class="profile-text-input" />
      </div>
      <div class="w-full">
        <label class="profile-field-label">Presupuesto</label>
        <input v-model="form.presupuesto" type="number" min="0" class="profile-text-input" />
      </div>
    </template>

    <div class="w-full space-y-2">
      <label class="profile-field-label">País</label>
      <input v-model="form.pais" type="text" class="profile-text-input" />
    </div>

    <!-- Gestión de Documentos -->
    <div class="w-full">
      <PdfDropField
        variant="compact"
        :title="hasExistingDocument ? 'Actualizar documento PDF' : 'Documento PDF (opcional)'"
        action-text="Seleccionar PDF"
        help-text="Máximo 10MB. Solo archivos PDF."
        input-id="investigacion-documento"
        :selected-file="selectedFile"
        @files-selected="handleFileSelect"
        @clear="clearFile"
      />
      <div v-if="hasExistingDocument && !selectedFile" class="mt-2 p-2 theme-info-panel flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs font-medium">Ya existe un documento cargado</span>
      </div>
    </div>

  </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/shared/components/forms/AppFormModalLayout.vue";
import { reactive, ref, onMounted, defineEmits, watch, computed } from "vue";
import { Modal } from "@/shared/utils/modalController";
import DossierService from "@/modules/dossier/services/DossierService";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";

const props = defineProps({
  editingItem: {
    type: Object,
    default: null
  },
  initialType: {
    type: String,
    default: "articulos"
  }
});

const emit = defineEmits(["investigacion-added", "investigacion-updated"]);

const isEditing = computed(() => !!props.editingItem);
const hasExistingDocument = computed(() => !!props.editingItem?.url_documento);

const tipoOptions = [
  { value: "articulos", label: "Artículo" },
  { value: "libros", label: "Libro o capítulo" },
  { value: "ponencias", label: "Ponencia" },
  { value: "tesis", label: "Dirección/Revisión de tesis" },
  { value: "proyectos", label: "Proyecto" }
];

const nivelOptions = [
  "Técnico",
  "Tecnólogo",
  "Grado",
  "Maestría",
  "Diplomado",
  "Doctorado",
  "Posdoctorado"
];

const form = reactive({
  tipoProduccion: "articulos",
  titulo: "",
  base_indexada: "",
  revista: "",
  doi: "",
  issn: "",
  sjr: "",
  fecha: "",
  estado: "Aceptado",
  rolArticulo: "Autor",
  editorial: "",
  isbn: "",
  isnn: "",
  anio: "",
  tipoLibro: "Libro",
  evento: "",
  ies: "",
  tema: "",
  programa: "",
  nivel: "Grado",
  rolTesis: "Asesor",
  institucion: "",
  inicio: "",
  fin: "",
  avance: "",
  presupuesto: "",
  tipoProyecto: "Investigación",
  programa_group: "",
  pais: "Ecuador"
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

const closeModal = () => {
  const modalElement = document.getElementById("investigacionModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

const resetForm = () => {
  form.titulo = "";
  form.base_indexada = "";
  form.revista = "";
  form.doi = "";
  form.issn = "";
  form.sjr = "";
  form.fecha = "";
  form.estado = "Aceptado";
  form.rolArticulo = "Autor";
  form.editorial = "";
  form.isbn = "";
  form.isnn = "";
  form.anio = "";
  form.tipoLibro = "Libro";
  form.evento = "";
  form.ies = "";
  form.tema = "";
  form.programa = "";
  form.nivel = "Grado";
  form.rolTesis = "Asesor";
  form.institucion = "";
  form.inicio = "";
  form.fin = "";
  form.avance = "";
  form.presupuesto = "";
  form.tipoProyecto = "Investigación";
  form.programa_group = "";
  form.pais = "Ecuador";
  errorMessage.value = "";
  selectedFile.value = null;
};

// Cargar datos si estamos editando
watch(() => props.editingItem, (newVal) => {
  if (newVal) {
    form.tipoProduccion = props.initialType || "articulos";
    form.pais = newVal.pais || "Ecuador";
    
    // Cargar campos específicos según tipo
    if (form.tipoProduccion === 'articulos') {
      form.titulo = newVal.titulo || "";
      form.base_indexada = newVal.base_indexada || "";
      form.revista = newVal.revista || "";
      form.doi = newVal.doi || "";
      form.issn = newVal.issn || "";
      form.sjr = newVal.sjr || "";
      form.estado = newVal.estado || "Aceptado";
      form.rolArticulo = newVal.rol || "Autor";
      if (newVal.fecha) form.fecha = new Date(newVal.fecha).toISOString().split('T')[0];
    } else if (form.tipoProduccion === 'libros') {
      form.titulo = newVal.titulo || "";
      form.editorial = newVal.editorial || "";
      form.isbn = newVal.isbn || "";
      form.isnn = newVal.isnn || "";
      form.anio = newVal.año || "";
      form.tipoLibro = newVal.tipo || "Libro";
    } else if (form.tipoProduccion === 'ponencias') {
      form.titulo = newVal.titulo || "";
      form.evento = newVal.evento || "";
      form.anio = newVal.año || "";
    } else if (form.tipoProduccion === 'tesis') {
      form.ies = newVal.ies || "";
      form.tema = newVal.tema || "";
      form.programa = newVal.programa || "";
      form.nivel = newVal.nivel || "Grado";
      form.anio = newVal.año || "";
      form.rolTesis = newVal.rol || "Asesor";
    } else if (form.tipoProduccion === 'proyectos') {
      form.tema = newVal.tema || "";
      form.institucion = newVal.institucion || "";
      form.tipoProyecto = newVal.tipo || "Investigación";
      form.programa_group = newVal.programa_group || "";
      form.avance = newVal.avance || "";
      form.presupuesto = newVal.presupuesto || "";
      if (newVal.inicio) form.inicio = new Date(newVal.inicio).toISOString().split('T')[0];
      if (newVal.fin) form.fin = new Date(newVal.fin).toISOString().split('T')[0];
    }
  } else {
    resetForm();
    form.tipoProduccion = props.initialType || "articulos";
  }
}, { immediate: true });

const onCancel = () => {
  resetForm();
  closeModal();
};

const getDocumentType = () => {
  const typeMap = {
    'articulos': 'articulo',
    'libros': 'libro',
    'ponencias': 'ponencia',
    'tesis': 'tesis',
    'proyectos': 'proyecto'
  };
  return typeMap[form.tipoProduccion] || form.tipoProduccion;
};

const handleFileSelect = (files) => {
  const file = files?.[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Solo se permiten archivos PDF');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo no puede superar los 10MB');
    return;
  }
  selectedFile.value = file;
};

const clearFile = () => {
  selectedFile.value = null;
};

const parseOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

const buildPayload = () => {
  const common = {
    pais: (form.pais || "Ecuador").trim(),
    sera: "Enviado"
  };

  switch (form.tipoProduccion) {
    case "articulos":
      return {
        ...common,
        titulo: form.titulo.trim(),
        base_indexada: form.base_indexada.trim() || undefined,
        revista: form.revista.trim(),
        doi: form.doi.trim() || undefined,
        issn: form.issn.trim() || undefined,
        sjr: parseOptionalNumber(form.sjr),
        estado: form.estado,
        rol: form.rolArticulo,
        fecha: form.fecha ? new Date(form.fecha) : undefined
      };
    case "libros":
      return {
        ...common,
        titulo: form.titulo.trim(),
        editorial: form.editorial.trim(),
        isbn: form.isbn.trim() || undefined,
        isnn: form.isnn.trim() || undefined,
        año: parseOptionalNumber(form.anio),
        tipo: form.tipoLibro
      };
    case "ponencias":
      return {
        ...common,
        titulo: form.titulo.trim(),
        evento: form.evento.trim(),
        año: parseOptionalNumber(form.anio)
      };
    case "tesis":
      return {
        ...common,
        ies: form.ies.trim(),
        tema: form.tema.trim(),
        programa: form.programa.trim() || undefined,
        nivel: form.nivel,
        año: parseOptionalNumber(form.anio),
        rol: form.rolTesis
      };
    case "proyectos":
      return {
        ...common,
        tema: form.tema.trim(),
        institucion: form.institucion.trim(),
        inicio: form.inicio ? new Date(form.inicio) : undefined,
        fin: form.fin ? new Date(form.fin) : undefined,
        avance: parseOptionalNumber(form.avance),
        presupuesto: parseOptionalNumber(form.presupuesto),
        tipo: form.tipoProyecto,
        programa_group: form.programa_group.trim() || undefined
      };
    default:
      return { ...common };
  }
};

const validatePayload = (payload) => {
  if (form.tipoProduccion === "articulos") {
    if (!payload.titulo) return "El título del artículo es obligatorio.";
    if (!payload.revista) return "La revista es obligatoria.";
  } else if (form.tipoProduccion === "libros") {
    if (!payload.titulo) return "El título del libro/capítulo es obligatorio.";
    if (!payload.editorial) return "La editorial es obligatoria.";
  } else if (form.tipoProduccion === "ponencias") {
    if (!payload.titulo) return "El título de la ponencia es obligatorio.";
    if (!payload.evento) return "El evento es obligatorio.";
  } else if (form.tipoProduccion === "tesis") {
    if (!payload.tema) return "El tema de la tesis es obligatorio.";
    if (!payload.ies) return "La institución es obligatoria.";
  } else if (form.tipoProduccion === "proyectos") {
    if (!payload.tema) return "El tema del proyecto es obligatorio.";
    if (!payload.institucion) return "La institución es obligatoria.";
  }
  return "";
};

const onSubmit = async () => {
  const payload = buildPayload();
  const error = validatePayload(payload);
  if (error) {
    errorMessage.value = error;
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = "";

    let recordId = null;
    if (isEditing.value) {
      const response = await DossierService.updateInvestigacion(form.tipoProduccion, props.editingItem._id, payload);
      recordId = props.editingItem._id;
      emit("investigacion-updated", response.data);
    } else {
      const response = await DossierService.createInvestigacion(form.tipoProduccion, payload);
      const items = response.data?.investigacion?.[form.tipoProduccion] || [];
      recordId = items[items.length - 1]?._id;
      emit("investigacion-added", response.data);
    }

    if (selectedFile.value && recordId) {
      const tipoDocumento = getDocumentType();
      await DossierService.uploadInvestigacionDocument(tipoDocumento, recordId, selectedFile.value);
    }

    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar investigación:", error);
    errorMessage.value = error?.response?.data?.message || "No se pudo guardar el registro.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
