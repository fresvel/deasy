<template>
  <div class="w-full animate-fade-in">
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
                  <div class="flex items-center gap-1">
                    <button v-if="item.url_documento" @click="openDocument(item, 'articulo')" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                      <IconFile :size="16" />
                    </button>
                    <button @click="triggerFileUpload(item._id, 'articulo')" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                      <IconUpload :size="16" />
                    </button>
                    <button @click="removeItem('articulos', item)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                      <IconTrash :size="16" />
                    </button>
                  </div>
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
                  <div class="flex items-center gap-1">
                    <button v-if="item.url_documento" @click="openDocument(item, 'libro')" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                      <IconFile :size="16" />
                    </button>
                    <button @click="triggerFileUpload(item._id, 'libro')" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                      <IconUpload :size="16" />
                    </button>
                    <button @click="removeItem('libros', item)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                      <IconTrash :size="16" />
                    </button>
                  </div>
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
                  <div class="flex items-center gap-1">
                    <button v-if="item.url_documento" @click="openDocument(item, 'ponencia')" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                      <IconFile :size="16" />
                    </button>
                    <button @click="triggerFileUpload(item._id, 'ponencia')" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                      <IconUpload :size="16" />
                    </button>
                    <button @click="removeItem('ponencias', item)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                      <IconTrash :size="16" />
                    </button>
                  </div>
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
                  <div class="flex items-center gap-1">
                    <button v-if="item.url_documento" @click="openDocument(item, 'tesis')" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                      <IconFile :size="16" />
                    </button>
                    <button @click="triggerFileUpload(item._id, 'tesis')" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                      <IconUpload :size="16" />
                    </button>
                    <button @click="removeItem('tesis', item)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                      <IconTrash :size="16" />
                    </button>
                  </div>
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
                  <div class="flex items-center gap-1">
                    <button v-if="item.url_documento" @click="openDocument(item, 'proyecto')" class="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors" title="Ver documento">
                      <IconFile :size="16" />
                    </button>
                    <button @click="triggerFileUpload(item._id, 'proyecto')" class="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Subir documento">
                      <IconUpload :size="16" />
                    </button>
                    <button @click="removeItem('proyectos', item)" class="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="Eliminar">
                      <IconTrash :size="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <div class="modal fade" id="investigacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-2xl overflow-hidden p-0">
          <AgregarInvestigacion @investigacion-added="handleInvestigacionAdded" />
        </div>
      </div>
    </div>

    <input type="file" ref="fileInput" accept="application/pdf" class="hidden" @change="handleFileSelect" />
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
import DossierService from "@/services/dossier/DossierService";
import { IconFile, IconUpload, IconTrash } from '@tabler/icons-vue';

const modal = ref(null);
const fileInput = ref(null);
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

const getSeraType = (sera) => {
  if (!sera || sera === "Enviado") return "pending";
  if (sera === "Revisado") return "reviewed";
  if (sera === "Aprobado") return "certified";
  return "denied";
};

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
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
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

const openDocument = async (item, tipo) => {
  try {
    const response = await DossierService.downloadDocument(tipo, item._id);
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
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
