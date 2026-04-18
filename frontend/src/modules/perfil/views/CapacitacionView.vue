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
      title="Formación continua y conferencias"
      subtitle="Registra los eventos de capacitación docente y profesional en los que has participado."
      @add="openModal"
    >
      <ProfileTableBlock title="Capacitación en el área docente">
        <div class="profile-table-shell">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Tema</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Institución</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Horas</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">País</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Inicio</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Fin</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Rol</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!capacitacionesDocentes.length" class="border-b border-slate-100">
                <td colspan="9" class="px-4 py-8 text-center text-slate-500 italic">No has registrado capacitación docente.</td>
              </tr>
              <tr v-for="cap in capacitacionesDocentes" :key="cap._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(cap.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ cap.tema }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.institution }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.horas || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.pais || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(cap.fecha_inicio) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(cap.fecha_fin) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.rol || 'N/A' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(cap.url_documento)"
                    @edit="editarCapacitacion(cap)"
                    @manage-pdf="openPdfViewer(cap, 'formacion', cap.tema)"
                    @delete="openDelete(cap)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Capacitación profesional">
        <div class="profile-table-shell">
          <table class="w-full text-sm text-left border-collapse min-w-max">
            <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700"></th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Tema</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Institución</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Horas</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">País</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Inicio</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Fin</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Rol</th>
                <th class="px-4 py-3 font-semibold whitespace-nowrap text-left text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!capacitacionesProfesionales.length" class="border-b border-slate-100">
                <td colspan="9" class="px-4 py-8 text-center text-slate-500 italic">No has registrado capacitación profesional.</td>
              </tr>
              <tr v-for="cap in capacitacionesProfesionales" :key="cap._id" class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3"><BtnSera :type="getSeraType(cap.sera)" /></td>
                <td class="px-4 py-3 text-slate-700">{{ cap.tema }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.institution }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.horas || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.pais || 'N/A' }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(cap.fecha_inicio) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ formatDate(cap.fecha_fin) }}</td>
                <td class="px-4 py-3 text-slate-700">{{ cap.rol || 'N/A' }}</td>
                <td class="px-4 py-3">
                  <DossierDocumentActions
                    :has-document="Boolean(cap.url_documento)"
                    @edit="editarCapacitacion(cap)"
                    @manage-pdf="openPdfViewer(cap, 'formacion', cap.tema)"
                    @delete="openDelete(cap)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <!-- Modal Agregar/Editar (unificado) -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="capacitacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="profile-dialog-shell">
        <div class="profile-dialog-panel">
          <AgregarCapacitacion
            :editing-item="pendingEdit"
            @capacitacion-added="loadDossier"
            @capacitacion-updated="handleCapacitacionUpdated"
          />
        </div>
      </div>
    </div>

    <!-- Modal Eliminar -->
    <div class="profile-admin-skin profile-dialog-root" data-dialog-root id="capacitacionDeleteModal" tabindex="-1" ref="deleteModal" aria-hidden="true">
      <div class="profile-dialog-shell profile-dialog-shell--compact">
        <div class="profile-dialog-panel">
          <div class="profile-confirm-header">
            <h5 class="profile-confirm-title">Confirmar eliminación</h5>
            <button type="button" class="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100" data-modal-dismiss>
              <span class="text-xl leading-none">&times;</span>
            </button>
          </div>
          <div class="profile-confirm-body">
            ¿Deseas eliminar la capacitación <strong>{{ pendingDelete?.tema || 'seleccionada' }}</strong>?
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
import AgregarCapacitacion from '@/modules/perfil/components/AgregarCapacitacion.vue';
import BtnSera from '@/shared/components/buttons/BtnSera.vue';
import DossierService from '@/modules/dossier/services/DossierService';
import ProfileSectionShell from '@/modules/perfil/components/ProfileSectionShell.vue';
import ProfileTableBlock from '@/modules/perfil/components/ProfileTableBlock.vue';
import DossierDocumentActions from '@/modules/perfil/components/DossierDocumentActions.vue';
import DossierPdfViewer from '@/modules/perfil/components/DossierPdfViewer.vue';
import AdminButton from '@/modules/admin/components/ui/AdminButton.vue';
import { mapDossierStatusToSeraType } from '@/modules/perfil/utils/dossierStatus';

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

const capacitacionesDocentes     = computed(() => dossier.value?.formacion?.filter(c => c.tipo === 'Docente')     || []);
const capacitacionesProfesionales = computed(() => dossier.value?.formacion?.filter(c => c.tipo === 'Profesional') || []);

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
const editarCapacitacion = (cap) => {
  pendingEdit.value = { ...cap };
  if (!modal.value) return;
  modalInstance = Modal.getOrCreateInstance(modal.value);
  modalInstance.show();
};
const handleCapacitacionUpdated = () => { pendingEdit.value = null; loadDossier(); };
const openDelete = (cap) => {
  pendingDelete.value = cap;
  if (!deleteModal.value) return;
  deleteInstance = Modal.getOrCreateInstance(deleteModal.value);
  deleteInstance.show();
};
const confirmDelete = async () => {
  if (!pendingDelete.value) return;
  try { await DossierService.deleteCapacitacion(pendingDelete.value._id); await loadDossier(); deleteInstance?.hide(); }
  catch (error) { console.error('Error al eliminar:', error); }
};

onMounted(() => { loadDossier(); window.addEventListener('dossier-updated', loadDossier); });
onBeforeUnmount(() => {
  modalInstance?.hide(); modalInstance?.dispose();
  deleteInstance?.hide(); deleteInstance?.dispose();
  window.removeEventListener('dossier-updated', loadDossier);
});
</script>