<template>
  <div class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Experiencia laboral"
      subtitle="Detalla tu experiencia docente y profesional."
      @add="openModal"
    >

    <ProfileTableBlock title="Experiencia profesional">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">FUNCIONES</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">MODALIDAD</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">DESDE</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">HASTA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!experienciaProfesional.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">No has registrado experiencia profesional todavía.</td>
              </tr>
              <tr v-for="experiencia in experienciaProfesional" :key="experiencia._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(experiencia.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.institucion }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.modalidad || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(experiencia.fecha_inicio) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(experiencia.url_documento)"
                    @edit="editarExperiencia(experiencia)"
                    @preview="previewDocument(experiencia)"
                    @download="openDocument(experiencia)"
                    @upload="triggerFileUpload(experiencia._id)"
                    @delete-document="eliminarSoloPDF(experiencia)"
                    @delete="openDelete(experiencia)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </ProfileTableBlock>

    <ProfileTableBlock title="Experiencia docente">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CÁTEDRAS</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">MODALIDAD</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">DESDE</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">HASTA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!experienciaDocente.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">No has registrado experiencia docente todavía.</td>
              </tr>
              <tr v-for="experiencia in experienciaDocente" :key="experiencia._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(experiencia.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.institucion }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.modalidad || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(experiencia.fecha_inicio) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(experiencia.url_documento)"
                    @edit="editarExperiencia(experiencia)"
                    @preview="previewDocument(experiencia)"
                    @download="openDocument(experiencia)"
                    @upload="triggerFileUpload(experiencia._id)"
                    @delete-document="eliminarSoloPDF(experiencia)"
                    @delete="openDelete(experiencia)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="experienciaModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarExperiencia 
            :editing-item="pendingEdit" 
            @experiencia-added="loadDossier" 
            @experiencia-updated="handleExperienciaUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="experienciaDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" data-modal-dismiss aria-label="Close">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar la experiencia en 
            <strong>{{ pendingDelete?.institucion || "seleccionada" }}</strong>?
          </div>
          <div class="profile-confirm-footer">
            <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
            <AdminButton variant="danger" @click="confirmDelete">Eliminar</AdminButton>
          </div>
        </div>
      </div>
    </div>

    <input type="file" ref="fileInput" accept="application/pdf" style="display: none" @change="handleFileSelect">
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import DossierService from "@/services/dossier/DossierService";
import { Modal } from "@/utils/modalController";
import AgregarExperiencia from "./components/AgregarExperiencia.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import DossierDocumentActions from "@/views/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/views/perfil/components/DossierPdfPreviewModal.vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import { mapDossierStatusToSeraType } from "@/views/perfil/utils/dossierStatus";

const modal = ref(null);
const deleteModal = ref(null);
const pdfPreviewModal = ref(null);
const fileInput = ref(null);
const selectedItemId = ref(null);
const dossier = ref(null);
const pendingEdit = ref(null);
const pendingDelete = ref(null);

let modalInstance = null;
let deleteInstance = null;

const experienciaDocente = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Docencia');
});

const experienciaProfesional = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Profesional');
});

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
    pendingEdit.value = null;
    if (!modal.value) return;
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const editarExperiencia = (experiencia) => {
    pendingEdit.value = { ...experiencia };
    if (!modal.value) return;
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const handleExperienciaUpdated = () => {
    pendingEdit.value = null;
    loadDossier();
};

const openDelete = (experiencia) => {
    pendingDelete.value = experiencia;
    if (!deleteModal.value) return;
    deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
    deleteInstance.show();
};

const confirmDelete = async () => {
    if (!pendingDelete.value) return;
    try {
        await DossierService.deleteExperiencia(pendingDelete.value._id);
        await loadDossier();
        deleteInstance?.hide();
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
};

const eliminarSoloPDF = async (experiencia) => {
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
