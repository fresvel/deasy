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
      <label :for="fieldId('titulo')" class="profile-field-label">Nombre de la certificación</label>
      <textarea
        :id="fieldId('titulo')"
        class="profile-textarea"
        rows="2"
        v-model="form.titulo"
        placeholder="Ej. Certificación en Gestión de Proyectos"
      ></textarea>
    </div>

    <div class="w-full space-y-2">
      <label :for="fieldId('institucion')" class="profile-field-label">Institución emisora</label>
      <s-select
        :id="fieldId('institucion')"
        :options="instituciones"
        v-model="form.institucion"
        class="w-full mb-2"
      />
      <input
        v-if="form.institucion === 'Otra'"
        type="text"
        class="profile-text-input"
        aria-label="Especifica la institución"
        placeholder="Especifica la institución"
        v-model="form.institucionPersonalizada"
      />
    </div>

    <div class="w-full">
      <label :for="fieldId('tipo')" class="profile-field-label">Ámbito</label>
      <s-select
        :id="fieldId('tipo')"
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
      <label :for="fieldId('descripcion')" class="profile-field-label">Descripción (opcional)</label>
      <textarea
        :id="fieldId('descripcion')"
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
import ProfileModalLayout from "@/shared/components/forms/AppFormModalLayout.vue";
import { reactive, ref, defineEmits, watch, computed, useId } from "vue";

import DossierService from "@/modules/dossier/services/DossierService";
import SInput from "@/shared/components/forms/SInput.vue";
import SSelect from "@/shared/components/forms/SSelect.vue";
import SDate from "@/shared/components/forms/SDate.vue";
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;

const props = defineProps({
  editingItem: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(["certificacion-added", "certificacion-updated", "close"]);

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

// El cierre se pide al padre, que es quien monta el modal. Antes se hacia
// document.getElementById("<x>Modal") contra un id que declara el padre: acoplamiento invisible
// para el compilador --renombrar ese id dejaba el modal imposible de cerrar y nadie se enteraba--.
const closeModal = () => emit("close");

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
      recordId = response.createdId ?? null;
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
