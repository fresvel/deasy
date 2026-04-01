<template>
<ProfileModalLayout title="Agregar referencia" description="Danos información de una referencia que pueda certificar tu desempeño." :errorMessage="errorMessage" :isSubmitting="isSubmitting" submitText="Guardar" @submit="onSubmit" @cancel="onCancel">
      <div class="w-full">
        <label class="profile-field-label">Tipo de referencia</label>
        <SSelect
          :options="['laboral', 'personal', 'familiar']"
          v-model="form.tipo"
        />
      </div>

      <div class="w-full space-y-2" v-if="form.tipo === 'laboral'">
        <label class="profile-field-label">Institución</label>
        <input
          type="text"
          class="profile-text-input"
          placeholder="Nombre de la institución o empresa"
          v-model="form.institution"
        />
      </div>

      <div class="w-full space-y-2">
        <label class="profile-field-label">Nombres</label>
        <input
          type="text"
          class="profile-text-input"
          placeholder="Nombres completos"
          v-model="form.nombre"
        />
      </div>

      <div class="w-full space-y-2">
        <label class="profile-field-label">{{ form.tipo === 'laboral' ? 'Cargo' : form.tipo === 'familiar' ? 'Parentesco' : 'Cargo/Parentesco' }}</label>
        <input
          type="text"
          class="profile-text-input"
          :placeholder="form.tipo === 'laboral' ? 'Cargo en la institución' : form.tipo === 'familiar' ? 'Ej: Padre, Madre, Hermano' : 'Cargo o parentesco'"
          v-model="form.cargo_parentesco"
        />
      </div>

      <div class="w-full space-y-2">
        <label class="profile-field-label">Correo electrónico</label>
        <input
          type="email"
          class="profile-text-input"
          placeholder="usuario@dominio.com"
          v-model="form.email"
        />
      </div>

      <div class="w-full space-y-2">
        <label class="profile-field-label">Teléfono</label>
        <input
          type="text"
          class="profile-text-input"
          placeholder="+593987654321"
          v-model="form.telefono"
        />
      </div>

      <div class="w-full">
        <PdfDropField
          variant="compact"
          title="Documento PDF (opcional)"
          action-text="Seleccionar PDF"
          help-text="Máximo 10MB. Solo archivos PDF."
          input-id="referencia-documento"
          :selected-file="selectedFile"
          @files-selected="handleFileSelect"
          @clear="clearFile"
        />
      </div>

      </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/components/AppFormModalLayout.vue";
import { reactive, ref, onMounted, defineEmits } from "vue";
import { Modal } from "@/utils/modalController";
import DossierService from "@/services/dossier/DossierService";
import PdfDropField from "@/components/PdfDropField.vue";
import SSelect from "@/components/SSelect.vue";

const emit = defineEmits(["referencia-added"]);

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

onMounted(() => {
});

const closeModal = () => {
  const modalElement = document.getElementById("referenciaModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

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

const uploadDocument = async (registroId) => {
  if (!selectedFile.value) return;
  
  try {
    await DossierService.uploadReferenciaDocument(registroId, selectedFile.value);
  } catch (error) {
    console.error('Error al subir documento:', error);
    throw error;
  }
};

const buildPayload = () => {
  const payload = {
    tipo: form.tipo,
    nombre: form.nombre.trim(),
    email: form.email.trim(),
    telefono: form.telefono.trim(),
    cargo_parentesco: form.cargo_parentesco.trim() || "",
    institution: form.institution.trim() || ""
  };

  return payload;
};

const validatePayload = (payload) => {
  if (!payload.nombre || payload.nombre.trim() === '') {
    return "Debe indicar el nombre de la referencia.";
  }
  if (!payload.email || payload.email.trim() === '') {
    return "Debe indicar el correo electrónico.";
  }
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(payload.email)) {
    return "El correo electrónico no es válido.";
  }
  if (payload.tipo !== 'personal' && (!payload.cargo_parentesco || payload.cargo_parentesco.trim() === '')) {
    return `Debe indicar ${payload.tipo === 'laboral' ? 'el cargo' : 'el parentesco'}.`;
  }
  if (payload.tipo === 'laboral' && (!payload.institution || payload.institution.trim() === '')) {
    return "Debe indicar la institución para referencias laborales.";
  }
  return "";
};

const onSubmit = async () => {
  if (isSubmitting.value) {
    return;
  }

  const payload = buildPayload();
  const validationError = validatePayload(payload);
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  try {
    isSubmitting.value = true;
    errorMessage.value = "";

    const response = await DossierService.createReferencia(payload);

    const refCreada = response.data?.referencias?.slice(-1)[0];

    if (selectedFile.value && refCreada?._id) {
      await DossierService.uploadReferenciaDocument(refCreada._id, selectedFile.value);
    }

    emit("referencia-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar la referencia:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar la referencia.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
