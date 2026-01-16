<template>
  <div class="container-fluid py-4">
    <div class="profile-section-header">
      <div>
        <h2 class="profile-section-title mb-1">Formación continua y conferencias</h2>
        <p class="profile-section-subtitle">Registra los eventos de capacitación docente y profesional en los que has participado.</p>
      </div>
      <button class="btn btn-primary btn-lg profile-add-btn" @click="openModal">
        <font-awesome-icon icon="plus" class="me-2" />
        Agregar
      </button>
    </div>

    <section class="mb-5">
      <header class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="h5 mb-0">Capacitación en el área docente</h3>
      </header>

      <div class="table-responsive table-actions">
        <table class="table table-hover align-middle table-institutional table-striped table-actions">
          <thead >
            <tr>
              <th width="5%"></th>
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
              <td colspan="8" class="text-center text-muted py-4">
                No has registrado capacitación docente.
              </td>
            </tr>
            <tr v-for="capacitacion in capacitacionesDocentes" :key="capacitacion._id">
              <td><BtnSera :type="getSeraType(capacitacion.sera)" /></td>
              <td>{{ capacitacion.tema }}</td>
              <td>{{ capacitacion.institution }}</td>
              <td>{{ capacitacion.horas || 'N/A' }}</td>
              <td>{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td>{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td>{{ capacitacion.rol || 'N/A' }}</td>
              <td class="text-end">
                <div class="dropdown d-inline-block">
                  <button
                    class="btn btn-outline-primary btn-sm dropdown-toggle"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    aria-label="Acciones"
                    title="Acciones"
                  >
                    <font-awesome-icon icon="ellipsis-vertical" />
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                      <button class="dropdown-item" type="button" @click="editarCapacitacion(capacitacion)">
                        <font-awesome-icon icon="edit" class="me-2" />
                        Editar
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item text-danger" type="button" @click="openDelete(capacitacion)">
                        <font-awesome-icon icon="trash" class="me-2" />
                        Eliminar
                      </button>
                    </li>
                  </ul>
                </div>
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

      <div class="table-responsive table-actions">
        <table class="table table-hover align-middle table-institutional table-striped table-actions">
          <thead >
            <tr>
              <th width="5%"></th>
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
              <td colspan="8" class="text-center text-muted py-4">
                No has registrado capacitación profesional.
              </td>
            </tr>
            <tr v-for="capacitacion in capacitacionesProfesionales" :key="capacitacion._id">
              <td><BtnSera :type="getSeraType(capacitacion.sera)" /></td>
              <td>{{ capacitacion.tema }}</td>
              <td>{{ capacitacion.institution }}</td>
              <td>{{ capacitacion.horas || 'N/A' }}</td>
              <td>{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td>{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td>{{ capacitacion.rol || 'N/A' }}</td>
              <td class="text-end">
                <div class="dropdown d-inline-block">
                  <button
                    class="btn btn-outline-primary btn-sm dropdown-toggle"
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    aria-label="Acciones"
                    title="Acciones"
                  >
                    <font-awesome-icon icon="ellipsis-vertical" />
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end">
                    <li>
                      <button class="dropdown-item" type="button" @click="editarCapacitacion(capacitacion)">
                        <font-awesome-icon icon="edit" class="me-2" />
                        Editar
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item text-danger" type="button" @click="openDelete(capacitacion)">
                        <font-awesome-icon icon="trash" class="me-2" />
                        Eliminar
                      </button>
                    </li>
                  </ul>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="mt-5">
      <LogrosView2 />
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

    <div
      class="modal fade"
      id="capacitacionDeleteModal"
      tabindex="-1"
      ref="deleteModal"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Confirmar eliminación</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            ¿Deseas eliminar la capacitación
            <strong>{{ pendingDelete?.tema || "seleccionada" }}</strong>?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
              Cancelar
            </button>
            <button type="button" class="btn btn-danger" @click="confirmDelete">
              Eliminar
            </button>
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
import AgregarCapacitacion from "@/sections/perfil/AgregarCapacitacion.vue";
import BtnSera from "@/components/BtnSera.vue";
import { API_PREFIX } from "@/services/apiConfig";
import LogrosView2 from "@/sections/academia/LogrosView2.vue";

const modal = ref(null);
const deleteModal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;
let deleteInstance = null;
const pendingDelete = ref(null);

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

const getSeraType = (sera) => {
    if (sera === "Aprobado") return "approved";
    if (sera === "Revisado") return "review";
    return "pending";
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
        
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}`;
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

const openDelete = (capacitacion) => {
    pendingDelete.value = capacitacion;
    if (!deleteModal.value) return;
    deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
    deleteInstance.show();
};

const handleCapacitacionAdded = () => {
    loadDossier();
};

const eliminarCapacitacion = async (capacitacion) => {
    try {
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/formacion/${capacitacion._id}`;
        await axios.delete(url);
        await loadDossier();
        alert('Capacitación eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar capacitación:', error);
        alert('Error al eliminar la capacitación');
    }
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    await eliminarCapacitacion(pendingDelete.value);
    deleteInstance?.hide();
    pendingDelete.value = null;
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
    if (deleteInstance) {
        deleteInstance.hide();
        deleteInstance.dispose();
        deleteInstance = null;
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
