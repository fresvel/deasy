<template>
  <div class="modal-body px-2 px-md-3 py-3">
    <header class="mb-4">
      <h2 class="modal-title fw-semibold mb-1">Registrar certificación</h2>
      <p class="text-muted mb-0">Ingresa los datos de la certificación o reconocimiento obtenido.</p>
    </header>

    <form class="row g-4">
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
          v-model="form.ambito"
        />
      </div>

      <div class="col-md-4">
        <s-date label="Fecha de emisión" v-model="form.fecha" />
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
  titulo: "",
  institucion: "",
  institucionPersonalizada: "",
  ambito: "Nacional",
  fecha: "",
  horas: "",
  descripcion: ""
});

const instituciones = [
  "Pontificia Universidad Católica del Ecuador",
  "Escuela Politécnica Nacional",
  "Universidad Central del Ecuador",
  "Ministerio de Educación",
  "Organización internacional",
  "Otra"
];

const closeModal = () => {
  const modalElement = document.getElementById("certificacionModal");
  if (!modalElement) return;
  Modal.getInstance(modalElement)?.hide();
};

const resetForm = () => {
  form.titulo = "";
  form.institucion = "";
  form.institucionPersonalizada = "";
  form.ambito = "Nacional";
  form.fecha = "";
  form.horas = "";
  form.descripcion = "";
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

  console.info("Certificación registrada:", payload);
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