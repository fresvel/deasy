<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h2 class="fw-semibold mb-1">Experiencia laboral</h2>
        <p class="text-muted mb-0">Consulta y registra tu experiencia docente y profesional.</p>
      </div>
      <button class="btn btn-primary" @click="openModal">
        <i class="bi bi-plus-circle me-2"></i>Agregar
      </button>
    </div>

    <section class="mb-5">
      <header class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h5 mb-0">Experiencia Docente</h3>
      </header>

      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th scope="col">Institución</th>
              <th scope="col">Cátedra / Asignatura</th>
              <th scope="col">Modalidad</th>
              <th scope="col">Desde</th>
              <th scope="col">Hasta</th>
              <th scope="col" class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!experienciaDocente.length">
              <td colspan="6" class="text-center text-muted py-4">
                No has registrado experiencia docente todavía.
              </td>
            </tr>
            <tr v-for="experiencia in experienciaDocente" :key="experiencia._id">
              <td>{{ experiencia.institucion }}</td>
              <td>{{ experiencia.catedra }}</td>
              <td>{{ experiencia.modalidad }}</td>
              <td>{{ experiencia.desde }}</td>
              <td>{{ experiencia.hasta || 'Actualidad' }}</td>
              <td class="text-end">
                <BtnEdit @onpress="() => editarExperiencia(experiencia)" class="me-2" />
                <BtnDelete @onpress="() => eliminarExperiencia(experiencia)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <header class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h5 mb-0">Experiencia profesional</h3>
      </header>

      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th scope="col">Institución</th>
              <th scope="col">Funciones</th>
              <th scope="col">Modalidad</th>
              <th scope="col">Desde</th>
              <th scope="col">Hasta</th>
              <th scope="col" class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!experienciaProfesional.length">
              <td colspan="6" class="text-center text-muted py-4">
                No has registrado experiencia profesional todavía.
              </td>
            </tr>
            <tr v-for="experiencia in experienciaProfesional" :key="experiencia._id">
              <td>{{ experiencia.institucion }}</td>
              <td>{{ experiencia.funciones }}</td>
              <td>{{ experiencia.modalidad }}</td>
              <td>{{ experiencia.desde }}</td>
              <td>{{ experiencia.hasta || 'Actualidad' }}</td>
              <td class="text-end">
                <BtnEdit @onpress="() => editarExperiencia(experiencia)" class="me-2" />
                <BtnDelete @onpress="() => eliminarExperiencia(experiencia)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="modal fade" id="experienciaModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <AgregarExperiencia />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AgregarExperiencia from "./AgregarExperiencia.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";

const experienciaDocente = ref([]);
const experienciaProfesional = ref([]);

const modal = ref(null);

const openModal = () => {
  const modalElement = modal.value;
  if (!modalElement) return;
  const bootstrapModal = new window.bootstrap.Modal(modalElement);
  bootstrapModal.show();
};

onMounted(() => {
  // Aquí se podría cargar la experiencia real desde el backend
});

const editarExperiencia = (experiencia) => {
  console.info("Editar experiencia", experiencia);
};

const eliminarExperiencia = (experiencia) => {
  console.info("Eliminar experiencia", experiencia);
};
</script>

<style scoped>
.table thead th {
  color: #1d3557;
  font-weight: 600;
}
</style>