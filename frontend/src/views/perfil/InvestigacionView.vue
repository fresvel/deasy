<template>
  <div class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Investigación y producción académica"
      subtitle="Gestiona artículos, libros, ponencias, tesis y proyectos."
      @add="openAddModal"
    >
      <!-- Artículos -->
      <ProfileTableBlock title="Artículos">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REVISTA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">BASE INDEXADA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ISSN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">SJR</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">FECHA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ESTADO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!articulos.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="9" class="px-4 py-8 text-center text-slate-500 italic">No hay artículos registrados.</td>
              </tr>
              <tr v-for="item in articulos" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.revista || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.base_indexada || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.issn || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.sjr || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(item.fecha) || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.estado || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @edit="editarItem('articulos', item)"
                    @preview="previewDocument(item, 'articulo')"
                    @download="openDocument(item, 'articulo')"
                    @upload="triggerFileUpload(item._id, 'articulo')"
                    @delete-document="eliminarSoloPDF('articulos', item)"
                    @delete="openDelete('articulos', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Libros -->
      <ProfileTableBlock title="Libros y capítulos">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">EDITORIAL</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ISBN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ISNN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AÑO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!libros.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">No hay libros o capítulos registrados.</td>
              </tr>
              <tr v-for="item in libros" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.editorial || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.isbn || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.isnn || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item['año'] || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.tipo || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @edit="editarItem('libros', item)"
                    @preview="previewDocument(item, 'libro')"
                    @download="openDocument(item, 'libro')"
                    @upload="triggerFileUpload(item._id, 'libro')"
                    @delete-document="eliminarSoloPDF('libros', item)"
                    @delete="openDelete('libros', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Ponencias -->
      <ProfileTableBlock title="Ponencias">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">EVENTO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AÑO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ponencias.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">No hay ponencias registradas.</td>
              </tr>
              <tr v-for="item in ponencias" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.evento || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item['año'] || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.pais || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @edit="editarItem('ponencias', item)"
                    @preview="previewDocument(item, 'ponencia')"
                    @download="openDocument(item, 'ponencia')"
                    @upload="triggerFileUpload(item._id, 'ponencia')"
                    @delete-document="eliminarSoloPDF('ponencias', item)"
                    @delete="openDelete('ponencias', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Tesis -->
      <ProfileTableBlock title="Tesis dirigidas o revisadas">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">IES</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TEMA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PROGRAMA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">NIVEL</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AÑO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ROL</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!tesis.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">No hay tesis registradas.</td>
              </tr>
              <tr v-for="item in tesis" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.ies || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.tema || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.programa || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.nivel || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item['año'] || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.rol || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @edit="editarItem('tesis', item)"
                    @preview="previewDocument(item, 'tesis')"
                    @download="openDocument(item, 'tesis')"
                    @upload="triggerFileUpload(item._id, 'tesis')"
                    @delete-document="eliminarSoloPDF('tesis', item)"
                    @delete="openDelete('tesis', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Proyectos -->
      <ProfileTableBlock title="Proyectos">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TEMA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PROGRAMA / GRUPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INICIO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">FIN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PRESUPUESTO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AVANCE</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!proyectos.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="9" class="px-4 py-8 text-center text-slate-500 italic">No hay proyectos registrados.</td>
              </tr>
              <tr v-for="item in proyectos" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.tema || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.institucion || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.programa_group || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(item.inicio) || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(item.fin) || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.presupuesto ? `$${item.presupuesto}` : "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.avance !== undefined ? `${item.avance}%` : "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @edit="editarItem('proyectos', item)"
                    @preview="previewDocument(item, 'proyecto')"
                    @download="openDocument(item, 'proyecto')"
                    @upload="triggerFileUpload(item._id, 'proyecto')"
                    @delete-document="eliminarSoloPDF('proyectos', item)"
                    @delete="openDelete('proyectos', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="investigacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarInvestigacion 
            :editing-item="pendingEdit" 
            :initial-type="pendingType"
            @investigacion-added="loadDossier" 
            @investigacion-updated="handleInvestigacionUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="investigacionDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" data-modal-dismiss aria-label="Close">
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar este registro de investigación?
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
import { Modal } from "@/utils/modalController";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import AgregarInvestigacion from "@/views/perfil/components/AgregarInvestigacion.vue";
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
const selectedItemType = ref(null);
const dossier = ref(null);
const pendingEdit = ref(null);
const pendingType = ref("articulos");
const pendingDelete = ref(null);

let modalInstance = null;
let deleteInstance = null;

const investigacion = computed(() => dossier.value?.investigacion || {});
const articulos = computed(() => investigacion.value?.articulos || []);
const libros = computed(() => investigacion.value?.libros || []);
const ponencias = computed(() => investigacion.value?.ponencias || []);
const tesis = computed(() => investigacion.value?.tesis || []);
const proyectos = computed(() => investigacion.value?.proyectos || []);

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
  pendingEdit.value = null;
  pendingType.value = "articulos";
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};

const editarItem = (tipo, item) => {
  pendingEdit.value = { ...item };
  pendingType.value = tipo;
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};

const handleInvestigacionUpdated = () => {
  pendingEdit.value = null;
  loadDossier();
};

const openDelete = (tipo, item) => {
  pendingDelete.value = { tipo, item };
  if (!deleteModal.value) return;
  deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
  deleteInstance.show();
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try {
    await DossierService.deleteInvestigacion(pendingDelete.value.tipo, pendingDelete.value.item._id);
    await loadDossier();
    deleteInstance?.hide();
  } catch (error) {
    console.error("Error al eliminar:", error);
  }
};

const eliminarSoloPDF = async (tipo, item) => {
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
  if (modalInstance) {
    modalInstance.hide();
    modalInstance.dispose();
  }
  if (deleteInstance) {
    deleteInstance.hide();
    deleteInstance.dispose();
  }
  window.removeEventListener("dossier-updated", loadDossier);
});
</script>
