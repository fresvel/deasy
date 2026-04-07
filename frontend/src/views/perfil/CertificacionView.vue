<template>
  <div class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Certificaciones y reconocimientos"
      subtitle="Registra los certificados o reconocimientos relevantes para tu carrera."
      @add="openModal"
    >

    <ProfileTableBlock title="Certificaciones registradas">
      <div class="profile-table-shell">
        <table class="w-full text-sm text-left border-collapse min-w-max">
          <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Certificación</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Institución</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Horas</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Fecha</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Ámbito</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Descripción</th>
              <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!certificaciones.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                No has registrado certificaciones aún.
              </td>
            </tr>
            <tr v-for="certificacion in certificaciones" :key="certificacion._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(certificacion.sera)" /></td>
              <td class="px-4 py-3 text-slate-700">{{ certificacion.titulo }}</td>
              <td class="px-4 py-3 text-slate-700">{{ certificacion.institution }}</td>
              <td class="px-4 py-3 text-slate-700">{{ certificacion.horas || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700">{{ formatDate(certificacion.fecha) }}</td>
              <td class="px-4 py-3 text-slate-700">{{ certificacion.tipo || 'N/A' }}</td>
              <td class="px-4 py-3 text-slate-700 max-w-xs truncate">{{ certificacion.descripcion || 'N/A' }}</td>
              <td class="px-4 py-3">
                <DossierDocumentActions
                  :has-document="Boolean(certificacion.url_documento)"
                  @edit="editarCertificacion(certificacion)"
                  @preview="previewDocument(certificacion)"
                  @download="openDocument(certificacion)"
                  @upload="triggerFileUpload(certificacion._id)"
                  @delete-document="eliminarSoloPDF(certificacion)"
                  @delete="openDelete(certificacion)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="certificacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarCertificacion 
            :editing-item="pendingEdit" 
            @certificacion-added="loadDossier" 
            @certificacion-updated="handleCertificacionUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="certificacionDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" data-modal-dismiss aria-label="Close">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar la certificación
            <strong>{{ pendingDelete?.titulo || "seleccionada" }}</strong>?
          </div>
          <div class="profile-confirm-footer">
            <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
            <AdminButton variant="danger" @click="confirmDelete">Eliminar</AdminButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Input file oculto -->
    <input type="file" ref="fileInput" accept="application/pdf" style="display: none" @change="handleFileSelect">
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Modal } from "@/utils/modalController";
import BtnSera from "@/components/BtnSera.vue";
import AgregarCertificacion from "./components/AgregarCertificacion.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import DossierDocumentActions from "@/views/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/views/perfil/components/DossierPdfPreviewModal.vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import { mapDossierStatusToSeraType } from "@/views/perfil/utils/dossierStatus";
import DossierService from "@/services/dossier/DossierService";

const modal = ref(null);
const deleteModal = ref(null);
const pdfPreviewModal = ref(null);
const fileInput = ref(null);
const selectedItemId = ref(null);
const dossier = ref(null);
const loading = ref(true);
const pendingEdit = ref(null);
const pendingDelete = ref(null);

let modalInstance = null;
let deleteInstance = null;

const certificaciones = computed(() => {
    if (!dossier.value || !dossier.value.certificaciones) return [];
    return dossier.value.certificaciones;
});

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const loadDossier = async () => {
    try {
        loading.value = true;
        const data = await DossierService.getDossier();
        if (data.success) {
            dossier.value = data.data;
        }
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    } finally {
        loading.value = false;
    }
};

const openModal = () => {
    pendingEdit.value = null;
    if (!modal.value) return;
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const editarCertificacion = (certificacion) => {
    pendingEdit.value = { ...certificacion };
    if (!modal.value) return;
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const handleCertificacionUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
};

const openDelete = (certificacion) => {
    pendingDelete.value = certificacion;
    if (!deleteModal.value) return;
    deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
    deleteInstance.show();
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
        await DossierService.deleteCertificacion(pendingDelete.value._id);
        await loadDossier();
        deleteInstance?.hide();
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Error al eliminar');
    }
};

const eliminarSoloPDF = async (certificacion) => {
    if (!confirm('¿Estás seguro de eliminar solo el documento PDF?')) return;
    try {
        await DossierService.deleteDocument("certificacion", certificacion._id);
        await loadDossier();
    } catch (error) {
        console.error('Error al eliminar PDF:', error);
        alert('Error al eliminar el documento');
    }
};

const getDocumentBlob = async (tipoDocumento, registroId) => {
    const response = await DossierService.downloadDocument(tipoDocumento, registroId);
    return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (certificacion) => {
    try {
        const blob = await getDocumentBlob("certificacion", certificacion._id);
        pdfPreviewModal.value?.openFromBlob(blob);
    } catch (error) {
        console.error("Error al previsualizar:", error);
    }
};

const openDocument = async (certificacion) => {
    try {
        const blob = await getDocumentBlob("certificacion", certificacion._id);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${certificacion.titulo || 'certificacion'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
        console.error('Error al descargar:', error);
    }
};

const triggerFileUpload = (itemId) => {
    selectedItemId.value = itemId;
    fileInput.value.click();
};

const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const response = await DossierService.uploadCertificacionDocument(selectedItemId.value, file);
        if (response.success) {
            await loadDossier();
        }
    } catch (error) {
        console.error('Error al subir:', error);
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
    }
    if (deleteInstance) {
        deleteInstance.hide();
        deleteInstance.dispose();
    }
    window.removeEventListener('dossier-updated', loadDossier);
});
</script>
