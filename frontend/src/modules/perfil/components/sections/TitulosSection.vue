<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openModal"
    >
      <ProfileSubsectionTabs
        v-model="activeTab"
        aria-label="Tipos de formación profesional"
        :tabs="titleTabs"
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
          <span v-else-if="field.name === 'sreg'">{{ row.sreg || '—' }}</span>
          <span v-else>{{ row[field.name] ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editarTitulo(row)"
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
      id="tituloModal"
      labelled-by="titulo-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <AgregarTitulo
        :editing-item="pendingEdit"
        @title-added="loadDossier"
        @title-updated="handleTituloUpdated"
      />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      labelled-by="titulo-delete-modal-title"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-slate-700">
        ¿Deseas eliminar el título <strong>{{ pendingDelete?.titulo || "seleccionado" }}</strong>?
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
import AgregarTitulo from "@/modules/perfil/components/AgregarTitulo.vue";
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import ProfileSectionShell from "@/modules/perfil/components/ProfileSectionShell.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import DossierDocumentActions from "@/modules/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/modules/perfil/components/DossierPdfPreviewModal.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import { mapDossierStatusToSeraType } from "@/modules/perfil/utils/dossierStatus";
import { Modal } from "@/shared/utils/modalController";
import DossierService from "@/modules/dossier/services/DossierService";
import { useDossierAccess } from "@/modules/perfil/composables/useDossierAccess";

const modal = ref(null);
const pdfPreviewModal = ref(null);
const fileInput = ref(null);
const selectedTituloId = ref(null);
const dossier = ref(null);
const pendingEdit = ref(null);
const pendingDelete = ref(null);
const showDeleteModal = ref(false);
const { canCreateDossier, canUpdateDossier, canDeleteDossier } = useDossierAccess();
const activeTab = ref("cuarto-nivel");

let modalInstance = null;

const titulosTecnicos = computed(() => {
    if (!dossier.value || !dossier.value.titulos) return [];
    return dossier.value.titulos.filter(t => t.nivel === 'Técnico' || t.nivel === 'Tecnólogo');
});

const titulosGrado = computed(() => {
    if (!dossier.value || !dossier.value.titulos) return [];
    return dossier.value.titulos.filter(t => t.nivel === 'Grado');
});

const titulosCuartoNivel = computed(() => {
    if (!dossier.value || !dossier.value.titulos) return [];
    const quartoLevels = ['Maestría', 'Maestría Tecnológica', 'Diplomado', 'Doctorado', 'Posdoctorado'];
    return dossier.value.titulos.filter(t => quartoLevels.includes(t.nivel));
});

const titleTabs = computed(() => ([
    { key: "cuarto-nivel", label: "Cuarto Nivel", count: titulosCuartoNivel.value.length },
    { key: "grado", label: "Grado", count: titulosGrado.value.length },
    { key: "tecnicos", label: "Técnicos y Tecnológicos", count: titulosTecnicos.value.length },
]));

const tableFields = [
  { name: 'sera', label: '' },
  { name: 'titulo', label: 'TÍTULO' },
  { name: 'ies', label: 'INSTITUCIÓN' },
  { name: 'tipo', label: 'TIPO' },
  { name: 'sreg', label: 'N.° SENESCYT' },
  { name: 'campo_amplio', label: 'CAMPO' },
  { name: 'pais', label: 'PAÍS' },
];

const tableRows = computed(() => {
  if (activeTab.value === 'cuarto-nivel') return titulosCuartoNivel.value;
  if (activeTab.value === 'grado') return titulosGrado.value;
  return titulosTecnicos.value;
});

const loadDossier = async () => {
    try {
        const data = await DossierService.getDossier();
        if (data.success) dossier.value = data.data;
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    }
};

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

const openModal = () => {
    if (!canCreateDossier.value) return;
    pendingEdit.value = null;
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const editarTitulo = (titulo) => {
    if (!canUpdateDossier.value) return;
    pendingEdit.value = { ...titulo };
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const handleTituloUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
};

const openDelete = (titulo) => {
    if (!canDeleteDossier.value) return;
    pendingDelete.value = titulo;
    showDeleteModal.value = true;
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
        await DossierService.deleteTitulo(pendingDelete.value._id);
        await loadDossier();
        showDeleteModal.value = false;
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
};

const eliminarSoloPDF = async (titulo) => {
    if (!canDeleteDossier.value) return;
    if (!confirm('¿Estás seguro de eliminar solo el documento PDF?')) return;
    try {
        await DossierService.deleteDocument("titulo", titulo._id);
        await loadDossier();
    } catch (error) {
        console.error('Error al eliminar PDF:', error);
    }
};

const getDocumentBlob = async (tipoDocumento, registroId) => {
    const response = await DossierService.downloadDocument(tipoDocumento, registroId);
    return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (titulo) => {
    try {
        const blob = await getDocumentBlob("titulo", titulo._id);
        pdfPreviewModal.value?.openFromBlob(blob);
    } catch (error) {
        console.error("Error al previsualizar:", error);
    }
};

const openDocument = async (titulo) => {
    try {
        const blob = await getDocumentBlob("titulo", titulo._id);
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${titulo.titulo || 'titulo'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
        console.error('Error al descargar:', error);
    }
};

const triggerFileUpload = (tituloId) => {
    if (!canUpdateDossier.value) return;
    selectedTituloId.value = tituloId;
    fileInput.value.click();
};

const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        await DossierService.uploadTituloDocument(selectedTituloId.value, file);
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
