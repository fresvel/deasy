<template>
<ProfileModalLayout title="Agregar certificación" description="Detalla tus certificaciones o avales obtenidos." :errorMessage="errorMessage" :isSubmitting="isSubmitting" submitText="Guardar" @submit="onSubmit" @cancel="onCancel">
      <div class="w-full">
        <label for="cert-tema" class="form-label">Nombre de la certificación</label>
        <textarea
          id="cert-tema"
          class="form-control "
          rows="2"
          v-model="form.titulo"
          placeholder="Ej. Certificación en Gestión de Proyectos"
        ></textarea>
      </div>

      <div class="w-full">
        <label class="form-label">Institución emisora</label>
        <s-select
          :options="instituciones"
          v-model="form.institucion"
          class="w-full mb-2"
        />
        <input
          v-if="form.institucion === 'Otra'"
          type="text"
          class="form-control "
          placeholder="Especifica la institución"
          v-model="form.institucionPersonalizada"
        />
      </div>

      <div class="w-full">
        <label class="form-label">Ámbito</label>
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

      <div class="w-full">
        <label for="cert-descripcion" class="form-label">Descripción (opcional)</label>
        <textarea
          id="cert-descripcion"
          class="form-control "
          rows="2"
          v-model="form.descripcion"
          placeholder="Información adicional relevante"
        ></textarea>
      </div>

      <div class="w-full">
        <PdfDropField
          variant="compact"
          title="Documento PDF (opcional)"
          action-text="Seleccionar PDF"
          help-text="Máximo 10MB. Solo archivos PDF."
          input-id="certificacion-documento"
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
import SInput from "@/components/SInput.vue";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";
import PdfDropField from "@/components/PdfDropField.vue";

const emit = defineEmits(["certificacion-added"]);

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

onMounted(() => {
});

const closeModal = () => {
  const modalElement = document.getElementById("certificacionModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

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
    await DossierService.uploadCertificacionDocument(registroId, selectedFile.value);
  } catch (error) {
    console.error('Error al subir documento:', error);
    throw error;
  }
};

const buildPayload = () => {
  const payload = {
    titulo: form.titulo.trim(),
    institution: form.institucion === "Otra" 
      ? form.institucionPersonalizada.trim() 
      : form.institucion,
    tipo: form.tipo,
    horas: form.horas ? parseInt(form.horas) : 0,
    sera: "Enviado"
  };

  if (form.fecha) {
    payload.fecha = new Date(form.fecha);
  }

  return payload;
};

const validatePayload = (payload) => {
  if (!payload.titulo || payload.titulo.trim() === '') {
    return "Debe indicar el nombre de la certificación.";
  }
  if (!payload.institution || payload.institution.trim() === '') {
    return "Debe indicar la institución emisora.";
  }
  if (!form.fecha || form.fecha.trim() === '') {
    return "Debe indicar la fecha de emisión.";
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

    const response = await DossierService.createCertificacion(payload);

    const certCreada = response.data?.certificaciones?.slice(-1)[0];

    if (selectedFile.value && certCreada?._id) {
      await DossierService.uploadCertificacionDocument(certCreada._id, selectedFile.value);
    }

    emit("certificacion-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar la certificación:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar la certificación.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.modal-title {
  color: var(--brand-navy);
}

.btn-primary {
  border-radius: 0.75rem;
  padding: 0.6rem 1.8rem;
  font-weight: 600;
  background: var(--brand-gradient);
  border: none;
}

.btn-primary:hover {
  opacity: 0.92;
}
</style>
