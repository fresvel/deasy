<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openModal"
    >
      <ProfileSubsectionTabs
        v-model="activeTab"
        aria-label="Tipos de referencias"
        :tabs="referenceTabs"
      />

      <AppDataTable
        :fields="tableFields"
        :rows="tableRows"
        :row-key="(row) => row._id"
        empty-text="No hay registros."
        actions-label="ACCIÓN"
      >
        <template #cell="{ row, field }">
          <BtnSera v-if="field.name === 'sera'" :type="getSeraType(row.sera)" />
          <span v-else>{{ row[field.name] ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editarReferencia(row)"
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
      labelled-by="referencia-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <AgregarReferencia
        :editing-item="pendingEdit"
        @referencia-added="loadDossier"
        @referencia-updated="handleReferenciaUpdated"
        @close="hideModal"
      />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      labelled-by="referencia-delete-modal-title"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-slate-700">
        ¿Deseas eliminar la referencia de <strong>{{ pendingDelete?.nombre || "seleccionada" }}</strong>?
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showDeleteModal = false">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmDelete">Eliminar</AppButton>
      </template>
    </AppModalShell>

    <input type="file" ref="fileInput" accept="application/pdf" style="display: none" @change="handleFileSelect">
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Modal } from "@/shared/utils/modalController";
import AgregarReferencia from "@/modules/perfil/components/AgregarReferencia.vue";
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import ProfileSectionShell from "@/modules/perfil/components/ProfileSectionShell.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
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
const pendingEdit = ref(null);
const pendingDelete = ref(null);
const showDeleteModal = ref(false);
const { canCreateDossier, canUpdateDossier, canDeleteDossier } = useDossierAccess();
const activeTab = ref("laborales");

let modalInstance = null;

const referenciasLaborales = computed(() => {
    if (!dossier.value || !dossier.value.referencias) return [];
    return dossier.value.referencias.filter(r => r.tipo === 'laboral');
});

const referenciasFamiliares = computed(() => {
    if (!dossier.value || !dossier.value.referencias) return [];
    return dossier.value.referencias.filter(r => r.tipo === 'familiar');
});

const referenciasPersonales = computed(() => {
    if (!dossier.value || !dossier.value.referencias) return [];
    return dossier.value.referencias.filter(r => r.tipo === 'personal');
});

const referenceTabs = computed(() => ([
    { key: "laborales", label: "Laborales", count: referenciasLaborales.value.length },
    { key: "familiares", label: "Familiares", count: referenciasFamiliares.value.length },
    { key: "personales", label: "Personales", count: referenciasPersonales.value.length },
]));

const tableFields = computed(() => {
  if (activeTab.value === 'laborales') return [
    { name: 'sera', label: '' },
    { name: 'nombre', label: 'REFERENCIA' },
    { name: 'cargo_parentesco', label: 'CARGO' },
    { name: 'email', label: 'CORREO' },
    { name: 'telefono', label: 'TELÉFONO' },
    { name: 'institution', label: 'INSTITUCIÓN' },
  ];
  if (activeTab.value === 'familiares') return [
    { name: 'sera', label: '' },
    { name: 'nombre', label: 'REFERENCIA' },
    { name: 'cargo_parentesco', label: 'PARENTESCO' },
    { name: 'email', label: 'CORREO' },
    { name: 'telefono', label: 'TELÉFONO' },
  ];
  return [
    { name: 'sera', label: '' },
    { name: 'nombre', label: 'REFERENCIA' },
    { name: 'email', label: 'CORREO' },
    { name: 'telefono', label: 'TELÉFONO' },
  ];
});

const tableRows = computed(() => {
  if (activeTab.value === 'laborales') return referenciasLaborales.value;
  if (activeTab.value === 'familiares') return referenciasFamiliares.value;
  return referenciasPersonales.value;
});

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

const loadDossier = async () => {
    try {
        const data = await DossierService.getDossier();
        if (data.success) dossier.value = data.data;
    } catch (error) {
        console.error('Error al cargar dossier:', error);
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

const editarReferencia = (ref) => {
    if (!canUpdateDossier.value) return;
    pendingEdit.value = { ...ref };
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const handleReferenciaUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
};

const openDelete = (ref) => {
    if (!canDeleteDossier.value) return;
    pendingDelete.value = ref;
    showDeleteModal.value = true;
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
        await DossierService.deleteReferencia(pendingDelete.value._id);
        await loadDossier();
        showDeleteModal.value = false;
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
};

const eliminarSoloPDF = async (ref) => {
    if (!canDeleteDossier.value) return;
    if (!confirm('¿Estás seguro de eliminar solo el documento PDF?')) return;
    try {
        await DossierService.deleteDocument("referencia", ref._id);
        await loadDossier();
    } catch (error) {
        console.error('Error al eliminar PDF:', error);
    }
};

const getDocumentBlob = async (tipoDocumento, registroId) => {
    const response = await DossierService.downloadDocument(tipoDocumento, registroId);
    return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (ref) => {
    try {
        const blob = await getDocumentBlob("referencia", ref._id);
        pdfPreviewModal.value?.openFromBlob(blob);
    } catch (error) {
        console.error("Error al previsualizar:", error);
    }
};

const openDocument = async (ref) => {
    try {
        const blob = await getDocumentBlob("referencia", ref._id);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${ref.nombre || 'referencia'}.pdf`;
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
        await DossierService.uploadReferenciaDocument(selectedItemId.value, file);
        await loadDossier();
    } catch (error) {
        console.error('Error al subir:', error);
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
