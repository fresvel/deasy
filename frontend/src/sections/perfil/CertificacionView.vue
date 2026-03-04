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
                      <button class="dropdown-item hope-dropdown-edit" type="button" @click="editarCertificacion(certificacion)">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          class="me-2"
                          aria-hidden="true"
                        >
                          <path
                            d="M11.4925 2.78906H7.75349C4.67849 2.78906 2.75049 4.96606 2.75049 8.04806V16.3621C2.75049 19.4441 4.66949 21.6211 7.75349 21.6211H16.5775C19.6625 21.6211 21.5815 19.4441 21.5815 16.3621V12.3341"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M8.82812 10.921L16.3011 3.44799C17.2321 2.51799 18.7411 2.51799 19.6721 3.44799L20.8891 4.66499C21.8201 5.59599 21.8201 7.10599 20.8891 8.03599L13.3801 15.545C12.9731 15.952 12.4211 16.181 11.8451 16.181H8.09912L8.19312 12.401C8.20712 11.845 8.43412 11.315 8.82812 10.921Z"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path
                            d="M15.1655 4.60254L19.7315 9.16854"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                        Editar
                      </button>
                    </li>
                    <li>
                      <button class="dropdown-item hope-dropdown-delete" type="button" @click="openDelete(certificacion)">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          class="me-2"
                          aria-hidden="true"
                        >
                          <path
                            d="M19.3248 9.46826C19.3248 9.46826 18.7818 16.2033 18.4668 19.0403C18.3168 20.3953 17.4798 21.1893 16.1088 21.2143C13.4998 21.2613 10.8878 21.2643 8.27979 21.2093C6.96079 21.1823 6.13779 20.3783 5.99079 19.0473C5.67379 16.1853 5.13379 9.46826 5.13379 9.46826"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path
                            d="M20.708 6.23975H3.75"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                          <path
                            d="M17.4406 6.23973C16.6556 6.23973 15.9796 5.68473 15.8256 4.91573L15.5826 3.69973C15.4326 3.13873 14.9246 2.75073 14.3456 2.75073H10.1126C9.53358 2.75073 9.02558 3.13873 8.87558 3.69973L8.63258 4.91573C8.47858 5.68473 7.80258 6.23973 7.01758 6.23973"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
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
