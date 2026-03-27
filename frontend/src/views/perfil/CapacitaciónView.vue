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
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(capacitacion.sera)" @onpress="() => clickBtnsera(capacitacion)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.tema }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.institution }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.horas || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.rol || 'N/A' }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <button v-if="capacitacion.url_documento" @click="openDocument(capacitacion)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(capacitacion._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="openDelete(capacitacion)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
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
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(capacitacion.sera)" @onpress="() => clickBtnsera(capacitacion)"/></td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.tema }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.institution }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.horas || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_inicio) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(capacitacion.fecha_fin) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ capacitacion.rol || 'N/A' }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <button v-if="capacitacion.url_documento" @click="openDocument(capacitacion)" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                    <IconFile :size="16" />
                  </button>
                  <button @click="triggerFileUpload(capacitacion._id)" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                    <IconUpload :size="16" />
                  </button>
                  <button @click="openDelete(capacitacion)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                    <IconTrash :size="16" />
                  </button>
                </div>
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

    <!-- Input file oculto para subir documentos -->
    <input 
      type="file" 
      ref="fileInput" 
      accept="application/pdf" 
      style="display: none" 
      @change="handleFileSelect"
    >
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Modal } from "@/utils/modalController";
import AgregarCapacitacion from "@/views/perfil/components/AgregarCapacitacion.vue";
import BtnSera from "@/components/BtnSera.vue";
import RowActionMenu from "@/components/RowActionMenu.vue";
import DossierService from "@/services/dossier/DossierService";
import { IconFile, IconUpload, IconTrash } from '@tabler/icons-vue';
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";

const modal = ref(null);
const deleteModal = ref(null);
const fileInput = ref(null);
const selectedItemId = ref(null);
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
    if (!sera || sera === 'Enviado') return 'pending';
    if (sera === 'Revisado') return 'reviewed';
    if (sera === 'Aprobado') return 'certified';
    return 'denied';
};

const clickBtnsera = async (capacitacion) => {
    const currentSera = capacitacion.sera || 'Enviado';
    let newSera = '';
    
    if (currentSera === 'Enviado') {
        if (!confirm('¿Solicitar revisión de esta capacitación?')) return;
        newSera = 'Revisado';
    } else if (currentSera === 'Revisado') {
        if (!confirm('¿Solicitar aprobación de esta capacitación?')) return;
        newSera = 'Aprobado';
    } else {
        alert('Esta capacitación ya ha sido procesada');
        return;
    }
    
    try {
        await DossierService.updateFormacionEstado(capacitacion._id, newSera);
        await loadDossier();
        alert(`Estado actualizado a: ${newSera}`);
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        alert('Error al actualizar el estado');
    }
};

// Cargar datos del usuario y su dossier
const loadDossier = async () => {
    try {
        loading.value = true;
        
        const data = await DossierService.getDossier();
        
        if (data.success) {
            dossier.value = data.data;
            currentUser.value = { cedula: DossierService.getCedula() };
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
        await DossierService.deleteCapacitacion(capacitacion._id);
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

const openDocument = async (capacitacion) => {
    try {
        const response = await DossierService.downloadDocument('formacion', capacitacion._id);
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
        console.error('Error al abrir documento:', error);
        alert('Error al abrir el documento');
    }
};

const triggerFileUpload = (itemId) => {
    selectedItemId.value = itemId;
    fileInput.value.click();
};

const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        alert('Solo se permiten archivos PDF');
        event.target.value = '';
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        alert('El archivo no puede superar los 10MB');
        event.target.value = '';
        return;
    }
    
    try {
        const response = await DossierService.uploadCapacitacionDocument(selectedItemId.value, file);
        if (response.success) {
            alert('Documento subido correctamente');
            await loadDossier();
        }
    } catch (error) {
        console.error('Error al subir documento:', error);
        alert('Error al subir el documento');
    }
    
    event.target.value = '';
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
