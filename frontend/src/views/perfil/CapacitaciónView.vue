<template>
  <div class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Formación continua y conferencias"
      subtitle="Registra los eventos de capacitación docente y profesional en los que has participado."
      @add="openModal"
    >

    <ProfileTableBlock title="Capacitación en el área docente">
      <div class="profile-table-shell">
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
              <td class="px-4 py-3">
                <DossierDocumentActions
                  :has-document="Boolean(capacitacion.url_documento)"
                  @preview="previewDocument(capacitacion)"
                  @download="openDocument(capacitacion)"
                  @upload="triggerFileUpload(capacitacion._id)"
                  @delete="openDelete(capacitacion)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ProfileTableBlock>

    <ProfileTableBlock title="Capacitación profesional">
      <div class="profile-table-shell">
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
              <td class="px-4 py-3">
                <DossierDocumentActions
                  :has-document="Boolean(capacitacion.url_documento)"
                  @preview="previewDocument(capacitacion)"
                  @download="openDocument(capacitacion)"
                  @upload="triggerFileUpload(capacitacion._id)"
                  @delete="openDelete(capacitacion)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ProfileTableBlock>

    </ProfileSectionShell>


    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="capacitacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarCapacitacion @capacitacion-added="handleCapacitacionAdded" />
        </div>
      </div>
    </div>

    <div
      class="profile-admin-skin profile-dialog-root"
      data-dialog-root
      id="capacitacionDeleteModal"
      tabindex="-1"
      ref="deleteModal"
      aria-hidden="true"
    >
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <AppButton type="button" variant="close" class-name="absolute right-4 top-4 z-10" data-modal-dismiss aria-label="Close">
              <span class="text-xl leading-none">&times;</span>
            </AppButton>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar la capacitación
            <strong>{{ pendingDelete?.tema || "seleccionada" }}</strong>?
          </div>
          <div class="profile-confirm-footer">
            <AppButton variant="cancel" data-modal-dismiss>Cancelar</AppButton>
            <AppButton variant="danger" @click="confirmDelete">Eliminar</AppButton>
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
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Modal } from "@/utils/modalController";
import AgregarCapacitacion from "@/views/perfil/components/AgregarCapacitacion.vue";
import BtnSera from "@/components/BtnSera.vue";
import RowActionMenu from "@/components/RowActionMenu.vue";
import DossierService from "@/services/dossier/DossierService";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import DossierDocumentActions from "@/views/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/views/perfil/components/DossierPdfPreviewModal.vue";
import AppButton from "@/components/AppButton.vue";
import { mapDossierStatusToSeraType } from "@/views/perfil/utils/dossierStatus";

const modal = ref(null);
const deleteModal = ref(null);
const fileInput = ref(null);
const pdfPreviewModal = ref(null);
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

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

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

const getDocumentBlob = async (tipoDocumento, registroId) => {
    const response = await DossierService.downloadDocument(tipoDocumento, registroId);
    return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (capacitacion) => {
    try {
        const blob = await getDocumentBlob("formacion", capacitacion._id);
        pdfPreviewModal.value?.openFromBlob(blob);
    } catch (error) {
        console.error("Error al previsualizar documento:", error);
        alert("Error al visualizar el documento");
    }
};

const openDocument = async (capacitacion) => {
    try {
        const blob = await getDocumentBlob("formacion", capacitacion._id);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${capacitacion.tema || 'capacitacion'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
