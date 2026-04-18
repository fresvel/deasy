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
      title="Certificaciones y reconocimientos"
      subtitle="Registra los certificados o reconocimientos relevantes para tu carrera."
      @add="openModal"
    >
      <ProfileTableBlock title="Certificaciones registradas">
        <div class="profile-table-shell">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Certificación</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Institución</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Horas</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Fecha</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Ámbito</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Descripción</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!certificaciones.length" class="border-b border-slate-100">
                <td colspan="8" class="px-4 py-8 text-center text-slate-500 italic">No has registrado certificaciones aún.</td>
              </tr>
              <tr v-for="cert in certificaciones" :key="cert._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(cert.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ cert.titulo }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cert.institution }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cert.horas || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(cert.fecha) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cert.tipo || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700 max-w-xs truncate">{{ cert.descripcion || 'N/A' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(cert.url_documento)"
                    @edit="editarCertificacion(cert)"
                    @manage-pdf="openPdfViewer(cert, 'certificacion', cert.titulo)"
                    @delete="openDelete(cert)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="certificacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarCertificacion
            :editing-item="pendingEdit"
            @certificacion-added="loadDossier"
            @certificacion-updated="handleCertificacionUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="certificacionDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100" data-modal-dismiss>
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar la certificación <strong>{{ pendingDelete?.titulo || 'seleccionada' }}</strong>?
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
import BtnSera from '@/shared/components/buttons/BtnSera.vue';
import AgregarCertificacion from '@/modules/perfil/components/AgregarCertificacion.vue';
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

const certificaciones = computed(() => dossier.value?.certificaciones || []);

const getSeraType = (sera) => mapDossierStatusToSeraType(sera);
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

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
const editarCertificacion = (cert) => {
  pendingEdit.value = { ...cert };
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};
const handleCertificacionUpdated = () => { pendingEdit.value = null; loadDossier(); };
const openDelete = (cert) => {
  pendingDelete.value = cert;
  if (!deleteModal.value) return;
  deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
  deleteInstance.show();
};
const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try { await DossierService.deleteCertificacion(pendingDelete.value._id); await loadDossier(); deleteInstance?.hide(); }
  catch (error) { console.error('Error al eliminar:', error); }
};

onMounted(() => { loadDossier(); window.addEventListener('dossier-updated', loadDossier); });
onBeforeUnmount(() => {
  modalInstance?.hide(); modalInstance?.dispose();
  deleteInstance?.hide(); deleteInstance?.dispose();
  window.removeEventListener('dossier-updated', loadDossier);
});
</script>