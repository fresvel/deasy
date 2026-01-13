<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Registrar capacitación</h2>
      <p class="text-muted mb-0">Detalla la información principal del evento de formación continua.</p>
    </header>

    <div v-if="errorMessage" class="alert alert-danger mb-3" role="alert">
      {{ errorMessage }}
    </div>

    <form class="row g-4" @submit.prevent="onSubmit">
      <div class="col-md-6">
        <label for="cap-tema" class="form-label">Tema</label>
        <textarea
          id="cap-tema"
          class="form-control form-control-lg"
          rows="2"
          v-model="form.tema"
          placeholder="Nombre del evento o curso"
        ></textarea>
      </div>

      <div class="col-md-6">
        <label class="form-label">Institución</label>
        <s-select
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

      <div class="col-md-6">
        <label class="form-label">Tipo</label>
        <s-select
          :options="['Docente', 'Profesional']"
          v-model="form.tipo"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">Rol</label>
        <s-select
          :options="['Asistencia', 'Instructor', 'Aprobación']"
          v-model="form.rol"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">País</label>
        <s-select
          :options="escountries"
          v-model="form.pais"
        />
      </div>

      <div class="col-md-3">
        <s-date
          label="Inicio"
          placeholder="Selecciona la fecha"
          v-model="form.fecha_inicio"
        />
      </div>

      <div class="col-md-3">
        <s-date
          label="Fin"
          placeholder="Selecciona la fecha"
          v-model="form.fecha_fin"
        />
      </div>

      <div class="col-md-4">
        <s-input
          label="Duración (horas)"
          type="number"
          min="0"
          v-model="form.horas"
        />
      </div>

      <div class="col-12 d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary btn-lg" @click="onCancel" :disabled="isSubmitting">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary btn-lg" :disabled="isSubmitting">
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
import SInput from "@/components/SInput.vue";
import SSelect from "@/components/SSelect.vue";
import SDate from "@/components/SDate.vue";
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

const currentUser = ref(null);
const isSubmitting = ref(false);
const errorMessage = ref("");

const API_BASE_URL = "http://localhost:3000";
const API_PREFIX = `${API_BASE_URL}/easym/v1`;

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad Central del Ecuador",
  "Universidad de las Américas",
  "Universidad San Francisco de Quito",
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
};

const onCancel = () => {
  resetForm();
  closeModal();
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

    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/formacion`;
    await axios.post(url, payload);

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

<style scoped>
.modal-title {
  color: #062b57;
}

.btn-primary {
  border-radius: 0.75rem;
  padding: 0.6rem 1.8rem;
  font-weight: 600;
  background: linear-gradient(90deg, #003267 0%, #2282be 100%);
  border: none;
}

.btn-primary:hover {
  opacity: 0.92;
}
</style>