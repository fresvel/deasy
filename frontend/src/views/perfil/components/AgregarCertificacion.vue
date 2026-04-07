<template>
  <ProfileModalLayout 
    :title="isEditing ? 'Editar certificación' : 'Agregar certificación'" 
    description="Detalla tus certificaciones o avales obtenidos." 
    :errorMessage="errorMessage" 
    :isSubmitting="isSubmitting" 
    :submitText="isEditing ? 'Actualizar' : 'Guardar'" 
    @submit="onSubmit" 
    @cancel="onCancel"
  >
    <div class="w-full space-y-2">
      <label for="cert-tema" class="profile-field-label">Nombre de la certificación</label>
      <textarea
        id="cert-tema"
        class="profile-textarea"
        rows="2"
        v-model="form.titulo"
        placeholder="Ej. Certificación en Gestión de Proyectos"
      ></textarea>
    </div>

    <div class="w-full space-y-2">
      <label class="profile-field-label">Institución emisora</label>
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
      <label class="profile-field-label">Ámbito</label>
      <s-select
        :options="['Nacional', 'Internacional']"
        v-model="form.tipo"
      />
    </div>

    <div class="w-full">
      <s-date label="Fecha de emisión" placeholder="Selecciona la fecha" v-model="form.fecha" />
    </div>

    <div class="w-full">
      <s-input
        label="Horas o créditos"
        type="number"
        min="0"
        v-model="form.horas"
      />
    </div>

    <div class="w-full space-y-2">
      <label for="cert-descripcion" class="profile-field-label">Descripción (opcional)</label>
      <textarea
        id="cert-descripcion"
        class="profile-textarea"
        rows="2"
        v-model="form.descripcion"
        placeholder="Información adicional relevante"
      ></textarea>
    </div>

    <div class="w-full">
      <PdfDropField
        variant="compact"
        :title="hasExistingDocument ? 'Actualizar documento PDF' : 'Documento PDF (opcional)'"
        action-text="Seleccionar PDF"
        help-text="Máximo 10MB. Solo archivos PDF."
        input-id="certificacion-documento"
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
import SInput from "@/components/SInput.vue";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";
import PdfDropField from "@/components/PdfDropField.vue";

const props = defineProps({
  editingItem: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["certificacion-added", "certificacion-updated"]);

const isEditing = computed(() => !!props.editingItem);
const hasExistingDocument = computed(() => !!props.editingItem?.url_documento);

const form = reactive({
  titulo: "",
  institucion: "",
  institucionPersonalizada: "",
  tipo: "Nacional",
  fecha: "",
  horas: "",
  descripcion: ""
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad Central del Ecuador",
  "Ministerio de Educación",
  "Organización internacional",
  "Otra"
];

const resetForm = () => {
  form.titulo = "";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.tipo = "Nacional";
  form.fecha = "";
  form.horas = "";
  form.descripcion = "";
  errorMessage.value = "";
  selectedFile.value = null;
};

const closeModal = () => {
  const modalElement = document.getElementById("certificacionModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

// Cargar datos si estamos editando
watch(() => props.editingItem, (newVal) => {
  if (newVal) {
    form.titulo = newVal.titulo || "";
    
    // Lógica para institución
    if (instituciones.includes(newVal.institution)) {
      form.institucion = newVal.institution;
      form.institucionPersonalizada = "";
    } else {
      form.institucion = "Otra";
      form.institucionPersonalizada = newVal.institution || "";
    }
    
    form.tipo = newVal.tipo || "Nacional";
    form.horas = newVal.horas || "";
    form.descripcion = newVal.descripcion || "";
    
    // Manejo de fecha para SDate (YYYY-MM-DD)
    if (newVal.fecha) {
      form.fecha = new Date(newVal.fecha).toISOString().split('T')[0];
    } else {
      form.fecha = "";
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
    titulo: form.titulo.trim(),
    institution: form.institucion === "Otra" 
      ? form.institucionPersonalizada.trim() 
      : form.institucion,
    tipo: form.tipo,
    horas: form.horas ? parseInt(form.horas) : 0,
    fecha: form.fecha ? new Date(form.fecha) : null,
    descripcion: form.descripcion.trim(),
    sera: "Enviado"
  };
};

const validate = () => {
  if (!form.titulo?.trim()) return "Debe indicar el nombre de la certificación.";
  if (!form.institucion) return "Debe indicar la institución emisora.";
  if (form.institucion === 'Otra' && !form.institucionPersonalizada?.trim()) return "Debe especificar la institución.";
  if (!form.fecha) return "Debe indicar la fecha de emisión.";
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
      const response = await DossierService.updateCertificacion(props.editingItem._id, payload);
      recordId = props.editingItem._id;
      emit("certificacion-updated", response.data);
    } else {
      const response = await DossierService.createCertificacion(payload);
      // Extraer el ID del nuevo registro (último en el array certificaciones)
      const list = response.data?.certificaciones || [];
      const newRecord = list[list.length - 1];
      recordId = newRecord?._id;
      emit("certificacion-added", response.data);
    }

    if (selectedFile.value && recordId) {
      await DossierService.uploadCertificacionDocument(recordId, selectedFile.value);
    }

    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar certificación:", error);
    errorMessage.value = error?.response?.data?.message || "No se pudo guardar la certificación.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
