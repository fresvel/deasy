<template>
  <div class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-start mb-4">
      <div>
        <h2 class="fw-semibold mb-1">Formación continua y conferencias</h2>
        <p class="text-muted mb-0">Registra los eventos de capacitación docente y profesional en los que has participado.</p>
      </div>
      <button class="btn btn-primary btn-lg" @click="openModal">
        <font-awesome-icon icon="plus" class="me-2" />
        Agregar
      </button>
    </div>

    <section class="mb-5">
      <header class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h5 mb-0">Capacitación en el área docente</h3>
      </header>

      <div class="table-responsive">
        <table class="table table-hover align-middle table-institutional table-striped">
          <thead >
            <tr>
              <th scope="col">Tema</th>
              <th scope="col">Institución</th>
              <th scope="col">Horas</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Rol</th>
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
              <td>{{ capacitacion.institution }}</td>
              <td>{{ capacitacion.horas || 'N/A' }}</td>
              <td>{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td>{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td>{{ capacitacion.rol || 'N/A' }}</td>
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
        <table class="table table-hover align-middle table-institutional table-striped">
          <thead >
            <tr>
              <th scope="col">Tema</th>
              <th scope="col">Institución</th>
              <th scope="col">Horas</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Rol</th>
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
              <td>{{ capacitacion.institution }}</td>
              <td>{{ capacitacion.horas || 'N/A' }}</td>
              <td>{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td>{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td>{{ capacitacion.rol || 'N/A' }}</td>
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
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar Capacitación</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <AgregarCapacitacion @capacitacion-added="handleCapacitacionAdded" />
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
import AgregarCapacitacion from "./AgregarCapacitacion.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";

const modal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;

// Computed properties para agrupar capacitaciones por tipo
const capacitacionesDocentes = computed(() => {
    if (!dossier.value || !dossier.value.formacion) return [];
    return dossier.value.formacion.filter(c => c.tipo === 'Docente');
});

const capacitacionesProfesionales = computed(() => {
    if (!dossier.value || !dossier.value.formacion) return [];
    return dossier.value.formacion.filter(c => c.tipo === 'Profesional');
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

const handleCapacitacionAdded = () => {
    loadDossier();
};

const eliminarCapacitacion = async (capacitacion) => {
    if (!confirm('¿Estás seguro de eliminar esta capacitación?')) return;
    
    try {
        const url = `http://localhost:3000/easym/v1/dossier/${currentUser.value.cedula}/formacion/${capacitacion._id}`;
        await axios.delete(url);
        await loadDossier();
        alert('Capacitación eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar capacitación:', error);
        alert('Error al eliminar la capacitación');
    }
};

const editarCapacitacion = (registro) => {
    console.info("Editar capacitación", registro);
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
