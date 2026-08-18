<template>
  <AppWorkspaceShell
    :menu-open="menuOpen"
    :show-notify="showNotify"
    current-section="documents"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Centro documental"
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="router.push({ name: 'home-signatures' })"
    @primary-nav="revealSidebarForNav"
  >
    <template #header>
      <AppContextHeader title="Centro documental" />
    </template>

    <template #sidebar>
      <HomeSidebar
        :menu-loading="false"
        menu-error=""
        :workspace-icon-tone-class="workspaceIconToneClass"
        @open-section="openWorkspaceSection"
      />
    </template>

    <section class="flex flex-col gap-6">
      <!-- Panel de supervisión (solo visible si el usuario encabeza alguna unidad). -->
      <SupervisorStuckPanel />

      <!-- Fallos de descarga/vista previa. Mismo patrón que HomeView: aviso inline, no toast. -->
      <AppAlert v-if="actionError">
        {{ actionError }}
      </AppAlert>

      <section class="bg-white rounded-xl shadow-line/40 p-5 md:p-6 border border-line flex flex-col gap-5">
        <div class="deasy-filter-shell">
          <div class="deasy-filter-grid">
            <label class="deasy-filter-field deasy-filter-search-span">
              <span class="sr-only">Buscar</span>
              <input v-model="filters.query" type="text" placeholder="Documento, proceso, unidad o periodo" class="deasy-control" />
            </label>
            <label class="deasy-filter-field">
              <span class="sr-only">Año</span>
              <select v-model="filters.year" class="deasy-control">
                <option value="all">Año</option>
                <option v-for="option in filterYears" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="deasy-filter-field">
              <span class="sr-only">Tipo de periodo</span>
              <select v-model="filters.termType" class="deasy-control">
                <option value="all">Tipo de periodo</option>
                <option v-for="option in filterTermTypes" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="deasy-filter-field">
              <span class="sr-only">Unidad</span>
              <select v-model="filters.unit" class="deasy-control">
                <option value="all">Unidad</option>
                <option v-for="option in filterUnits" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
            <label class="deasy-filter-field">
              <span class="sr-only">Proceso</span>
              <select v-model="filters.process" class="deasy-control">
                <option value="all">Proceso</option>
                <option v-for="option in filterProcesses" :key="option" :value="option">{{ option }}</option>
              </select>
            </label>
          </div>
          <div class="deasy-filter-toolbar">
            <div class="deasy-filter-summary">Documentos visibles: <span class="font-bold text-body">{{ filteredItems.length }}</span></div>
            <div class="deasy-filter-actions">
              <AppButton variant="neutral-outline" icon-only @click="resetFilters" title="Limpiar filtros" aria-label="Limpiar filtros"><font-awesome-icon icon="times" /></AppButton>
              <AppButton variant="primary-outline" icon-only @click="load" title="Actualizar" aria-label="Actualizar"><font-awesome-icon icon="rotate-right" /></AppButton>
            </div>
          </div>
        </div>

        <section v-if="loading" class="rounded-2xl border border-line bg-surface p-5 text-sm font-bold text-icon">
          Cargando centro documental...
        </section>
        <AppAlert v-else-if="error">
          {{ error }}
        </AppAlert>
        <AppDataTable
          v-else
          :fields="DOCUMENT_FIELDS"
          :rows="filteredItems"
          :row-key="(row) => `document-center-${row.document_id}`"
          empty-text="No hay documentos para mostrar."
          actions-label="Acciones"
        >
          <template #cell="{ row, field }">
            <template v-if="field.name === 'document'">
              <div class="flex flex-col gap-1">
                <strong class="text-sm font-bold text-strong">{{ row.template_artifact_name || row.definition_name || `Documento #${row.document_id}` }}</strong>
                <span class="text-xs font-medium text-muted">{{ row.document_version ? `v${row.document_version}` : 'Sin versión' }}</span>
              </div>
            </template>
            <template v-else-if="field.name === 'process'">{{ row.process_name }}</template>
            <template v-else-if="field.name === 'unit'">{{ row.unit_label || 'Sin unidad' }}</template>
            <template v-else-if="field.name === 'period'">{{ row.term_name || 'Sin periodo' }}</template>
            <template v-else-if="field.name === 'status'">
              <AppTag :variant="row.pending_signature_count ? 'warning' : row.pending_fill_count ? 'info' : 'neutral'">
                {{ row.document_version_status || row.document_status || 'Sin estado' }}
              </AppTag>
            </template>
          </template>
          <template #actions="{ row }">
            <div class="flex flex-wrap justify-end gap-2">
              <AppButton v-if="row.preloadPdfPath" variant="neutral-soft" @click="previewFile(toPayload(row))">
                Ver PDF
              </AppButton>
              <AppButton v-if="row.preloadFilePath" variant="primary-soft" @click="downloadFile(toPayload(row))">
                Descargar
              </AppButton>
            </div>
          </template>
        </AppDataTable>
      </section>
    </section>

    <!-- Sin slot #actions: esta pantalla no tiene el flujo de llenado a mano, así que el modal sale como
         vista previa + descarga. Es lo que ya ocurría --las filas no traen `actions` ni `workflow`--,
         pero ahora por construcción en vez de por casualidad. -->
    <DeliverablePreviewModal
      ref="previewModal"
      :name="previewName"
      :url="previewUrl"
      :is-pdf="previewIsPdf"
      @download="downloadPreviewed"
    />

  </AppWorkspaceShell>
