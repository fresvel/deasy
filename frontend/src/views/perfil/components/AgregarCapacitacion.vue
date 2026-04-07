<template>
<ProfileModalLayout title="Agregar capacitación" description="Registra eventos o cursos de formación continua." :errorMessage="errorMessage" :isSubmitting="isSubmitting" submitText="Guardar" @submit="onSubmit" @cancel="onCancel">
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
          title="Documento PDF (opcional)"
          action-text="Seleccionar PDF"
          help-text="Máximo 10MB. Solo archivos PDF."
          input-id="capacitacion-documento"
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
import SInput from "@/components/SInput.vue";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";
import PdfDropField from "@/components/firmas/PdfDropField.vue";
import { escountries } from "@/composable/countries";

const emit = defineEmits(["capacitacion-added"]);

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

onMounted(() => {
});

const closeModal = () => {
  const modalElement = document.getElementById("capacitacionModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

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
    await DossierService.uploadCapacitacionDocument(registroId, selectedFile.value);
  } catch (error) {
    console.error('Error al subir documento:', error);
    throw error;
  }
};

const buildPayload = () => {
  const payload = {
    tema: form.tema.trim(),
    institution: form.institucion === "Otra" 
      ? form.institucionPersonalizada.trim() 
      : form.institucion,
    tipo: form.tipo,
    rol: form.rol,
    pais: form.pais || "Ecuador",
    horas: form.horas ? parseInt(form.horas) : 0,
    sera: "Enviado"
  };

  if (form.fecha_inicio) {
    payload.fecha_inicio = new Date(form.fecha_inicio);
  }
  
  if (form.fecha_fin) {
    payload.fecha_fin = new Date(form.fecha_fin);
  }

  return payload;
};

const validatePayload = (payload) => {
  if (!payload.tema || payload.tema.trim() === '') {
    return "Debe indicar el tema de la capacitación.";
  }
  if (!payload.institution || payload.institution.trim() === '') {
    return "Debe indicar la institución.";
  }
  if (!form.fecha_inicio || form.fecha_inicio.trim() === '') {
    return "Debe indicar la fecha de inicio.";
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

    const response = await DossierService.createCapacitacion(payload);

    const capCreada = response.data?.formacion?.slice(-1)[0];

    if (selectedFile.value && capCreada?._id) {
      await DossierService.uploadCapacitacionDocument(capCreada._id, selectedFile.value);
    }

    emit("capacitacion-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar la capacitación:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar la capacitación.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>
