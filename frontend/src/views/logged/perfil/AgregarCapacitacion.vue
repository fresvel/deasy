<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Registrar capacitación</h2>
      <p class="text-muted mb-0">Detalla la información principal del evento de formación continua.</p>
    </header>

    <form class="row g-4">
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
        <label class="form-label">Enfoque</label>
        <s-select
          :options="enfoques"
          v-model="form.enfoque"
          :multiple="true"
        />
        <small class="text-muted">Puedes seleccionar más de una opción.</small>
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
          v-model="form.fecha_inicio"
        />
      </div>

      <div class="col-md-3">
        <s-date
          label="Fin"
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
        <button type="button" class="btn btn-outline-secondary btn-lg" @click="onCancel">
          Cancelar
        </button>
        <button type="button" class="btn btn-primary btn-lg" @click="onSubmit">
          Guardar
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive } from "vue";
import { Modal } from "bootstrap";
import SInput from "@/components/semantic/elements/SInput.vue";
import SSelect from "@/components/semantic/elements/SSelect.vue";
import SDate from "@/components/semantic/elements/SDate.vue";
import { escountries } from "@/composable/countries";

const form = reactive({
  tema: "",
  institucion: "",
  institucionPersonalizada: "",
  tipo: "Docente",
  enfoque: [],
  pais: "Ecuador",
  fecha_inicio: "",
  fecha_fin: "",
  horas: ""
});

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad Central del Ecuador",
  "Universidad de las Américas",
  "Universidad San Francisco de Quito",
  "Otra"
];

const enfoques = ["Asistencia", "Aprobación", "Instructor"];

const closeModal = () => {
  const modalElement = document.getElementById("capacitacionModal");
  if (!modalElement) return;
  Modal.getInstance(modalElement)?.hide();
};

const resetForm = () => {
  form.tema = "";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.tipo = "Docente";
  form.enfoque = [];
  form.pais = "Ecuador";
  form.fecha_inicio = "";
  form.fecha_fin = "";
  form.horas = "";
};

const onCancel = () => {
  resetForm();
  closeModal();
};

const onSubmit = () => {
  const payload = {
    ...form,
    institucion:
      form.institucion === "Otra"
        ? form.institucionPersonalizada
        : form.institucion,
    enfoque: form.enfoque.join(", ")
  };

  console.info("Capacitación registrada:", payload);
  window.dispatchEvent(new Event('dossier-updated'));
  closeModal();
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