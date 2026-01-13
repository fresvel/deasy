<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Agregar título académico</h2>
      <p class="text-muted mb-0">Completa los campos con los datos oficiales del título registrado.</p>
    </header>

    <div v-if="errorMessage" class="alert alert-danger" role="alert">
      {{ errorMessage }}
    </div>

    <form class="row g-4" @submit.prevent="onSubmit">
      <div class="col-md-6">
        <label class="form-label">Título</label>
        <s-select
          :options="carreras"
          v-model="form.titulo"
          class="w-100 mb-2"
        />
        <input
          v-if="form.titulo === 'Otro'"
          type="text"
          class="form-control form-control-lg"
          placeholder="Especifique el título"
          v-model="form.tituloPersonalizado"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label">Institución</label>
        <s-select
          :options="universidades"
          v-model="form.ies"
          class="w-100 mb-2"
        />
        <input
          v-if="form.ies === 'Otra'"
          type="text"
          class="form-control form-control-lg"
          placeholder="Especifique la institución"
          v-model="form.iesPersonalizada"
        />
      </div>

      <div class="col-md-6">
        <label for="pais" class="form-label">País de emisión</label>
        <s-select
          id="pais"
          :options="escountries"
          v-model="form.pais"
          class="w-100"
        />
      </div>

      <div class="col-md-6">
        <label for="registro" class="form-label">Número de registro</label>
        <s-input
          id="registro"
          v-model="form.sreg"
          placeholder="Registro SENESCYT"
        />
      </div>

      <div class="col-md-6">
        <label for="tipo" class="form-label">Modalidad</label>
        <s-select
          id="tipo"
          :options="modalidades"
          v-model="form.tipo"
          class="w-100"
        />
      </div>

      <div class="col-md-6">
        <label for="nivel" class="form-label">Nivel</label>
        <s-select
          id="nivel"
          :options="niveles"
          v-model="form.nivel"
          class="w-100"
        />
      </div>

      <div class="col-12">
        <label for="campo" class="form-label">Campo de conocimiento</label>
        <textarea
          id="campo"
          v-model="form.campo_amplio"
          class="form-control form-control-lg"
          rows="2"
          placeholder="Ej. Ingeniería, Ciencias Sociales, Educación..."
        ></textarea>
      </div>

      <div class="col-12 d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary btn-lg" @click="onCancel" :disabled="isSubmitting">
          Cancelar
        </button>
        <button type="submit" class="btn btn-primary btn-lg" :disabled="isSubmitting">
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {{ isSubmitting ? "Guardando..." : "Guardar título" }}
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
import { escountries } from "@/composable/countries";

const emit = defineEmits(["close-modal", "title-added"]);

const form = reactive({
  titulo: "",
  tituloPersonalizado: "",
  ies: "",
  iesPersonalizada: "",
  pais: "Ecuador",
  sreg: "",
  tipo: "Presencial",
  nivel: "Grado",
  campo_amplio: ""
});

const carreras = [
  "Administración de Empresas",
  "Arquitectura",
  "Contabilidad y Auditoría",
  "Derecho",
  "Educación Básica",
  "Enfermería",
  "Ingeniería Civil",
  "Ingeniería Industrial",
  "Ingeniería en Sistemas",
  "Medicina",
  "Psicología",
  "Turismo",
  "Otro"
];

const universidades = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad de Guayaquil",
  "Universidad Central del Ecuador",
  "Escuela Superior Politécnica del Litoral",
  "Universidad San Francisco de Quito",
  "Universidad Técnica Particular de Loja",
  "Universidad de las Américas",
  "Universidad de Cuenca",
  "Otra"
];

const modalidades = ["Presencial", "Semipresencial", "Virtual", "Híbrido"];
const niveles = [
  "Técnico",
  "Tecnólogo",
  "Grado",
  "Maestría",
  "Maestría Tecnológica",
  "Diplomado",
  "Doctorado",
  "Posdoctorado"
];

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
  const modalElement = document.getElementById("tituloModal");
  if (!modalElement) return;
  const modalInstance = Modal.getInstance(modalElement);
  modalInstance?.hide();
};

const resetForm = () => {
  form.titulo = "";
  form.tituloPersonalizado = "";
  form.ies = "";
  form.iesPersonalizada = "";
  form.pais = "Ecuador";
  form.sreg = "";
  form.tipo = "Presencial";
  form.nivel = "Grado";
  form.campo_amplio = "";
  errorMessage.value = "";
};

const onCancel = () => {
  resetForm();
  closeModal();
  emit("close-modal");
};

const buildPayload = () => ({
  titulo: form.titulo === "Otro" ? form.tituloPersonalizado.trim() : form.titulo,
  ies: form.ies === "Otra" ? form.iesPersonalizada.trim() : form.ies,
  pais: form.pais,
  sreg: form.sreg,
  tipo: form.tipo,
  nivel: form.nivel,
  campo_amplio: form.campo_amplio
});

const validatePayload = (payload) => {
  if (!payload.titulo) {
    return "Debe indicar el título obtenido.";
  }
  if (!payload.ies) {
    return "Debe indicar la institución.";
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

    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/titulos`;
    await axios.post(url, payload);

    emit("title-added", payload);
    window.dispatchEvent(new Event("dossier-updated"));
    resetForm();
    closeModal();
  } catch (error) {
    console.error("Error al guardar el título:", error);
    errorMessage.value =
      error?.response?.data?.message || "No se pudo guardar el título.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.modal-title {
  color: var(--brand-navy);
}

.form-label {
  font-weight: 600;
  color: var(--brand-ink);
}

.form-control,
.form-select,
.form-control:focus {
  border-radius: var(--radius-md);
  color: var(--brand-navy);
}

.form-control:focus,
.form-select:focus {
  box-shadow: 0 0 0 0.2rem rgba(var(--brand-accent-rgb), 0.25);
  border-color: var(--brand-accent);
  color: var(--brand-navy);
}

.form-select option {
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

.btn-outline-secondary {
  border-radius: 0.75rem;
  padding: 0.6rem 1.5rem;
}
</style>
