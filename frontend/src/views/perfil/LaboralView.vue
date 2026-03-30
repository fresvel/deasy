<template>
  <div class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Experiencia laboral"
      subtitle="Detalla tu experiencia docente y profesional."
      @add="openModal"
    >

    <ProfileTableBlock title="Experiencia profesional">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CÁTEDRA / ASIGNATURA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">MODALIDAD</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">DESDE</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">HASTA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!experienciaProfesional.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No has registrado experiencia profesional todavía.</p>
                </td>
              </tr>
              <tr v-for="experiencia in experienciaProfesional" :key="experiencia._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(experiencia.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.institucion }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">-</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(experiencia.fecha_inicio) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(experiencia.url_documento)"
                    @preview="previewDocument(experiencia)"
                    @download="openDocument(experiencia)"
                    @upload="triggerFileUpload(experiencia._id)"
                    @delete="eliminarExperiencia(experiencia)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </ProfileTableBlock>

    <ProfileTableBlock title="Experiencia docente">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
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
              <tr v-if="!experienciaDocente.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No has registrado experiencia docente todavía.</p>
                </td>
              </tr>
              <tr v-for="experiencia in experienciaDocente" :key="experiencia._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(experiencia.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.institucion }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.funcion_catedra ? experiencia.funcion_catedra.join(', ') : 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">-</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(experiencia.fecha_inicio) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ experiencia.fecha_fin ? formatDate(experiencia.fecha_fin) : 'Actualidad' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(experiencia.url_documento)"
                    @preview="previewDocument(experiencia)"
                    @download="openDocument(experiencia)"
                    @upload="triggerFileUpload(experiencia._id)"
                    @delete="eliminarExperiencia(experiencia)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </ProfileTableBlock>
    </ProfileSectionShell>

    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="experienciaModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarExperiencia @experiencia-added="handleExperienciaAdded" />
        </div>
      </div>
    </div>

    <input type="file" ref="fileInput" accept="application/pdf" class="hidden" @change="handleFileSelect" />
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import DossierService from "@/services/dossier/DossierService";
import { Modal } from "@/utils/modalController";
import AgregarExperiencia from "./components/AgregarExperiencia.vue";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import DossierDocumentActions from "@/views/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/views/perfil/components/DossierPdfPreviewModal.vue";
import { mapDossierStatusToSeraType } from "@/views/perfil/utils/dossierStatus";

const modal = ref(null);
const fileInput = ref(null);
const pdfPreviewModal = ref(null);
const selectedItemId = ref(null);
const dossier = ref(null);
const loading = ref(true);
const currentUser = ref(null);
let modalInstance = null;

// Computed properties para agrupar experiencia por tipo
const experienciaDocente = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Docencia');
});

const experienciaProfesional = computed(() => {
    if (!dossier.value || !dossier.value.experiencia) return [];
    return dossier.value.experiencia.filter(e => e.tipo === 'Profesional');
});

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

// Formatear fecha para mostrar
const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// Cargar datos del usuario y su dossier
const loadDossier = async () => {
    try {
        loading.value = true;
        
        const data = await DossierService.getDossier();
        
        if (data.success) {
            dossier.value = data.data;
            currentUser.value = { cedula: DossierService.getCedula() };
            console.log('📋 Dossier cargado:', dossier.value);
        }
        
    } catch (error) {
        console.error('Error al cargar dossier:', error);
    } finally {
        loading.value = false;
    }
};

const openModal = () => {
    if (!modal.value) {
        return;
    }
    modalInstance = Modal.getOrCreateInstance(modal.value);
    modalInstance.show();
};

const handleExperienciaAdded = () => {
    loadDossier();
};

// Función para eliminar experiencia
const eliminarExperiencia = async (experiencia) => {
    if (!confirm('¿Estás seguro de eliminar esta experiencia?')) return;
    
    try {
        await DossierService.deleteExperiencia(experiencia._id);
        await loadDossier();
        alert('Experiencia eliminada correctamente');
    } catch (error) {
        console.error('Error al eliminar experiencia:', error);
        alert('Error al eliminar la experiencia');
    }
};

const editarExperiencia = (experiencia) => {
    console.log('Editar experiencia:', experiencia);
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
        console.error("Error al previsualizar documento:", error);
        alert("Error al visualizar el documento");
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
        const response = await DossierService.uploadExperienciaDocument(selectedItemId.value, file);
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

// Cargar datos al montar el componente
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
    window.removeEventListener('dossier-updated', loadDossier);
});
</script>
