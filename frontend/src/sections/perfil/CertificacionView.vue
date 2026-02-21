<template>
  <div class="container-fluid py-4">
    <ProfileSectionShell
      title="Certificaciones y reconocimientos"
      subtitle="Registra los certificados o reconocimientos relevantes para tu carrera."
      @add="openModal"
    >

    <ProfileTableBlock title="Certificaciones registradas">
      <div class="table-responsive table-actions">
        <table class="table table-hover align-middle table-institutional table-striped table-actions">
          <thead >
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
                      <button class="dropdown-item" type="button" @click="editarCertificacion(certificacion)">
                        <font-awesome-icon icon="edit" class="me-2" />
                        Editar
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item text-danger" type="button" @click="openDelete(certificacion)">
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
    </ProfileTableBlock>
    </ProfileSectionShell>

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

    <div
      class="modal fade"
      id="certificacionDeleteModal"
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
            ¿Deseas eliminar la certificación
            <strong>{{ pendingDelete?.titulo || "seleccionada" }}</strong>?
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
import AgregarCertificacion from "./AgregarCertificacion.vue";
import ProfileSectionShell from "@/sections/perfil/ProfileSectionShell.vue";
import ProfileTableBlock from "@/sections/perfil/ProfileTableBlock.vue";
import { API_PREFIX } from "@/services/apiConfig";

const modal = ref(null);
const deleteModal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let bootstrapModal = null;
let deleteInstance = null;
const pendingDelete = ref(null);

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

const openDelete = (certificacion) => {
    pendingDelete.value = certificacion;
    if (!deleteModal.value) return;
    deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
    deleteInstance.show();
};

const handleCertificacionAdded = () => {
    loadDossier();
};

const eliminarCertificacion = async (certificacion) => {
    try {
        const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/certificaciones/${certificacion._id}`;
        await axios.delete(url);
        await loadDossier();
        alert('Certificación eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar certificación:', error);
        alert('Error al eliminar la certificación');
    }
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    await eliminarCertificacion(pendingDelete.value);
    deleteInstance?.hide();
    pendingDelete.value = null;
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
    if (deleteInstance) {
        deleteInstance.hide();
        deleteInstance.dispose();
        deleteInstance = null;
    }
    window.removeEventListener('dossier-updated', loadDossier);
});
</script>

<style scoped lang="scss">
.table thead th {
  color: var(--brand-ink);
  font-weight: 600;
}

</style>
