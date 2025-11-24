<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h2 class="fw-semibold mb-1">Formación continua y conferencias</h2>
        <p class="text-muted mb-0">Registra los eventos de capacitación docente y profesional en los que has participado.</p>
      </div>
      <button class="btn btn-primary" @click="openModal">
        <i class="bi bi-plus-circle me-2"></i>Agregar
      </button>
    </div>

    <section class="mb-5">
      <header class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h5 mb-0">Capacitación en el área docente</h3>
      </header>

      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th scope="col">Tema</th>
              <th scope="col">Institución</th>
              <th scope="col">Horas</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Tipo</th>
              <th scope="col" class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!capacitacionesDocentes.length">
              <td colspan="7" class="text-center text-muted py-4">
                No has registrado capacitación docente.
              </td>
            </tr>
            <tr v-for="capacitacion in capacitacionesDocentes" :key="capacitacion._id">
              <td>{{ capacitacion.tema }}</td>
              <td>{{ capacitacion.institucion }}</td>
              <td>{{ capacitacion.horas }}</td>
              <td>{{ capacitacion.fecha_inicio }}</td>
              <td>{{ capacitacion.fecha_fin }}</td>
              <td>{{ capacitacion.tipo }}</td>
              <td class="text-end">
                <BtnEdit @onpress="() => editarCapacitacion(capacitacion)" class="me-2" />
                <BtnDelete @onpress="() => eliminarCapacitacion(capacitacion)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <header class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h5 mb-0">Capacitación profesional</h3>
      </header>

      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th scope="col">Tema</th>
              <th scope="col">Institución</th>
              <th scope="col">Horas</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Tipo</th>
              <th scope="col" class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!capacitacionesProfesionales.length">
              <td colspan="7" class="text-center text-muted py-4">
                No has registrado capacitación profesional.
              </td>
            </tr>
            <tr v-for="capacitacion in capacitacionesProfesionales" :key="capacitacion._id">
              <td>{{ capacitacion.tema }}</td>
              <td>{{ capacitacion.institucion }}</td>
              <td>{{ capacitacion.horas }}</td>
              <td>{{ capacitacion.fecha_inicio }}</td>
              <td>{{ capacitacion.fecha_fin }}</td>
              <td>{{ capacitacion.tipo }}</td>
              <td class="text-end">
                <BtnEdit @onpress="() => editarCapacitacion(capacitacion)" class="me-2" />
                <BtnDelete @onpress="() => eliminarCapacitacion(capacitacion)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="modal fade" id="capacitacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <AgregarCapacitacion />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AgregarCapacitacion from "./AgregarCapacitacion.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";

const capacitacionesDocentes = ref([]);
const capacitacionesProfesionales = ref([]);

const modal = ref(null);

const openModal = () => {
  const modalElement = modal.value;
  if (!modalElement) return;
  const bootstrapModal = new window.bootstrap.Modal(modalElement);
  bootstrapModal.show();
};

onMounted(() => {
  // Aquí se podría cargar la información real desde el backend
});

const editarCapacitacion = (registro) => {
  console.info("Editar capacitación", registro);
};

const eliminarCapacitacion = (registro) => {
  console.info("Eliminar capacitación", registro);
};
</script>

<style scoped>
.table thead th {
  color: #1d3557;
  font-weight: 600;
}
</style>