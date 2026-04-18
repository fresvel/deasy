<template>
  <!-- Vista PDF de cuerpo completo -->
  <DossierPdfViewer
    v-if="showPdfViewer"
    :tipo="pdfViewer.tipo"
    :record-id="pdfViewer.recordId"
    :item-name="pdfViewer.itemName"
    :has-document="pdfViewer.hasDocument"
    @back="showPdfViewer = false"
    @document-updated="onPdfViewerUpdated"
    @document-deleted="onPdfViewerDeleted"
  />

  <div v-else class="profile-admin-skin w-full animate-fade-in">
    <ProfileSectionShell
      title="Formación Profesional"
      subtitle="Registra tu formación académica y títulos obtenidos."
      @add="openModal"
    >
      <!-- Títulos de Cuarto Nivel -->
      <ProfileTableBlock title="Títulos de Cuarto Nivel">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">N.° DE REGISTRO SENESCYT</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CAMPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="titulosCuartoNivel.length === 0" class="border-b border-slate-100">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">No hay títulos de cuarto nivel registrados</td>
              </tr>
              <tr v-for="titulo in titulosCuartoNivel" :key="titulo._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(titulo.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.ies }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.tipo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.sreg || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.campo_amplio }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.pais }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(titulo.url_documento)"
                    @edit="editarTitulo(titulo)"
                    @manage-pdf="openPdfViewer(titulo, 'titulo', titulo.titulo)"
                    @delete="openDelete(titulo)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Títulos de Grado -->
      <ProfileTableBlock title="Títulos de Grado">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">N.° DE REGISTRO SENESCYT</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CAMPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="titulosGrado.length === 0" class="border-b border-slate-100">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">No hay títulos de grado registrados</td>
              </tr>
              <tr v-for="titulo in titulosGrado" :key="titulo._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(titulo.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.ies }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.tipo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.sreg || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.campo_amplio }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.pais }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(titulo.url_documento)"
                    @edit="editarTitulo(titulo)"
                    @manage-pdf="openPdfViewer(titulo, 'titulo', titulo.titulo)"
                    @delete="openDelete(titulo)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Títulos Técnicos y Tecnológicos -->
      <ProfileTableBlock title="Títulos Técnicos y Tecnológicos">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TÍTULO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TIPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">N.° DE REGISTRO SENESCYT</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CAMPO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PAÍS</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="titulosTecnicos.length === 0" class="border-b border-slate-100">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">No hay títulos técnicos/tecnológicos registrados</td>
              </tr>
              <tr v-for="titulo in titulosTecnicos" :key="titulo._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(titulo.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.ies }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.tipo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.sreg || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.campo_amplio }}</td>
                <td class="px-4 py-3 text-slate-700">{{ titulo.pais }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(titulo.url_documento)"
                    @edit="editarTitulo(titulo)"
                    @manage-pdf="openPdfViewer(titulo, 'titulo', titulo.titulo)"
                    @delete="openDelete(titulo)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="tituloModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarTitulo
            :editing-item="pendingEdit"
            @title-added="loadDossier"
            @title-updated="handleTituloUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="tituloDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100" data-modal-dismiss>
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar el título <strong>{{ pendingDelete?.titulo || 'seleccionado' }}</strong>?
          </div>
          <div class="profile-confirm-footer">
            <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
            <AdminButton variant="danger" @click="confirmDelete">Eliminar</AdminButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import AgregarTitulo from '@/modules/perfil/components/AgregarTitulo.vue';
import BtnSera from '@/shared/components/buttons/BtnSera.vue';
import ProfileSectionShell from '@/modules/perfil/components/ProfileSectionShell.vue';
import ProfileTableBlock from '@/modules/perfil/components/ProfileTableBlock.vue';
import DossierDocumentActions from '@/modules/perfil/components/DossierDocumentActions.vue';
import DossierPdfViewer from '@/modules/perfil/components/DossierPdfViewer.vue';
import AdminButton from '@/modules/admin/components/ui/AdminButton.vue';
import { mapDossierStatusToSeraType } from '@/modules/perfil/utils/dossierStatus';
import { Modal } from '@/shared/utils/modalController';
import DossierService from '@/modules/dossier/services/DossierService';

const modal       = ref(null);
const deleteModal = ref(null);
const dossier     = ref(null);
const pendingEdit   = ref(null);
const pendingDelete = ref(null);

let modalInstance  = null;
let deleteInstance = null;

// ── PDF viewer ─────────────────────────────────────────
const showPdfViewer = ref(false);
const pdfViewer     = ref({ tipo: '', recordId: '', itemName: '', hasDocument: false });

const openPdfViewer = (item, tipo, itemName) => {
  pdfViewer.value = { tipo, recordId: item._id, itemName: itemName || 'Documento', hasDocument: Boolean(item.url_documento) };
  showPdfViewer.value = true;
};
const onPdfViewerUpdated = () => { showPdfViewer.value = false; loadDossier(); };
const onPdfViewerDeleted = () => { showPdfViewer.value = false; loadDossier(); };

// ── Computed ───────────────────────────────────────────
const titulosTecnicos = computed(() => {
  if (!dossier.value?.titulos) return [];
  return dossier.value.titulos.filter(t => t.nivel === 'Técnico' || t.nivel === 'Tecnólogo');
});
const titulosGrado = computed(() => {
  if (!dossier.value?.titulos) return [];
  return dossier.value.titulos.filter(t => t.nivel === 'Grado');
});
const titulosCuartoNivel = computed(() => {
  if (!dossier.value?.titulos) return [];
  const niveles = ['Maestría', 'Maestría Tecnológica', 'Diplomado', 'Doctorado', 'Posdoctorado'];
  return dossier.value.titulos.filter(t => niveles.includes(t.nivel));
});

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

// ── CRUD ───────────────────────────────────────────────
const loadDossier = async () => {
  try {
    const data = await DossierService.getDossier();
    if (data.success) dossier.value = data.data;
  } catch (error) { console.error('Error al cargar dossier:', error); }
};

const openModal = () => {
  pendingEdit.value = null;
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};

const editarTitulo = (titulo) => {
  pendingEdit.value = { ...titulo };
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};

const handleTituloUpdated = () => { pendingEdit.value = null; loadDossier(); };

const openDelete = (titulo) => {
  pendingDelete.value = titulo;
  if (!deleteModal.value) return;
  deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
  deleteInstance.show();
};

const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try {
    await DossierService.deleteTitulo(pendingDelete.value._id);
    await loadDossier();
    deleteInstance?.hide();
  } catch (error) { console.error('Error al eliminar:', error); }
};

onMounted(() => { loadDossier(); window.addEventListener('dossier-updated', loadDossier); });
onBeforeUnmount(() => {
  modalInstance?.hide(); modalInstance?.dispose();
  deleteInstance?.hide(); deleteInstance?.dispose();
  window.removeEventListener('dossier-updated', loadDossier);
});
</script>