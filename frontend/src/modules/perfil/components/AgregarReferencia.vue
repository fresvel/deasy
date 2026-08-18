<template>
  <ProfileModalLayout 
    :title="isEditing ? 'Editar referencia' : 'Agregar referencia'" 
    description="Danos información de una referencia que pueda certificar tu desempeño." 
    :errorMessage="errorMessage" 
    :isSubmitting="isSubmitting" 
    :submitText="isEditing ? 'Actualizar' : 'Guardar'" 
    @submit="onSubmit" 
    @cancel="onCancel"
  >
    <div class="w-full">
      <label :for="fieldId('tipo')" class="deasy-form-label">Tipo de referencia</label>
      <SSelect
        :id="fieldId('tipo')"
        :options="['laboral', 'personal', 'familiar']"
        v-model="form.tipo"
      />
    </div>

    <div class="w-full" v-if="form.tipo === 'laboral'">
      <label :for="fieldId('institution')" class="deasy-form-label">Institución</label>
      <input :id="fieldId('institution')"
        type="text"
        class="deasy-control"
        placeholder="Nombre de la institución o empresa"
        v-model="form.institution"
      />
    </div>

    <div class="w-full">
      <label :for="fieldId('nombre')" class="deasy-form-label">Nombres</label>
      <input :id="fieldId('nombre')"
        type="text"
        class="deasy-control"
        placeholder="Nombres completos"
        v-model="form.nombre"
      />
    </div>

    <div class="w-full">
      <label :for="fieldId('cargo-parentesco')" class="deasy-form-label">{{ form.tipo === 'laboral' ? 'Cargo' : form.tipo === 'familiar' ? 'Parentesco' : 'Cargo/Parentesco' }}</label>
      <input :id="fieldId('cargo-parentesco')"
        type="text"
        class="deasy-control"
        :placeholder="form.tipo === 'laboral' ? 'Cargo en la institución' : form.tipo === 'familiar' ? 'Ej: Padre, Madre, Hermano' : 'Cargo o parentesco'"
        v-model="form.cargo_parentesco"
      />
    </div>

    <div class="w-full">
      <label :for="fieldId('email')" class="deasy-form-label">Correo electrónico</label>
      <input :id="fieldId('email')"
        type="email"
        class="deasy-control"
        placeholder="usuario@dominio.com"
        v-model="form.email"
      />
    </div>

    <div class="w-full">
      <label :for="fieldId('telefono')" class="deasy-form-label">Teléfono</label>
      <input :id="fieldId('telefono')"
        type="text"
        class="deasy-control"
        placeholder="+593987654321"
        v-model="form.telefono"
      />
    </div>

    <div class="w-full">
      <PdfDropField
        variant="compact"
        :title="hasExistingDocument ? 'Actualizar documento PDF' : 'Documento PDF (opcional)'"
        action-text="Seleccionar PDF"
        help-text="Máximo 10MB. Solo archivos PDF."
        input-id="referencia-documento"
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
import PdfDropField from "@/shared/components/forms/PdfDropField.vue";
import SSelect from "@/shared/components/forms/SSelect.vue";


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

const emit = defineEmits(["referencia-added", "referencia-updated", "close"]);

const isEditing = computed(() => !!props.editingItem);
const hasExistingDocument = computed(() => !!props.editingItem?.url_documento);

const form = reactive({
  tipo: "laboral",
  nombre: "",
  cargo_parentesco: "",
  email: "",
  telefono: "",
  institution: ""
});

const isSubmitting = ref(false);
const errorMessage = ref("");
const selectedFile = ref(null);

const resetForm = () => {
  form.tipo = "laboral";
  form.nombre = "";
  form.cargo_parentesco = "";
  form.email = "";
  form.telefono = "";
  form.institution = "";
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
    form.tipo = newVal.tipo || "laboral";
    form.nombre = newVal.nombre || "";
    form.cargo_parentesco = newVal.cargo_parentesco || "";
    form.email = newVal.email || "";
    form.telefono = newVal.telefono || "";
    form.institution = newVal.institution || "";
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

const buildPayload = () => {
  return {
    tipo: form.tipo,
    nombre: form.nombre.trim(),
    email: form.email.trim(),
    telefono: form.telefono.trim(),
    cargo_parentesco: form.cargo_parentesco.trim() || "",
    institution: form.institution.trim() || "",
    sera: "Enviado"
  };
};

const validate = () => {
  if (!form.nombre?.trim()) return "Debe indicar el nombre de la referencia.";
  if (!form.email?.trim()) return "Debe indicar el correo electrónico.";
  // Sin cuantificadores anidados: el patrón anterior sufría backtracking exponencial (ReDoS).
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) return "El correo electrónico no es válido.";
  if (form.tipo !== 'personal' && !form.cargo_parentesco?.trim()) return `Debe indicar ${form.tipo === 'laboral' ? 'el cargo' : 'el parentesco'}.`;
  if (form.tipo === 'laboral' && !form.institution?.trim()) return "Debe indicar la institución para referencias laborales.";
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
      const response = await DossierService.updateReferencia(props.editingItem._id, payload);
      recordId = props.editingItem._id;
      emit("referencia-updated", response.data);
    } else {
      const response = await DossierService.createReferencia(payload);
      recordId = response.createdId ?? null;
      emit("referencia-added", response.data);
    }

    if (selectedFile.value && recordId) {
      await DossierService.uploadReferenciaDocument(recordId, selectedFile.value);
    }

    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar referencia:", error);
    errorMessage.value = error?.response?.data?.message || "No se pudo guardar la referencia.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
