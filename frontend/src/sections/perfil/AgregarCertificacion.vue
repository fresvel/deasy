<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Registrar certificación</h2>
      <p class="text-muted mb-0">Ingresa los datos de la certificación o reconocimiento obtenido.</p>
    </header>

    <div v-if="errorMessage" class="alert alert-danger mb-3" role="alert">
      {{ errorMessage }}
    </div>

    <form class="row g-4" @submit.prevent="onSubmit">
      <div class="col-md-6">
        <label for="cert-tema" class="form-label">Nombre de la certificación</label>
        <textarea
          id="cert-tema"
          class="form-control form-control-lg"
          rows="2"
          v-model="form.titulo"
          placeholder="Ej. Certificación en Gestión de Proyectos"
        ></textarea>
      </div>

      <div class="col-md-6">
        <label class="form-label">Institución emisora</label>
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

      <div class="col-md-4">
        <label class="form-label">Ámbito</label>
        <s-select
          :options="['Nacional', 'Internacional']"
          v-model="form.tipo"
        />
      </div>

      <div class="col-md-4">
        <s-date label="Fecha de emisión" placeholder="Selecciona la fecha" v-model="form.fecha" />
      </div>

      <div class="col-md-4">
        <s-input
          label="Horas o créditos"
          type="number"
          min="0"
          v-model="form.horas"
        />
      </div>

      <div class="col-12">
        <label for="cert-descripcion" class="form-label">Descripción (opcional)</label>
        <textarea
          id="cert-descripcion"
          class="form-control form-control-lg"
          rows="2"
          v-model="form.descripcion"
          placeholder="Información adicional relevante"
        ></textarea>
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
import { API_PREFIX } from "@/services/apiConfig";

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

const currentUser = ref(null);
const isSubmitting = ref(false);
const errorMessage = ref("");

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad Central del Ecuador",
  "Ministerio de Educación",
  "Organización internacional",
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
};

const onCancel = () => {
  resetForm();
  closeModal();
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

    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/certificaciones`;
    await axios.post(url, payload);

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
