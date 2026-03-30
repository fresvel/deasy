<template>
<ProfileModalLayout title="Agregar investigación" description="Registra tus proyectos de investigación formales." :errorMessage="errorMessage" :isSubmitting="isSubmitting" submitText="Guardar" @submit="onSubmit" @cancel="onCancel">
      <div class="w-full space-y-2">
        <label class="profile-field-label">Tipo de producción</label>
        <select v-model="form.tipoProduccion" class="profile-select-input">
          <option v-for="option in tipoOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

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

      <template v-if="form.tipoProduccion === 'tesis'">
        <div class="w-full">
          <label class="profile-field-label">Institución</label>
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
          <input v-model="form.programa_grupo" type="text" class="profile-text-input" />
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

      <div class="w-full">
        <PdfDropField
          variant="compact"
          title="Documento PDF (opcional)"
          action-text="Seleccionar PDF"
          help-text="Máximo 10MB. Solo archivos PDF."
          input-id="investigacion-documento"
          :selected-file="selectedFile"
          @files-selected="handleFileSelect"
          @clear="clearFile"
        />
      </div>

      </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/components/ProfileModalLayout.vue";
import { reactive, ref, onMounted, defineEmits } from "vue";
import { Modal } from "@/utils/modalController";
import DossierService from "@/services/dossier/DossierService";
import PdfDropField from "@/components/PdfDropField.vue";

const emit = defineEmits(["investigacion-added"]);

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
  programa_grupo: "",
  pais: "Ecuador"
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

onMounted(() => {
});

const closeModal = () => {
  const modalElement = document.getElementById("investigacionModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

const resetForm = () => {
  form.tipoProduccion = "articulos";
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
  form.programa_grupo = "";
  form.pais = "Ecuador";
  errorMessage.value = "";
  selectedFile.value = null;
};

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
    selectedFile.value = null;
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo no puede superar los 10MB');
    selectedFile.value = null;
    return;
  }
  
  selectedFile.value = file;
};

const clearFile = () => {
  selectedFile.value = null;
};

const uploadDocument = async (registroId) => {
  if (!selectedFile.value) return;
  
  try {
    const tipoDocumento = getDocumentType();
    await DossierService.uploadInvestigacionDocument(tipoDocumento, registroId, selectedFile.value);
  } catch (error) {
    console.error('Error al subir documento:', error);
    throw error;
  }
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
        programa_grupo: form.programa_grupo.trim() || undefined
      };
    default:
      return { ...common };
  }
};

const validatePayload = (payload) => {
  if (form.tipoProduccion === "articulos") {
    if (!payload.titulo) return "El título del artículo es obligatorio.";
    if (!payload.revista) return "La revista es obligatoria.";
    return "";
  }
  if (form.tipoProduccion === "libros") {
    if (!payload.titulo) return "El título del libro/capítulo es obligatorio.";
    if (!payload.editorial) return "La editorial es obligatoria.";
    return "";
  }
  if (form.tipoProduccion === "ponencias") {
    if (!payload.titulo) return "El título de la ponencia es obligatorio.";
    if (!payload.evento) return "El evento es obligatorio.";
    return "";
  }
  if (form.tipoProduccion === "tesis") {
    if (!payload.tema) return "El tema de la tesis es obligatorio.";
    if (!payload.ies) return "La institución es obligatoria.";
    return "";
  }
  if (form.tipoProduccion === "proyectos") {
    if (!payload.tema) return "El tema del proyecto es obligatorio.";
    if (!payload.institucion) return "La institución es obligatoria.";
    return "";
  }
  return "";
};

const onSubmit = async () => {
  if (isSubmitting.value) return;

  const payload = buildPayload();
  const validationError = validatePayload(payload);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = "";

    const response = await DossierService.createInvestigacion(form.tipoProduccion, payload);

    const investigacionField = form.tipoProduccion;
    const investigacionData = response.data?.investigacion;
    const items = investigacionData?.[investigacionField] || [];
    const itemCreado = items.slice(-1)[0];

    if (selectedFile.value && itemCreado?._id) {
      await uploadDocument(itemCreado._id);
    }

    emit("investigacion-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar investigación:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar el registro de investigación.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
