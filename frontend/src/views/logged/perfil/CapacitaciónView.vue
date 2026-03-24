<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      title="Formación continua y conferencias"
      subtitle="Registra los eventos de capacitación docente y profesional en los que has participado."
      @add="openModal"
    >

    <ProfileTableBlock title="Capacitación en el área docente">
      <div class="table-responsive table-actions">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Tema</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Institución</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Horas</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Inicio</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Fin</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Rol</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!capacitacionesDocentes.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                No has registrado capacitación docente.
              </td>
            </tr>
            <tr v-for="capacitacion in capacitacionesDocentes" :key="capacitacion._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(capacitacion.sera)" /></td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.tema }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.institution }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.horas || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.rol || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">
                <RowActionMenu
                  @edit="editarCapacitacion(capacitacion)"
                  @delete="openDelete(capacitacion)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ProfileTableBlock>

    <ProfileTableBlock title="Capacitación profesional">
      <div class="table-responsive table-actions">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Tema</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Institución</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Horas</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Inicio</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Fin</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Rol</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!capacitacionesProfesionales.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                No has registrado capacitación profesional.
              </td>
            </tr>
            <tr v-for="capacitacion in capacitacionesProfesionales" :key="capacitacion._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(capacitacion.sera)" /></td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.tema }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.institution }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.horas || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.rol || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">
                <RowActionMenu
                  @edit="editarCapacitacion(capacitacion)"
                  @delete="openDelete(capacitacion)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ProfileTableBlock>

    </ProfileSectionShell>


    <div class="modal fade" id="capacitacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-2xl overflow-hidden p-0">
          <AgregarCapacitacion @capacitacion-added="handleCapacitacionAdded" />
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
            <button type="button" class="btn-close" data-modal-dismiss aria-label="Close"></button>
          </div>
          <div class="modal-body">
            ¿Deseas eliminar la capacitación
            <strong>{{ pendingDelete?.tema || "seleccionada" }}</strong>?
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-modal-dismiss>
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
import { Modal } from "@/utils/modalController";
import AgregarCapacitacion from "@/sections/perfil/AgregarCapacitacion.vue";
import BtnSera from "@/components/BtnSera.vue";
import RowActionMenu from "@/components/RowActionMenu.vue";
import { API_PREFIX } from "@/services/apiConfig";
import ProfileSectionShell from "@/sections/perfil/ProfileSectionShell.vue";
import ProfileTableBlock from "@/sections/perfil/ProfileTableBlock.vue";

const modal = ref(null);
const deleteModal = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let modalInstance = null;
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
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
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
    if (modalInstance) {
        modalInstance.hide();
        modalInstance.dispose();
        modalInstance = null;
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
