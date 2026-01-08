<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h2 class="fw-semibold mb-1">Certificaciones y reconocimientos</h2>
        <p class="text-muted mb-0">Registra los certificados o reconocimientos relevantes para tu carrera.</p>
      </div>
      <button class="btn btn-primary btn-lg" @click="openModal">
        <font-awesome-icon icon="plus" class="me-2" />
        Agregar
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
            <td>{{ certificacion.institution }}</td>
            <td>{{ certificacion.horas || 'N/A' }}</td>
            <td>{{ formatDate(certificacion.fecha) }}</td>
            <td>{{ certificacion.tipo || 'N/A' }}</td>
            <td class="text-end">
              <BtnEdit @onpress="() => editarCertificacion(certificacion)" class="me-2" />
              <BtnDelete @onpress="() => eliminarCertificacion(certificacion)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="modal fade" id="certificacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar Certificación</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <AgregarCertificacion @certificacion-added="handleCertificacionAdded" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import axios from "axios";
import { Modal } from "bootstrap";
import AgregarCertificacion from "./AgregarCertificacion.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";

const modal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;

const certificaciones = computed(() => {
    if (!dossier.value || !dossier.value.certificaciones) return [];
    return dossier.value.certificaciones;
});

// Formatear fecha para mostrar
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Cargar datos del usuario y su dossier
const loadDossier = async () => {
    try {
        loading.value = true;
        
        const userDataString = localStorage.getItem('user');
        if (!userDataString) {
            console.error('No hay usuario logueado');
            return;
        }
        
        currentUser.value = JSON.parse(userDataString);
        
        const url = `http://localhost:3000/easym/v1/dossier/${currentUser.value.cedula}`;
        const response = await axios.get(url);
        
        if (response.data.success) {
            dossier.value = response.data.data;
        }
        
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    } finally {
        loading.value = false;
    }
};

const openModal = () => {
    if (!modal.value) return;
    bootstrapModal = Modal.getOrCreateInstance(modal.value);
    bootstrapModal.show();
};

const handleCertificacionAdded = () => {
    loadDossier();
};

const eliminarCertificacion = async (certificacion) => {
    if (!confirm('¿Estás seguro de eliminar esta certificación?')) return;
    
    try {
        const url = `http://localhost:3000/easym/v1/dossier/${currentUser.value.cedula}/certificaciones/${certificacion._id}`;
        await axios.delete(url);
        await loadDossier();
        alert('Certificación eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar certificación:', error);
        alert('Error al eliminar la certificación');
    }
};

const editarCertificacion = (registro) => {
    console.info("Editar certificación", registro);
};

onMounted(() => {
    loadDossier();
    window.addEventListener('dossier-updated', loadDossier);
});

onBeforeUnmount(() => {
    if (bootstrapModal) {
        bootstrapModal.hide();
        bootstrapModal.dispose();
        bootstrapModal = null;
    }
    window.removeEventListener('dossier-updated', loadDossier);
});
</script>

<style scoped>
.table thead th {
  color: #1d3557;
  font-weight: 600;
}
</style>
