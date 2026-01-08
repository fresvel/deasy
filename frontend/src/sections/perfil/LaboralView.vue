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
              <td>{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
              <td>-</td>
              <td>{{ formatDate(experiencia.fecha_inicio) }}</td>
              <td>{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
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
              <td>{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
              <td>-</td>
              <td>{{ formatDate(experiencia.fecha_inicio) }}</td>
              <td>{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
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
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar Experiencia</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <AgregarExperiencia @experiencia-added="handleExperienciaAdded" />
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
import AgregarExperiencia from "./AgregarExperiencia.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";

const modal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;

// Computed properties para agrupar experiencia por tipo
const experienciaDocente = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Docencia');
});

const experienciaProfesional = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Profesional');
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
        
        // Obtener usuario del localStorage
        const userDataString = localStorage.getItem('user');
        if (!userDataString) {
            console.error('No hay usuario logueado');
            return;
        }
        
        currentUser.value = JSON.parse(userDataString);
        console.log('👤 Usuario cargado:', currentUser.value);
        
        // Obtener dossier del backend
        const url = `http://localhost:3000/easym/v1/dossier/${currentUser.value.cedula}`;
        const response = await axios.get(url);
        
        if (response.data.success) {
            dossier.value = response.data.data;
            console.log('📋 Dossier cargado:', dossier.value);
        }
        
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    } finally {
        loading.value = false;
    }
};

const openModal = () => {
    if (!modal.value) {
        return;
    }
    bootstrapModal = Modal.getOrCreateInstance(modal.value);
    bootstrapModal.show();
};

const handleExperienciaAdded = () => {
    loadDossier();
};

// Función para eliminar experiencia
const eliminarExperiencia = async () => {
    if (!confirm('¿Estás seguro de eliminar esta experiencia?')) return;
    
    try {
        // Nota: Necesitaríamos un endpoint DELETE para experiencia
        // Por ahora solo recargamos
        await loadDossier();
        alert('Experiencia eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar experiencia:', error);
        alert('Error al eliminar la experiencia');
    }
};

const editarExperiencia = (experiencia) => {
    console.log('Editar experiencia:', experiencia);
    // TODO: Implementar edición
};

// Cargar datos al montar el componente
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