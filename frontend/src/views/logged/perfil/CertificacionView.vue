<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h2 class="fw-semibold mb-1">Certificaciones y reconocimientos</h2>
        <p class="text-muted mb-0">Registra los certificados o reconocimientos relevantes para tu carrera.</p>
      </div>
      <button class="btn btn-primary" @click="openModal">
        <i class="bi bi-plus-circle me-2"></i>Agregar
      </button>
    </div>

    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead class="table-light">
          <tr>
            <th scope="col">Certificación</th>
            <th scope="col">Institución</th>
            <th scope="col">Horas</th>
            <th scope="col">Fecha</th>
            <th scope="col">Ámbito</th>
            <th scope="col" class="text-end">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!certificaciones.length">
            <td colspan="6" class="text-center text-muted py-4">
              No has registrado certificaciones aún.
            </td>
          </tr>
          <tr v-for="certificacion in certificaciones" :key="certificacion._id">
            <td>{{ certificacion.titulo }}</td>
            <td>{{ certificacion.institucion }}</td>
            <td>{{ certificacion.horas }}</td>
            <td>{{ certificacion.fecha }}</td>
            <td>{{ certificacion.ambito }}</td>
            <td class="text-end">
              <BtnEdit @onpress="() => editarCertificacion(certificacion)" class="me-2" />
              <BtnDelete @onpress="() => eliminarCertificacion(certificacion)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal fade" id="certificacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <AgregarCertificacion />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import AgregarCertificacion from "./AgregarCertificacion.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";

const certificaciones = ref([]);
const modal = ref(null);

const openModal = () => {
  const modalElement = modal.value;
  if (!modalElement) return;
  const bootstrapModal = new window.bootstrap.Modal(modalElement);
  bootstrapModal.show();
};

onMounted(() => {
  // Aquí se puede cargar la información real desde el backend
});

const editarCertificacion = (registro) => {
  console.info("Editar certificación", registro);
};

const eliminarCertificacion = (registro) => {
  console.info("Eliminar certificación", registro);
};
</script>

<style scoped>
.table thead th {
  color: #1d3557;
  font-weight: 600;
}
</style>