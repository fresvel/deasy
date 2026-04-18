<template>
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
      title="Referencias"
      subtitle="Agrega referencias laborales, familiares y personales."
      @add="openModal"
    >
      <!-- Laborales -->
      <ProfileTableBlock title="Referencias laborales">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REFERENCIA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CARGO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CORREO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TELÉFONO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">INSTITUCIÓN</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="referenciasLaborales.length === 0" class="border-b border-slate-100">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">No hay referencias laborales registradas</td>
              </tr>
              <tr v-for="ref in referenciasLaborales" :key="ref._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(ref.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ ref.nombre }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.cargo_parentesco }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.email }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.telefono }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.institution }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(ref.url_documento)"
                    @edit="editarReferencia(ref)"
                    @manage-pdf="openPdfViewer(ref, 'referencia', ref.nombre)"
                    @delete="openDelete(ref)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Familiares -->
      <ProfileTableBlock title="Referencias familiares">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REFERENCIA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">PARENTESCO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CORREO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TELÉFONO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="referenciasFamiliares.length === 0" class="border-b border-slate-100">
                <td colspan="6" class="px-4 py-8 text-center text-slate-500 italic">No hay referencias familiares registradas</td>
              </tr>
              <tr v-for="ref in referenciasFamiliares" :key="ref._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(ref.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ ref.nombre }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.cargo_parentesco }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.email }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.telefono }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(ref.url_documento)"
                    @edit="editarReferencia(ref)"
                    @manage-pdf="openPdfViewer(ref, 'referencia', ref.nombre)"
                    @delete="openDelete(ref)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <!-- Personales -->
      <ProfileTableBlock title="Referencias personales">
        <div class="profile-table-shell mt-4">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">REFERENCIA</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">CORREO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">TELÉFONO</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="referenciasPersonales.length === 0" class="border-b border-slate-100">
                <td colspan="5" class="px-4 py-8 text-center text-slate-500 italic">No hay referencias personales registradas</td>
              </tr>
              <tr v-for="ref in referenciasPersonales" :key="ref._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(ref.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ ref.nombre }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.email }}</td>
                <td class="px-4 py-3 text-slate-700">{{ ref.telefono }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(ref.url_documento)"
                    @edit="editarReferencia(ref)"
                    @manage-pdf="openPdfViewer(ref, 'referencia', ref.nombre)"
                    @delete="openDelete(ref)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="referenciaModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarReferencia
            :editing-item="pendingEdit"
            @referencia-added="loadDossier"
            @referencia-updated="handleReferenciaUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="referenciaDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100" data-modal-dismiss>
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar la referencia de <strong>{{ pendingDelete?.nombre || 'seleccionada' }}</strong>?
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
import { Modal } from '@/shared/utils/modalController';
import AgregarReferencia from '@/modules/perfil/components/AgregarReferencia.vue';
import BtnSera from '@/shared/components/buttons/BtnSera.vue';
import ProfileSectionShell from '@/modules/perfil/components/ProfileSectionShell.vue';
import ProfileTableBlock from '@/modules/perfil/components/ProfileTableBlock.vue';
import DossierDocumentActions from '@/modules/perfil/components/DossierDocumentActions.vue';
import DossierPdfViewer from '@/modules/perfil/components/DossierPdfViewer.vue';
import AdminButton from '@/modules/admin/components/ui/AdminButton.vue';
import { mapDossierStatusToSeraType } from '@/modules/perfil/utils/dossierStatus';
import DossierService from '@/modules/dossier/services/DossierService';

const modal       = ref(null);
const deleteModal = ref(null);
const dossier     = ref(null);
const pendingEdit   = ref(null);
const pendingDelete = ref(null);
let modalInstance  = null;
let deleteInstance = null;

const showPdfViewer = ref(false);
const pdfViewer     = ref({ tipo: '', recordId: '', itemName: '', hasDocument: false });

const openPdfViewer = (item, tipo, itemName) => {
  pdfViewer.value = { tipo, recordId: item._id, itemName: itemName || 'Documento', hasDocument: Boolean(item.url_documento) };
  showPdfViewer.value = true;
};
const onPdfViewerUpdated = () => { showPdfViewer.value = false; loadDossier(); };
const onPdfViewerDeleted = () => { showPdfViewer.value = false; loadDossier(); };

const referenciasLaborales  = computed(() => dossier.value?.referencias?.filter(r => r.tipo === 'laboral')  || []);
const referenciasFamiliares = computed(() => dossier.value?.referencias?.filter(r => r.tipo === 'familiar') || []);
const referenciasPersonales = computed(() => dossier.value?.referencias?.filter(r => r.tipo === 'personal') || []);

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);

const loadDossier = async () => {
  try { const data = await DossierService.getDossier(); if (data.success) dossier.value = data.data; }
  catch (error) { console.error('Error al cargar dossier:', error); }
};
const openModal = () => {
  pendingEdit.value = null;
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};
const editarReferencia = (ref) => {
  pendingEdit.value = { ...ref };
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};
const handleReferenciaUpdated = () => { pendingEdit.value = null; loadDossier(); };
const openDelete = (ref) => {
  pendingDelete.value = ref;
  if (!deleteModal.value) return;
  deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
  deleteInstance.show();
};
const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try { await DossierService.deleteReferencia(pendingDelete.value._id); await loadDossier(); deleteInstance?.hide(); }
  catch (error) { console.error('Error al eliminar:', error); }
};

onMounted(() => { loadDossier(); window.addEventListener('dossier-updated', loadDossier); });
onBeforeUnmount(() => {
  modalInstance?.hide(); modalInstance?.dispose();
  deleteInstance?.hide(); deleteInstance?.dispose();
  window.removeEventListener('dossier-updated', loadDossier);
});
</script>