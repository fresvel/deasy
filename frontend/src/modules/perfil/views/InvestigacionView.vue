<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openAddModal"
    >
      <ProfileSubsectionTabs
        v-model="activeTab"
        aria-label="Tipos de producción académica"
        :tabs="researchTabs"
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
          <span v-else-if="field.name === 'fecha'">{{ formatDate(row.fecha) || '—' }}</span>
          <span v-else-if="field.name === 'inicio'">{{ formatDate(row.inicio) || '—' }}</span>
          <span v-else-if="field.name === 'fin'">{{ formatDate(row.fin) || '—' }}</span>
          <span v-else-if="field.name === 'presupuesto'">{{ row.presupuesto ? '$' + row.presupuesto : '—' }}</span>
          <span v-else-if="field.name === 'avance'">{{ row.avance !== undefined ? row.avance + '%' : '—' }}</span>
          <span v-else-if="field.name === 'año'">{{ row['año'] || '—' }}</span>
          <span v-else>{{ row[field.name] ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editarItem(activeTab, row)"
            @preview="previewDocument(row, tabToDocType(activeTab))"
            @download="openDocument(row, tabToDocType(activeTab))"
            @upload="triggerFileUpload(row._id, tabToDocType(activeTab))"
            @delete-document="eliminarSoloPDF(activeTab, row)"
            @delete="openDelete(activeTab, row)"
          />
        </template>
      </AppDataTable>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <AppModalShell
      ref="modal"
      id="investigacionModal"
      labelled-by="investigacion-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <AgregarInvestigacion
        :editing-item="pendingEdit"
        :initial-type="pendingType"
        @investigacion-added="loadDossier"
        @investigacion-updated="handleInvestigacionUpdated"
      />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      labelled-by="investigacion-delete-modal-title"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-slate-700">¿Deseas eliminar este registro de investigación?</p>
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
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import ProfileSectionShell from "@/modules/perfil/components/ProfileSectionShell.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";
import AgregarInvestigacion from "@/modules/perfil/components/AgregarInvestigacion.vue";
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
const selectedItemType = ref(null);
const dossier = ref(null);
const pendingEdit = ref(null);
const pendingType = ref("articulos");
const pendingDelete = ref(null);
const showDeleteModal = ref(false);
const { canCreateDossier, canUpdateDossier, canDeleteDossier } = useDossierAccess();
const activeTab = ref("articulos");

let modalInstance = null;

const investigacion = computed(() => dossier.value?.investigacion || {});
const articulos = computed(() => investigacion.value?.articulos || []);
const libros = computed(() => investigacion.value?.libros || []);
const ponencias = computed(() => investigacion.value?.ponencias || []);
const tesis = computed(() => investigacion.value?.tesis || []);
const proyectos = computed(() => investigacion.value?.proyectos || []);

const researchTabs = computed(() => ([
  { key: "articulos", label: "Artículos", count: articulos.value.length },
  { key: "libros", label: "Libros y capítulos", count: libros.value.length },
  { key: "ponencias", label: "Ponencias", count: ponencias.value.length },
  { key: "tesis", label: "Tesis", count: tesis.value.length },
  { key: "proyectos", label: "Proyectos", count: proyectos.value.length },
]));

const tableFields = computed(() => {
  switch (activeTab.value) {
    case 'articulos': return [
      { name: 'sera', label: '' },
      { name: 'titulo', label: 'TÍTULO' },
      { name: 'revista', label: 'REVISTA' },
      { name: 'base_indexada', label: 'BASE INDEXADA' },
      { name: 'issn', label: 'ISSN' },
      { name: 'sjr', label: 'SJR' },
      { name: 'fecha', label: 'FECHA' },
      { name: 'estado', label: 'ESTADO' },
    ];
    case 'libros': return [
      { name: 'sera', label: '' },
      { name: 'titulo', label: 'TÍTULO' },
      { name: 'editorial', label: 'EDITORIAL' },
      { name: 'isbn', label: 'ISBN' },
      { name: 'isnn', label: 'ISNN' },
      { name: 'año', label: 'AÑO' },
      { name: 'tipo', label: 'TIPO' },
    ];
    case 'ponencias': return [
      { name: 'sera', label: '' },
      { name: 'titulo', label: 'TÍTULO' },
      { name: 'evento', label: 'EVENTO' },
      { name: 'año', label: 'AÑO' },
      { name: 'pais', label: 'PAÍS' },
    ];
    case 'tesis': return [
      { name: 'sera', label: '' },
      { name: 'ies', label: 'IES' },
      { name: 'tema', label: 'TEMA' },
      { name: 'programa', label: 'PROGRAMA' },
      { name: 'nivel', label: 'NIVEL' },
      { name: 'año', label: 'AÑO' },
      { name: 'rol', label: 'ROL' },
    ];
    default: return [
      { name: 'sera', label: '' },
      { name: 'tema', label: 'TEMA' },
      { name: 'institucion', label: 'INSTITUCIÓN' },
      { name: 'programa_group', label: 'PROGRAMA / GRUPO' },
      { name: 'inicio', label: 'INICIO' },
      { name: 'fin', label: 'FIN' },
      { name: 'presupuesto', label: 'PRESUPUESTO' },
      { name: 'avance', label: 'AVANCE' },
    ];
  }
});

const tableRows = computed(() => {
  switch (activeTab.value) {
    case 'articulos': return articulos.value;
    case 'libros': return libros.value;
    case 'ponencias': return ponencias.value;
    case 'tesis': return tesis.value;
    default: return proyectos.value;
  }
});

const tabToDocType = (tab) => {
  const map = { articulos: 'articulo', libros: 'libro', ponencias: 'ponencia', tesis: 'tesis', proyectos: 'proyecto' };
  return map[tab] || tab;
};

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const loadDossier = async () => {
  try {
    const data = await DossierService.getDossier();
    if (data.success) dossier.value = data.data;
  } catch (error) {
    console.error("Error al cargar dossier:", error);
  }
};

const openAddModal = () => {
  if (!canCreateDossier.value) return;
  pendingEdit.value = null;
  pendingType.value = "articulos";
  if (!modal.value?.el) return;
  modalInstance = Modal.getOrCreateInstance(modal.value.el);
  modalInstance.show();
};

const editarItem = (tipo, item) => {
  if (!canUpdateDossier.value) return;
  pendingEdit.value = { ...item };
  pendingType.value = tipo;
  if (!modal.value?.el) return;
  modalInstance = Modal.getOrCreateInstance(modal.value.el);
  modalInstance.show();
};

const handleInvestigacionUpdated = () => {
  pendingEdit.value = null;
  loadDossier();
};

const openDelete = (tipo, item) => {
  if (!canDeleteDossier.value) return;
  pendingDelete.value = { tipo, item };
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try {
    await DossierService.deleteInvestigacion(pendingDelete.value.tipo, pendingDelete.value.item._id);
    await loadDossier();
    showDeleteModal.value = false;
  } catch (error) {
    console.error("Error al eliminar:", error);
  }
};

const eliminarSoloPDF = async (tipo, item) => {
  if (!canDeleteDossier.value) return;
  if (!confirm("¿Estás seguro de eliminar solo el documento PDF?")) return;
  try {
    const tipoMap = { 'articulos': 'articulo', 'libros': 'libro', 'ponencias': 'ponencia', 'tesis': 'tesis', 'proyectos': 'proyecto' };
    await DossierService.deleteDocument(tipoMap[tipo] || tipo, item._id);
    await loadDossier();
  } catch (error) {
    console.error("Error al eliminar PDF:", error);
  }
};

const getDocumentBlob = async (tipoDocumento, registroId) => {
  const response = await DossierService.downloadDocument(tipoDocumento, registroId);
  return new Blob([response.data], { type: "application/pdf" });
};

const previewDocument = async (item, tipo) => {
  try {
    const blob = await getDocumentBlob(tipo, item._id);
    pdfPreviewModal.value?.openFromBlob(blob);
  } catch (error) {
    console.error("Error al previsualizar:", error);
  }
};

const openDocument = async (item, tipo) => {
  try {
    const blob = await getDocumentBlob(tipo, item._id);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${item.titulo || item.tema || tipo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.error('Error al descargar:', error);
  }
};

const triggerFileUpload = (itemId, tipo) => {
  if (!canUpdateDossier.value) return;
  selectedItemId.value = itemId;
  selectedItemType.value = tipo;
  fileInput.value.click();
};

const handleFileSelect = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await DossierService.uploadInvestigacionDocument(selectedItemType.value, selectedItemId.value, file);
    await loadDossier();
  } catch (error) {
    console.error('Error al subir:', error);
  }
  event.target.value = '';
};

onMounted(() => {
  loadDossier();
  window.addEventListener("dossier-updated", loadDossier);
});

onBeforeUnmount(() => {
  modalInstance?.dispose();
  window.removeEventListener("dossier-updated", loadDossier);
});
</script>