</template>

<script setup>
/**
 * Centro documental: /home/documentos.
 *
 * Era una rama `v-if` dentro de HomeView, que servia tres rutas con un solo componente de 5500 lineas.
 * Con esto HomeView deja de saber en que ruta esta.
 *
 * `buildDeliverableSubject` se llama SIN fallbacks a proposito: esta pantalla no tiene proceso
 * seleccionado, asi que processId y scopeUnitId se quedan en null. Antes heredaba los del proceso que
 * HomeView tuviera abierto --funcionaba de casualidad porque las filas traen su propio process_id--.
 */
import { computed, onMounted, ref } from "vue";
import AppContextHeader from "@/shared/components/layout/AppContextHeader.vue";
import { useRouter } from "vue-router";
import AppWorkspaceShell from "@/layouts/workspace/AppWorkspaceShell.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import HomeSidebar from "@/modules/home/components/HomeSidebar.vue";
import SupervisorStuckPanel from "@/modules/home/components/SupervisorStuckPanel.vue";
import DeliverablePreviewModal from "@/modules/home/components/DeliverablePreviewModal.vue";
import { useWorkspaceChrome } from "@/shared/composables/useWorkspaceChrome.js";
import { useDocumentCenter } from "@/modules/home/composables/useDocumentCenter.js";
import { useDeliverableFilePreview } from "@/modules/home/composables/useDeliverableFilePreview.js";
import { buildDeliverableSubject } from "@/shared/utils/deliverableSubject.js";
import { workspaceIconToneClass } from "@/shared/utils/workspaceNavIcons.js";
import { getStoredUser } from "@/core/utils/accessControl.js";
import ProcessDefinitionPanelService from "@/core/services/ProcessDefinitionPanelService";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

const DOCUMENT_FIELDS = [
  { name: "document", label: "Documento" },
  { name: "process", label: "Proceso" },
  { name: "unit", label: "Unidad" },
  { name: "period", label: "Periodo" },
  { name: "status", label: "Estado" }
];

const router = useRouter();
const processPanelService = new ProcessDefinitionPanelService();

const { menuOpen, showNotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome();

const currentUser = computed(() => getStoredUser());
const currentUserId = computed(() => currentUser.value?.id || currentUser.value?._id || null);
const userPhoto = computed(() => currentUser.value?.photo || "/images/avatar.png");
const userFullName = computed(() => {
  const firstName = currentUser.value?.first_name ?? "";
  const lastName = currentUser.value?.last_name ?? "";
  return `${firstName} ${lastName}`.trim() || "Usuario";
});

const actionError = ref("");

const { filters, filteredItems, filterYears, filterTermTypes, filterUnits, filterProcesses, loading, error, resetFilters, load } =
  useDocumentCenter({
    fetchDocuments: (userId) => processPanelService.getDocumentCenter(userId),
    userId: currentUserId
  });

/** La fila del centro ya trae todo lo que la descarga necesita: itemId, definicion y documento. */
const toPayload = (item = {}) => ({
  id: item.task_item_id,
  itemId: item.task_item_id,
  task_id: item.task_id,
  process_definition_id: item.process_definition_id,
  process_id: item.process_id,
  document_id: item.document_id,
  document_version_id: item.document_version_id,
  document_version: item.document_version,
  document_status: item.document_status || item.document_version_status,
  working_file_path: item.working_file_path,
  final_file_path: item.final_file_path,
  template_artifact_name: item.template_artifact_name || item.definition_name,
  title: item.template_artifact_name || item.definition_name || `Documento #${item.document_id}`
});

const {
  previewModal,
  previewUrl,
  previewName,
  previewIsPdf,
  previewFile,
  downloadFile,
  downloadPreviewed
} = useDeliverableFilePreview({
  getSubject: (payload) => buildDeliverableSubject(payload),
  fetchBlob: (payload, kind) => {
    const subject = buildDeliverableSubject(payload);
    return processPanelService.downloadDeliverableFile(
      currentUserId.value,
      Number(subject.processDefinitionId),
      subject.itemId,
      kind,
      { documentId: subject.documentId || null }
    );
  },
  onError: (message) => {
    actionError.value = message;
  }
});

const openWorkspaceSection = (key) => {
  const destinos = {
    signatures: { name: "home-signatures" },
    documents: { name: "home-documents" },
    dossier: { name: "perfil" }
  };
  router.push(destinos[key] || { name: "home", query: { section: key } });
};

onMounted(load);
</script>
