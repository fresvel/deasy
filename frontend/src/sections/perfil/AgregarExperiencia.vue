<template>
<ProfileModalLayout title="Agregar experiencia" description="Describe la experiencia profesional o docente que deseas registrar." :errorMessage="errorMessage" :isSubmitting="isSubmitting" submitText="Guardar" @submit="onSubmit" @cancel="onCancel">
      <div class="w-full">
        <label class="form-label">Tipo</label>
        <SSelect
          :options="['Docencia', 'Profesional']"
          v-model="form.tipo"
        />
      </div>

      <div class="w-full">
        <label class="form-label">Institución</label>
        <SSelect
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
        <SDate label="Fecha de inicio" placeholder="Selecciona la fecha" v-model="form.fecha_inicio" />
      </div>

      <div class="w-full">
        <SDate label="Fecha de fin" placeholder="Selecciona la fecha" v-model="form.fecha_fin" />
      </div>

      <div class="w-full">
        <label class="form-label">Funciones, cátedras o actividades</label>
        <textarea
          class="form-control "
          rows="3"
          v-model="form.actividades"
          placeholder="Describe las funciones o cátedras separadas por comas"
        ></textarea>
        <small class="text-muted">Separa múltiples funciones o cátedras con comas</small>
      </div>

      <div v-if="errorMessage" class="w-full">
        <div class="alert alert-danger" role="alert">
          {{ errorMessage }}
        </div>
      </div>

      <div class="w-full">
        <label for="documento" class="form-label">Documento PDF (opcional)</label>
        <input
          type="file"
          id="documento"
          ref="fileInput"
          class="form-control"
          accept="application/pdf"
          @change="handleFileSelect"
        />
        <small class="text-muted d-block">Máximo 10MB. Solo archivos PDF.</small>
        <div v-if="selectedFile" class="mt-2">
          <span class="badge bg-success d-inline-flex align-items-center gap-1">
            <IconFile :size="14" />
            {{ selectedFile.name }}
          </span>
          <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" @click="clearFile">
            Eliminar
          </button>
        </div>
      </div>

      </ProfileModalLayout>
</template>

<script setup>
import ProfileModalLayout from "@/components/ProfileModalLayout.vue";
import { reactive, ref, onMounted, defineEmits } from "vue";
import { Modal } from "@/utils/modalController";
import axios from "axios";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";
import { API_PREFIX } from "@/services/apiConfig";
import { IconFile } from '@tabler/icons-vue';

const emit = defineEmits(["experiencia-added"]);

const form = reactive({
  tipo: "Docencia",
  institucion: "",
  institucionPersonalizada: "",
  fecha_inicio: "",
  fecha_fin: "",
  actividades: ""
});

const currentUser = ref(null);
const isSubmitting = ref(false);
const errorMessage = ref("");
const fileInput = ref(null);
const selectedFile = ref(null);

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Ministerio de Educación",
  "Escuela Politécnica Nacional",
  "Universidad de las Américas",
  "Empresa privada",
  "Otra"
];

onMounted(() => {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    try {
      currentUser.value = JSON.parse(storedUser);
    } catch (error) {
      console.error("No se pudo parsear el usuario en localStorage", error);
    }
  }
});

const closeModal = () => {
  const modalElement = document.getElementById("experienciaModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

const resetForm = () => {
  form.tipo = "Docencia";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.fecha_inicio = "";
  form.fecha_fin = "";
  form.actividades = "";
  errorMessage.value = "";
  selectedFile.value = null;
};

const onCancel = () => {
  resetForm();
  closeModal();
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.type !== 'application/pdf') {
    alert('Solo se permiten archivos PDF');
    event.target.value = '';
    selectedFile.value = null;
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo no puede superar los 10MB');
    event.target.value = '';
    selectedFile.value = null;
    return;
  }
  
  selectedFile.value = file;
};

const clearFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const uploadDocument = async (registroId) => {
  if (!selectedFile.value) return;
  
  try {
    const formData = new FormData();
    formData.append('archivo', selectedFile.value);
    
    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/documentos/experiencia/${registroId}`;
    
    await axios.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    throw error;
  }
};

const buildPayload = () => {
  const payload = {
    tipo: form.tipo,
    institucion: form.institucion === "Otra" 
      ? form.institucionPersonalizada.trim() 
      : form.institucion,
    funcion_catedra: form.actividades 
      ? form.actividades.split(',').map(a => a.trim()).filter(a => a) 
      : [],
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
  if (!payload.institucion || payload.institucion.trim() === '') {
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

  if (!currentUser.value?.cedula) {
    errorMessage.value = "No se encontró la información del usuario.";
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

    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/experiencia`;
    const response = await axios.post(url, payload);

    const expCreada = response.data?.data?.experiencia?.slice(-1)[0];

    if (selectedFile.value && expCreada?._id) {
      await uploadDocument(expCreada._id);
    }

    emit("experiencia-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar la experiencia:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar la experiencia.";
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
