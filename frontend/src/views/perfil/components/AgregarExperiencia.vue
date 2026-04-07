<template>
  <ProfileModalLayout 
    :title="isEditing ? 'Editar experiencia' : 'Agregar experiencia'" 
    description="Describe la experiencia profesional o docente que deseas registrar." 
    :errorMessage="errorMessage" 
    :isSubmitting="isSubmitting" 
    :submitText="isEditing ? 'Actualizar' : 'Guardar'" 
    @submit="onSubmit" 
    @cancel="onCancel"
  >
    <div class="w-full">
      <label class="profile-field-label">Tipo</label>
      <SSelect
        :options="['Docencia', 'Profesional']"
        v-model="form.tipo"
      />
    </div>

    <div class="w-full space-y-2">
      <label class="profile-field-label">Institución</label>
      <SSelect
        :options="instituciones"
        v-model="form.institucion"
        class="w-full mb-2"
      />
      <input
        v-if="form.institucion === 'Otra'"
        type="text"
        class="profile-text-input"
        placeholder="Especifica la institución"
        v-model="form.institucionPersonalizada"
      />
    </div>

    <div class="w-full">
      <label class="profile-field-label">Modalidad</label>
      <SSelect
        :options="['Presencial', 'Semipresencial', 'Virtual', 'Híbrido']"
        v-model="form.modalidad"
      />
    </div>

    <div class="w-full">
      <SDate label="Fecha de inicio" placeholder="Selecciona la fecha" v-model="form.fecha_inicio" />
    </div>

    <div class="w-full">
      <SDate label="Fecha de fin" placeholder="Selecciona la fecha" v-model="form.fecha_fin" />
    </div>

    <div class="w-full space-y-2">
      <label class="profile-field-label">Funciones, cátedras o actividades</label>
      <textarea
        class="profile-textarea"
        rows="3"
        v-model="form.actividades"
        placeholder="Describe las funciones o cátedras separadas por comas"
      ></textarea>
      <small class="profile-inline-note">Separa múltiples funciones o cátedras con comas</small>
    </div>

    <div class="w-full">
      <PdfDropField
        variant="compact"
        :title="hasExistingDocument ? 'Actualizar documento PDF' : 'Documento PDF (opcional)'"
        action-text="Seleccionar PDF"
        help-text="Máximo 10MB. Solo archivos PDF."
        input-id="experiencia-documento"
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
import ProfileModalLayout from "@/components/AppFormModalLayout.vue";
import { reactive, ref, onMounted, defineEmits, watch, computed } from "vue";
import { Modal } from "@/utils/modalController";
import DossierService from "@/services/dossier/DossierService";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";
import PdfDropField from "@/components/PdfDropField.vue";

const props = defineProps({
  editingItem: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["experiencia-added", "experiencia-updated"]);

const isEditing = computed(() => !!props.editingItem);
const hasExistingDocument = computed(() => !!props.editingItem?.url_documento);

const form = reactive({
  tipo: "Docencia",
  institucion: "",
  institucionPersonalizada: "",
  modalidad: "Presencial",
  fecha_inicio: "",
  fecha_fin: "",
  actividades: ""
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Ministerio de Educación",
  "Escuela Politécnica Nacional",
  "Universidad de las Américas",
  "Empresa privada",
  "Otra"
];

const resetForm = () => {
  form.tipo = "Docencia";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.modalidad = "Presencial";
  form.fecha_inicio = "";
  form.fecha_fin = "";
  form.actividades = "";
  errorMessage.value = "";
  selectedFile.value = null;
};

const closeModal = () => {
  const modalElement = document.getElementById("experienciaModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

// Cargar datos si estamos editando
watch(() => props.editingItem, (newVal) => {
  if (newVal) {
    form.tipo = newVal.tipo || "Docencia";
    
    // Lógica para institución
    if (instituciones.includes(newVal.institucion)) {
      form.institucion = newVal.institucion;
      form.institucionPersonalizada = "";
    } else {
      form.institucion = "Otra";
      form.institucionPersonalizada = newVal.institucion || "";
    }
    
    form.modalidad = newVal.modalidad || "Presencial";
    form.actividades = newVal.funcion_catedra ? newVal.funcion_catedra.join(', ') : "";
    
    // Manejo de fechas para SDate (YYYY-MM-DD)
    if (newVal.fecha_inicio) {
      form.fecha_inicio = new Date(newVal.fecha_inicio).toISOString().split('T')[0];
    } else {
      form.fecha_inicio = "";
    }
    
    if (newVal.fecha_fin) {
      form.fecha_fin = new Date(newVal.fecha_fin).toISOString().split('T')[0];
    } else {
      form.fecha_fin = "";
    }
  } else {
    resetForm();
  }
}, { immediate: true });

const onCancel = () => {
  resetForm();
  closeModal();
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

const buildPayload = () => {
  return {
    tipo: form.tipo,
    institucion: form.institucion === "Otra" 
      ? form.institucionPersonalizada.trim() 
      : form.institucion,
    modalidad: form.modalidad,
    funcion_catedra: form.actividades 
      ? form.actividades.split(',').map(a => a.trim()).filter(a => a) 
      : [],
    fecha_inicio: form.fecha_inicio ? new Date(form.fecha_inicio) : null,
    fecha_fin: form.fecha_fin ? new Date(form.fecha_fin) : null,
    sera: "Enviado"
  };
};

const validate = () => {
  if (!form.institucion) return "Debe indicar la institución.";
  if (form.institucion === 'Otra' && !form.institucionPersonalizada?.trim()) return "Debe especificar la institución.";
  if (!form.fecha_inicio) return "Debe indicar la fecha de inicio.";
  return "";
};

const onSubmit = async () => {
  const error = validate();
  if (error) {
    errorMessage.value = error;
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = "";
    const payload = buildPayload();

    let recordId = null;
    if (isEditing.value) {
      const response = await DossierService.updateExperiencia(props.editingItem._id, payload);
      recordId = props.editingItem._id;
      emit("experiencia-updated", response.data);
    } else {
      const response = await DossierService.createExperiencia(payload);
      // Extraer el ID del nuevo registro (último en el array experiencia)
      const list = response.data?.experiencia || [];
      const newRecord = list[list.length - 1];
      recordId = newRecord?._id;
      emit("experiencia-added", response.data);
    }

    if (selectedFile.value && recordId) {
      await DossierService.uploadExperienciaDocument(recordId, selectedFile.value);
    }

    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar experiencia:", error);
    errorMessage.value = error?.response?.data?.message || "No se pudo guardar la experiencia.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
