<template>
  <div class="w-full animate-fade-in">
    <ProfileSectionShell
      :add-disabled="!canCreateDossier"
      add-disabled-title="No tienes permiso para agregar registros del dossier."
      @add="openModal"
    >
      <ProfileSubsectionTabs
        v-model="activeTab"
        aria-label="Tipos de capacitación"
        :tabs="trainingTabs"
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
          <span v-else-if="field.name === 'horas'">{{ row.horas || '—' }}</span>
          <span v-else-if="field.name === 'pais'">{{ row.pais || '—' }}</span>
          <span v-else-if="field.name === 'rol'">{{ row.rol || '—' }}</span>
          <span v-else-if="field.name === 'fecha_inicio'">{{ formatDate(row.fecha_inicio) }}</span>
          <span v-else-if="field.name === 'fecha_fin'">{{ formatDate(row.fecha_fin) }}</span>
          <span v-else>{{ row[field.name] ?? '—' }}</span>
        </template>
        <template #actions="{ row }">
          <DossierDocumentActions
            :has-document="Boolean(row.url_documento)"
            :can-edit="canUpdateDossier"
            :can-upload="canUpdateDossier"
            :can-delete-document="canDeleteDossier"
            :can-delete="canDeleteDossier"
            @edit="editarCapacitacion(row)"
            @preview="previewDocument(row)"
            @download="openDocument(row)"
            @upload="triggerFileUpload(row._id)"
            @delete-document="eliminarSoloPDF(row)"
            @delete="openDelete(row)"
          />
        </template>
      </AppDataTable>
    </ProfileSectionShell>

    <!-- Modal Agregar -->
    <AppModalShell
      ref="modal"
      id="capacitacionModal"
      labelled-by="capacitacion-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
    >
      <AgregarCapacitacion @capacitacion-added="loadDossier" />
    </AppModalShell>

    <!-- Modal Editar -->
    <AppModalShell
      controlled
      :open="showEditModal"
      labelled-by="capacitacion-edit-modal-title"
      size="lg"
      :show-header="false"
      body-class="p-0"
      @close="showEditModal = false"
    >
      <AgregarCapacitacion :editing-item="pendingEdit" @capacitacion-updated="handleCapacitacionUpdated" />
    </AppModalShell>

    <!-- Modal Eliminar -->
    <AppModalShell
      controlled
      :open="showDeleteModal"
      title="Confirmar eliminación"
      labelled-by="capacitacion-delete-modal-title"
      size="md"
      @close="showDeleteModal = false"
    >
      <p class="text-sm text-slate-700">
        ¿Deseas eliminar la capacitación <strong>{{ pendingDelete?.tema || "seleccionada" }}</strong>?
      </p>
      <template #footer>
        <AppButton variant="secondary" @click="showDeleteModal = false">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmDelete">Eliminar</AppButton>
      </template>
    </AppModalShell>

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
import { Modal } from "@/shared/utils/modalController";
import AgregarCapacitacion from "@/modules/perfil/components/AgregarCapacitacion.vue";
import BtnSera from "@/shared/components/buttons/BtnSera.vue";
import DossierService from "@/modules/dossier/services/DossierService";
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
const fileInput = ref(null);
const pdfPreviewModal = ref(null);
const selectedItemId = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
const pendingEdit = ref(null);
const activeTab = ref("docente");
const showEditModal = ref(false);
const showDeleteModal = ref(false);
let modalInstance = null;
const pendingDelete = ref(null);
const { canCreateDossier, canUpdateDossier, canDeleteDossier } = useDossierAccess();

// Computed properties para agrupar capacitaciones por tipo
const capacitacionesDocentes = computed(() => {
    if (!dossier.value || !dossier.value.formacion) return [];
    return dossier.value.formacion.filter(c => c.tipo === 'Docente');
});

const capacitacionesProfesionales = computed(() => {
    if (!dossier.value || !dossier.value.formacion) return [];
    return dossier.value.formacion.filter(c => c.tipo === 'Profesional');
});

const trainingTabs = computed(() => ([
    { key: "docente", label: "Docente", count: capacitacionesDocentes.value.length },
    { key: "profesional", label: "Profesional", count: capacitacionesProfesionales.value.length },
]));

const tableFields = [
  { name: 'sera', label: '' },
  { name: 'tema', label: 'TEMA' },
  { name: 'institution', label: 'INSTITUCIÓN' },
  { name: 'horas', label: 'HORAS' },
  { name: 'pais', label: 'PAÍS' },
  { name: 'fecha_inicio', label: 'INICIO' },
  { name: 'fecha_fin', label: 'FIN' },
  { name: 'rol', label: 'ROL' },
];

const tableRows = computed(() =>
  activeTab.value === 'docente' ? capacitacionesDocentes.value : capacitacionesProfesionales.value
);

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
    if (!canCreateDossier.value) return;
    if (!modal.value?.el) return;
    modalInstance = Modal.getOrCreateInstance(modal.value.el);
    modalInstance.show();
};

const openDelete = (capacitacion) => {
    if (!canDeleteDossier.value) return;
    pendingDelete.value = capacitacion;
    showDeleteModal.value = true;
};

const handleCapacitacionAdded = () => {
    loadDossier();
};

const eliminarCapacitacion = async (capacitacion) => {
    if (!canDeleteDossier.value) return;
    try {
        await DossierService.deleteCapacitacion(capacitacion._id);
        await loadDossier();
        alert('Capacitación eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar capacitación:', error);
        alert('Error al eliminar la capacitación');
    }
};

const eliminarSoloPDF = async (capacitacion) => {
    if (!canDeleteDossier.value) return;
    if (!confirm('¿Estás seguro de eliminar solo el documento PDF? El registro se mantendrá.')) return;
    try {
        await DossierService.deleteDocument("formacion", capacitacion._id);
        await loadDossier();
        alert('Documento eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar documento:', error);
        alert('Error al eliminar el documento');
    }
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    await eliminarCapacitacion(pendingDelete.value);
    showDeleteModal.value = false;
    pendingDelete.value = null;
};

const editarCapacitacion = (registro) => {
    if (!canUpdateDossier.value) return;
    pendingEdit.value = { ...registro };
    showEditModal.value = true;
};

const handleCapacitacionUpdated = () => {
    showEditModal.value = false;
    pendingEdit.value = null;
    loadDossier();
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
    if (!canUpdateDossier.value) return;
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
    modalInstance?.dispose();
    window.removeEventListener('dossier-updated', loadDossier);
});
</script>
