<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openModal"
    >
      <ProfileSubsectionTabs
        v-model="activeTab"
        aria-label="Tipos de experiencia laboral"
        :tabs="experienceTabs"
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
          <span v-else-if="field.name === 'funciones'">{{ row.funcion_catedra?.join(', ') || '—' }}</span>
          <span v-else-if="field.name === 'fecha_inicio'">{{ formatDate(row.fecha_inicio) }}</span>
          <span v-else-if="field.name === 'fecha_fin'">{{ row.fecha_fin ? formatDate(row.fecha_fin) : 'Actualidad' }}</span>
          <span v-else>{{ row[field.name] ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editarExperiencia(row)"
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
      id="experienciaModal"
      labelled-by="experiencia-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <AgregarExperiencia
        :editing-item="pendingEdit"
        @experiencia-added="loadDossier"
        @experiencia-updated="handleExperienciaUpdated"
      />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      labelled-by="experiencia-delete-modal-title"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-slate-700">
        ¿Deseas eliminar la experiencia en <strong>{{ pendingDelete?.institucion || "seleccionada" }}</strong>?
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
import DossierService from "@/modules/dossier/services/DossierService";
import { Modal } from "@/shared/utils/modalController";
import AgregarExperiencia from "@/modules/perfil/components/AgregarExperiencia.vue";
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import ProfileSectionShell from "@/modules/perfil/components/ProfileSectionShell.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import DossierDocumentActions from "@/modules/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/modules/perfil/components/DossierPdfPreviewModal.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import { mapDossierStatusToSeraType } from "@/modules/perfil/utils/dossierStatus";
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
const activeTab = ref("profesional");

let modalInstance = null;

const experienciaDocente = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Docencia');
});

const experienciaProfesional = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Profesional');
});

const experienceTabs = computed(() => ([
    { key: "profesional", label: "Profesional", count: experienciaProfesional.value.length },
    { key: "docente", label: "Docente", count: experienciaDocente.value.length },
]));

const tableFields = computed(() => [
  { name: 'sera', label: '' },
  { name: 'institucion', label: 'INSTITUCIÓN' },
  { name: 'funciones', label: activeTab.value === 'profesional' ? 'FUNCIONES' : 'CÁTEDRAS' },
  { name: 'modalidad', label: 'MODALIDAD' },
  { name: 'fecha_inicio', label: 'DESDE' },
  { name: 'fecha_fin', label: 'HASTA' },
]);

const tableRows = computed(() =>
  activeTab.value === 'profesional' ? experienciaProfesional.value : experienciaDocente.value
);

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const loadDossier = async () => {
    try {
        const data = await DossierService.getDossier();
        if (data.success) dossier.value = data.data;
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    }
};

const openModal = () => {
    if (!canCreateDossier.value) return;
    pendingEdit.value = null;
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const editarExperiencia = (experiencia) => {
    if (!canUpdateDossier.value) return;
    pendingEdit.value = { ...experiencia };
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const handleExperienciaUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
};

const openDelete = (experiencia) => {
    if (!canDeleteDossier.value) return;
    pendingDelete.value = experiencia;
    showDeleteModal.value = true;
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
        await DossierService.deleteExperiencia(pendingDelete.value._id);
        await loadDossier();
        showDeleteModal.value = false;
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
};

const eliminarSoloPDF = async (experiencia) => {
    if (!canDeleteDossier.value) return;
    if (!confirm('¿Estás seguro de eliminar solo el documento PDF?')) return;
    try {
        await DossierService.deleteDocument("experiencia", experiencia._id);
        await loadDossier();
    } catch (error) {
        console.error('Error al eliminar PDF:', error);
    }
};

const getDocumentBlob = async (tipoDocumento, registroId) => {
    const response = await DossierService.downloadDocument(tipoDocumento, registroId);
    return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (experiencia) => {
    try {
        const blob = await getDocumentBlob("experiencia", experiencia._id);
        pdfPreviewModal.value?.openFromBlob(blob);
    } catch (error) {
        console.error("Error al previsualizar:", error);
    }
};

const openDocument = async (experiencia) => {
    try {
        const blob = await getDocumentBlob("experiencia", experiencia._id);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${experiencia.institucion || 'experiencia'}.pdf`;
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
        await DossierService.uploadExperienciaDocument(selectedItemId.value, file);
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
