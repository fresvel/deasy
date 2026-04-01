<template>
  <div class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Investigación y producción académica"
      subtitle="Gestiona artículos, libros, ponencias, tesis y proyectos."
      @add="openModal"
    >
      <ProfileTableBlock title="Artículos">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REVISTA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">DOI</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">FECHA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ESTADO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!articulos.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No hay artículos registrados.</p>
                </td>
              </tr>
              <tr v-for="item in articulos" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.revista || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.doi || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(item.fecha) || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.estado || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @preview="previewDocument(item, 'articulo')"
                    @download="openDocument(item, 'articulo')"
                    @upload="triggerFileUpload(item._id, 'articulo')"
                    @delete="removeItem('articulos', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Libros y capítulos">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">EDITORIAL</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ISBN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AÑO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!libros.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No hay libros o capítulos registrados.</p>
                </td>
              </tr>
              <tr v-for="item in libros" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.editorial || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.isbn || item.isnn || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item['año'] || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.tipo || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @preview="previewDocument(item, 'libro')"
                    @download="openDocument(item, 'libro')"
                    @upload="triggerFileUpload(item._id, 'libro')"
                    @delete="removeItem('libros', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Ponencias">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
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
                <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No hay ponencias registradas.</p>
                </td>
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
                    @preview="previewDocument(item, 'ponencia')"
                    @download="openDocument(item, 'ponencia')"
                    @upload="triggerFileUpload(item._id, 'ponencia')"
                    @delete="removeItem('ponencias', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Tesis dirigidas o revisadas">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TEMA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">NIVEL</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AÑO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ROL</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!tesis.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No hay tesis registradas.</p>
                </td>
              </tr>
              <tr v-for="item in tesis" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.ies || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.tema || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.nivel || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item['año'] || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.rol || "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @preview="previewDocument(item, 'tesis')"
                    @download="openDocument(item, 'tesis')"
                    @upload="triggerFileUpload(item._id, 'tesis')"
                    @delete="removeItem('tesis', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Proyectos">
        <div class="overflow-x-auto w-full rounded-xl border border-slate-200 mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TEMA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INICIO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">FIN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">AVANCE</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!proyectos.length" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">
                  <p class="my-3">No hay proyectos registrados.</p>
                </td>
              </tr>
              <tr v-for="item in proyectos" :key="item._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-slate-700"><BtnSera :type="getSeraType(item.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ item.tema || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.institucion || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.tipo || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(item.inicio) || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(item.fin) || "N/A" }}</td>
                <td class="px-4 py-3 text-slate-700">{{ item.avance !== undefined ? `${item.avance}%` : "N/A" }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(item.url_documento)"
                    @preview="previewDocument(item, 'proyecto')"
                    @download="openDocument(item, 'proyecto')"
                    @upload="triggerFileUpload(item._id, 'proyecto')"
                    @delete="removeItem('proyectos', item)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <AppModalShell
      ref="modal"
      id="investigacionModal"
      labelled-by="investigacionModalLabel"
      size="md"
      :show-header="false"
      body-class="p-0"
      content-class="profile-admin-skin"
    >
      <AgregarInvestigacion @investigacion-added="handleInvestigacionAdded" />
    </AppModalShell>

    <input type="file" ref="fileInput" accept="application/pdf" class="hidden" @change="handleFileSelect" />
    <DossierPdfPreviewModal ref="pdfPreviewModal" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { Modal } from "@/utils/modalController";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/views/perfil/components/ProfileSectionShell.vue";
import ProfileTableBlock from "@/views/perfil/components/ProfileTableBlock.vue";
import AgregarInvestigacion from "@/views/perfil/components/AgregarInvestigacion.vue";
import DossierDocumentActions from "@/views/perfil/components/DossierDocumentActions.vue";
import DossierPdfPreviewModal from "@/views/perfil/components/DossierPdfPreviewModal.vue";
import AppModalShell from "@/components/AppModalShell.vue";
import { mapDossierStatusToSeraType } from "@/views/perfil/utils/dossierStatus";
import DossierService from "@/services/dossier/DossierService";

const modal = ref(null);
const fileInput = ref(null);
const pdfPreviewModal = ref(null);
const selectedItemId = ref(null);
const selectedItemType = ref(null);
const dossier = ref(null);
const currentUser = ref(null);
let modalInstance = null;

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
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
};

const loadDossier = async () => {
  try {
    const data = await DossierService.getDossier();
        if (data.success) {
            dossier.value = data.data;
            currentUser.value = { cedula: DossierService.getCedula() };
        }
  } catch (error) {
    console.error("Error al cargar investigación del dossier:", error);
  }
};

const openModal = () => {
  if (!modal.value?.el) return;
  modalInstance = Modal.getOrCreateInstance(modal.value.el);
  modalInstance.show();
};

const handleInvestigacionAdded = () => {
  loadDossier();
};

const removeItem = async (tipo, item) => {
  if (!item?._id) return;
  if (!confirm("¿Deseas eliminar este registro de investigación?")) return;

  try {
    await DossierService.deleteInvestigacion(tipo, item._id);
    window.dispatchEvent(new Event("dossier-updated"));
    await loadDossier();
  } catch (error) {
    console.error("Error al eliminar investigación:", error);
    alert("No se pudo eliminar el registro.");
  }
};

const editItem = (tipo, item) => {
  console.info("Editar investigación", tipo, item);
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
    console.error("Error al previsualizar documento:", error);
    alert("Error al visualizar el documento");
  }
};

const openDocument = async (item, tipo) => {
  try {
    const blob = await getDocumentBlob(tipo, item._id);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${item.titulo || item.tema || tipo || 'investigacion'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.error('Error al abrir documento:', error);
    alert('Error al abrir el documento');
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
    const response = await DossierService.uploadInvestigacionDocument(selectedItemType.value, selectedItemId.value, file);
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
  window.addEventListener("dossier-updated", loadDossier);
});

onBeforeUnmount(() => {
  if (modalInstance) {
    modalInstance.hide();
    modalInstance.dispose();
    modalInstance = null;
  }
  window.removeEventListener("dossier-updated", loadDossier);
});
</script>
