<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openModal"
    >
      <AppDataTable
        :fields="tableFields"
        :rows="tableRows"
        :row-key="(row) => row._id"
        empty-text="No hay registros."
        actions-label="ACCIÓN"
      >
        <template #cell="{ row, field }">
          <BtnSera v-if="field.name === 'sera'" :type="getSeraType(row.sera)" />
          <span v-else-if="field.name === 'horas'">{{ row.horas || '—' }}</span>
          <span v-else-if="field.name === 'fecha'">{{ formatDate(row.fecha) }}</span>
          <span v-else-if="field.name === 'tipo'">{{ row.tipo || '—' }}</span>
          <span v-else-if="field.name === 'descripcion'" class="max-w-xs truncate block">{{ row.descripcion || '—' }}</span>
          <span v-else>{{ row[field.name] ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editarCertificacion(row)"
            @preview="previewDocument(row)"
            @download="openDocument(row)"
            @upload="triggerFileUpload(row._id)"
            @delete-document="eliminarSoloPDF(row)"
            @delete="openDelete(row)"
          />
        </template>
      </AppDataTable>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <AppModalShell
      ref="modal"
      labelled-by="certificacion-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <AgregarCertificacion
        :editing-item="pendingEdit"
        @certificacion-added="loadDossier"
        @certificacion-updated="handleCertificacionUpdated"
        @close="hideModal"
      />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      labelled-by="certificacion-delete-modal-title"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-slate-700">
        ¿Deseas eliminar la certificación <strong>{{ pendingDelete?.titulo || "seleccionada" }}</strong>?
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showDeleteModal = false">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmDelete">Eliminar</AppButton>
      </template>
    </AppModalShell>

    <!-- Input file oculto -->
    <input type="file" ref="fileInput" accept="application/pdf" style="display: none" @change="handleFileSelect">
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Modal } from "@/shared/utils/modalController";
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import AgregarCertificacion from "@/modules/perfil/components/AgregarCertificacion.vue";
import ProfileSectionShell from "@/modules/perfil/components/ProfileSectionShell.vue";
import DossierDocumentActions from "@/modules/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/modules/perfil/components/DossierPdfPreviewModal.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import { mapDossierStatusToSeraType } from "@/modules/perfil/utils/dossierStatus";
import DossierService from "@/modules/dossier/services/DossierService";
import { useDossierAccess } from "@/modules/perfil/composables/useDossierAccess";

const modal = ref(null);
const pdfPreviewModal = ref(null);
const fileInput = ref(null);
const selectedItemId = ref(null);
const dossier = ref(null);
const loading = ref(true);
const pendingEdit = ref(null);
const pendingDelete = ref(null);
const showDeleteModal = ref(false);
const { canCreateDossier, canUpdateDossier, canDeleteDossier } = useDossierAccess();

let modalInstance = null;

const tableFields = [
  { name: 'sera', label: '' },
  { name: 'titulo', label: 'CERTIFICACIÓN' },
  { name: 'institution', label: 'INSTITUCIÓN' },
  { name: 'horas', label: 'HORAS' },
  { name: 'fecha', label: 'FECHA' },
  { name: 'tipo', label: 'ÁMBITO' },
  { name: 'descripcion', label: 'DESCRIPCIÓN' },
];

const certificaciones = computed(() => {
    if (!dossier.value || !dossier.value.certificaciones) return [];
    return dossier.value.certificaciones;
});

const tableRows = certificaciones;

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

// El formulario pide el cierre con @close; lo ejecuta quien monta el modal, que es esta seccion.
const hideModal = () => {
    if (!modal.value?.el) return;
    Modal.getOrCreateInstance(modal.value.el).hide();
};

const openModal = () => {
    if (!canCreateDossier.value) return;
    pendingEdit.value = null;
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const editarCertificacion = (certificacion) => {
    if (!canUpdateDossier.value) return;
    pendingEdit.value = { ...certificacion };
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const handleCertificacionUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
};

const openDelete = (certificacion) => {
    if (!canDeleteDossier.value) return;
    pendingDelete.value = certificacion;
    showDeleteModal.value = true;
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
        await DossierService.deleteCertificacion(pendingDelete.value._id);
        await loadDossier();
        showDeleteModal.value = false;
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
};

const eliminarSoloPDF = async (certificacion) => {
    if (!canDeleteDossier.value) return;
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
    if (!canUpdateDossier.value) return;
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
    modalInstance?.dispose();
    window.removeEventListener('dossier-updated', loadDossier);
});
</script>
