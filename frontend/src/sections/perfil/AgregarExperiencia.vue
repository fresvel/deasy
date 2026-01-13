<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Agregar experiencia</h2>
      <p class="text-muted mb-0">Describe la experiencia profesional o docente que deseas registrar.</p>
    </header>

    <form class="row g-4" @submit.prevent="onSubmit">
      <div class="col-md-4">
        <label class="form-label">Tipo</label>
        <SSelect
          :options="['Docencia', 'Profesional']"
          v-model="form.tipo"
        />
      </div>

      <div class="col-md-8">
        <label class="form-label">Institución</label>
        <SSelect
          :options="instituciones"
          v-model="form.institucion"
          class="w-100 mb-2"
        />
        <input
          v-if="form.institucion === 'Otra'"
          type="text"
          class="form-control form-control-lg"
          placeholder="Especifica la institución"
          v-model="form.institucionPersonalizada"
        />
      </div>

      <div class="col-md-4">
        <SDate label="Fecha de inicio" placeholder="Selecciona la fecha" v-model="form.fecha_inicio" />
      </div>

      <div class="col-md-4">
        <SDate label="Fecha de fin" placeholder="Selecciona la fecha" v-model="form.fecha_fin" />
      </div>

      <div class="col-12">
        <label class="form-label">Funciones, cátedras o actividades</label>
        <textarea
          class="form-control form-control-lg"
          rows="3"
          v-model="form.actividades"
          placeholder="Describe las funciones o cátedras separadas por comas"
        ></textarea>
        <small class="text-muted">Separa múltiples funciones o cátedras con comas</small>
      </div>

      <div v-if="errorMessage" class="col-12">
        <div class="alert alert-danger" role="alert">
          {{ errorMessage }}
        </div>
      </div>

      <div class="col-12 d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary btn-lg" @click="onCancel" :disabled="isSubmitting">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary btn-lg" @click="onSubmit" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {{ isSubmitting ? "Guardando..." : "Guardar" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, defineEmits } from "vue";
import { Modal } from "bootstrap";
import axios from "axios";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";

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

const API_BASE_URL = "http://localhost:3000";
const API_PREFIX = `${API_BASE_URL}/easym/v1`;

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
};

const onCancel = () => {
  resetForm();
  closeModal();
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
    await axios.post(url, payload);

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
