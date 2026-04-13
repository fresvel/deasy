<template>
  <ProfileModalLayout 
    :title="isEditing ? 'Editar capacitación' : 'Agregar capacitación'" 
    description="Registra eventos o cursos de formación continua." 
    :errorMessage="errorMessage" 
    :isSubmitting="isSubmitting" 
    :submitText="isEditing ? 'Actualizar' : 'Guardar'" 
    @submit="onSubmit" 
    @cancel="onCancel"
  >
    <div class="w-full space-y-2">
      <label for="cap-tema" class="profile-field-label">Tema</label>
      <textarea
        id="cap-tema"
        class="profile-textarea"
        rows="2"
        v-model="form.tema"
        placeholder="Nombre del evento o curso"
      ></textarea>
    </div>

    <div class="w-full space-y-2">
      <label class="profile-field-label">Institución</label>
      <s-select
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
      <label class="profile-field-label">Tipo</label>
      <s-select
        :options="['Docente', 'Profesional']"
        v-model="form.tipo"
      />
    </div>

    <div class="w-full">
      <label class="profile-field-label">Rol</label>
      <s-select
        :options="['Asistencia', 'Instructor', 'Aprobación']"
        v-model="form.rol"
      />
    </div>

    <div class="w-full">
      <label class="profile-field-label">País</label>
      <s-select
        :options="escountries"
        v-model="form.pais"
      />
    </div>

    <div class="w-full">
      <s-date
        label="Inicio"
        placeholder="Selecciona la fecha"
        v-model="form.fecha_inicio"
      />
    </div>

    <div class="w-full">
      <s-date
        label="Fin"
        placeholder="Selecciona la fecha"
        v-model="form.fecha_fin"
      />
    </div>

    <div class="w-full">
      <s-input
        label="Duración (horas)"
        type="number"
        min="0"
        v-model="form.horas"
      />
    </div>

    <div class="w-full">
      <PdfDropField
        variant="compact"
        :title="hasExistingDocument ? 'Actualizar documento PDF' : 'Documento PDF (opcional)'"
        action-text="Seleccionar PDF"
        help-text="Máximo 10MB. Solo archivos PDF."
        input-id="capacitacion-documento"
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
import SInput from "@/shared/components/forms/SInput.vue";
import SSelect from "@/shared/components/forms/SSelect.vue";
import SDate from "@/shared/components/forms/SDate.vue";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";
import { escountries } from "@/core/constants/countries";

const props = defineProps({
  editingItem: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["capacitacion-added", "capacitacion-updated"]);

const isEditing = computed(() => !!props.editingItem);
const hasExistingDocument = computed(() => !!props.editingItem?.url_documento);

const form = reactive({
  tema: "",
  institucion: "",
  institucionPersonalizada: "",
  tipo: "Docente",
  rol: "Asistencia",
  pais: "Ecuador",
  fecha_inicio: "",
  fecha_fin: "",
  horas: ""
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad Central del Ecuador",
  "Universidad de las Américas",
  "Universidad San Francisco de Quito",
  "Otra"
];

const resetForm = () => {
  form.tema = "";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.tipo = "Docente";
  form.rol = "Asistencia";
  form.pais = "Ecuador";
  form.fecha_inicio = "";
  form.fecha_fin = "";
  form.horas = "";
  errorMessage.value = "";
  selectedFile.value = null;
};

const closeModal = () => {
  const modalElement = document.getElementById("capacitacionModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

// Cargar datos si estamos editando
watch(() => props.editingItem, (newVal) => {
  if (newVal) {
    form.tema = newVal.tema || "";
    
    // Lógica para institución
    if (instituciones.includes(newVal.institution)) {
      form.institucion = newVal.institution;
      form.institucionPersonalizada = "";
    } else {
      form.institucion = "Otra";
      form.institucionPersonalizada = newVal.institution || "";
    }
    
    form.tipo = newVal.tipo || "Docente";
    form.rol = newVal.rol || "Asistencia";
    form.pais = newVal.pais || "Ecuador";
    form.horas = newVal.horas || "";
    
    // Manejo de fechas para el componente SDate (YYYY-MM-DD)
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
    tema: form.tema.trim(),
    institution: form.institucion === "Otra" 
      ? form.institucionPersonalizada.trim() 
      : form.institucion,
    tipo: form.tipo,
    rol: form.rol,
    pais: form.pais || "Ecuador",
    horas: form.horas ? parseInt(form.horas) : 0,
    fecha_inicio: form.fecha_inicio ? new Date(form.fecha_inicio) : null,
    fecha_fin: form.fecha_fin ? new Date(form.fecha_fin) : null,
    sera: "Enviado"
  };
};

const validate = () => {
  if (!form.tema?.trim()) return "Debe indicar el tema de la capacitación.";
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
      const response = await DossierService.updateCapacitacion(props.editingItem._id, payload);
      recordId = props.editingItem._id;
      emit("capacitacion-updated", response.data);
    } else {
      const response = await DossierService.createCapacitacion(payload);
      // Extraer el ID del nuevo registro (último en el array formacion)
      const list = response.data?.formacion || [];
      const newRecord = list[list.length - 1];
      recordId = newRecord?._id;
      emit("capacitacion-added", response.data);
    }

    if (selectedFile.value && recordId) {
      await DossierService.uploadCapacitacionDocument(recordId, selectedFile.value);
    }

    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar capacitación:", error);
    errorMessage.value = error?.response?.data?.message || "No se pudo guardar la capacitación.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
