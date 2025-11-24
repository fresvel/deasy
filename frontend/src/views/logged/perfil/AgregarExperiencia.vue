<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Agregar experiencia</h2>
      <p class="text-muted mb-0">Describe la experiencia profesional o docente que deseas registrar.</p>
    </header>

    <form class="row g-4">
      <div class="col-md-4">
        <label class="form-label">Tipo</label>
        <SSelect
          :options="['Docente', 'Profesional']"
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
        <SDate label="Fecha de inicio" v-model="form.fecha_inicio" />
      </div>

      <div class="col-md-4">
        <SDate label="Fecha de fin" v-model="form.fecha_fin" />
      </div>

      <div class="col-md-4">
        <SInput
          label="Duración (meses)"
          type="number"
          min="0"
          v-model="form.duracion"
        />
      </div>

      <div class="col-12">
        <label class="form-label">Funciones, cátedras o actividades</label>
        <textarea
          class="form-control form-control-lg"
          rows="3"
          v-model="form.actividades"
          placeholder="Describe brevemente las responsabilidades o actividades que desempeñaste"
        ></textarea>
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

const form = reactive({
  tipo: "Docente",
  institucion: "",
  institucionPersonalizada: "",
  fecha_inicio: "",
  fecha_fin: "",
  duracion: "",
  actividades: ""
});

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Ministerio de Educación",
  "Escuela Politécnica Nacional",
  "Universidad de las Américas",
  "Empresa privada",
  "Otra"
];

const closeModal = () => {
  const modalElement = document.getElementById("experienciaModal");
  if (!modalElement) return;
  Modal.getInstance(modalElement)?.hide();
};

const resetForm = () => {
  form.tipo = "Docente";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.fecha_inicio = "";
  form.fecha_fin = "";
  form.duracion = "";
  form.actividades = "";
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
        : form.institucion
  };

  console.info("Experiencia registrada:", payload);
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