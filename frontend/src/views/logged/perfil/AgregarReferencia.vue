<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Agregar Referencia</h2>
      <p class="text-muted mb-0">Completa los datos de la persona de referencia.</p>
    </header>

    <div v-if="errorMessage" class="alert alert-danger mb-3" role="alert">
      {{ errorMessage }}
    </div>

    <form class="row g-4" @submit.prevent="onSubmit">
      <div class="col-md-6">
        <label class="form-label">Tipo de referencia</label>
        <SSelect
          :options="['laboral', 'personal', 'familiar']"
          v-model="form.tipo"
        />
      </div>

      <div class="col-md-6" v-if="form.tipo === 'laboral'">
        <label class="form-label">Institución</label>
        <input
          type="text"
          class="form-control form-control-lg"
          placeholder="Nombre de la institución o empresa"
          v-model="form.institution"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">Nombres</label>
        <input
          type="text"
          class="form-control form-control-lg"
          placeholder="Nombres completos"
          v-model="form.nombre"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">{{ form.tipo === 'laboral' ? 'Cargo' : form.tipo === 'familiar' ? 'Parentesco' : 'Cargo/Parentesco' }}</label>
        <input
          type="text"
          class="form-control form-control-lg"
          :placeholder="form.tipo === 'laboral' ? 'Cargo en la institución' : form.tipo === 'familiar' ? 'Ej: Padre, Madre, Hermano' : 'Cargo o parentesco'"
          v-model="form.cargo_parentesco"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">Correo electrónico</label>
        <input
          type="email"
          class="form-control form-control-lg"
          placeholder="usuario@dominio.com"
          v-model="form.email"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">Teléfono</label>
        <input
          type="text"
          class="form-control form-control-lg"
          placeholder="+593987654321"
          v-model="form.telefono"
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
import SSelect from "@/components/semantic/elements/SSelect.vue";

const emit = defineEmits(["referencia-added"]);

const form = reactive({
  tipo: "laboral",
  nombre: "",
  cargo_parentesco: "",
  email: "",
  telefono: "",
  institution: ""
});

const currentUser = ref(null);
const isSubmitting = ref(false);
const errorMessage = ref("");

const API_BASE_URL = "http://localhost:3000";
const API_PREFIX = `${API_BASE_URL}/easym/v1`;

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
};

const onCancel = () => {
  resetForm();
  closeModal();
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

    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/referencias`;
    await axios.post(url, payload);

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

<style scoped>
.modal-title {
  color: #062b57;
}

.form-label {
  font-weight: 600;
  color: #1d3557;
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
