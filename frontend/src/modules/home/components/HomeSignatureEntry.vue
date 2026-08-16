<template>
  <section id="signature-home" class="flex flex-col gap-6">
    <section v-if="error" class="deasy-alert deasy-alert--danger">
      {{ error }}
    </section>

    <section id="signature-launchers" class="rounded-xl border border-line bg-white shadow-line/30">
      <FirmarPdf
        :show-start-heading="false"
        :enable-home-shortcuts="true"
        @open-general-multisigner="openGeneralMultiSignerModal"
        @open-home-multisigner="openAllPendingInMultiSigner"
        @open-home-pending="openPendingModal"
        @open-sign-modal="handleOpenSignModal"
        @open-request-modal="handleOpenRequestModal"
      />
    </section>

    <AppModalShell
      controlled
      :open="signModalOpen"
      labelled-by="home-signature-sign-modal"
      size="xl"
      dialog-class="max-w-[108rem]"
      content-class="flex max-h-[calc(100vh-4rem)] flex-col"
      body-class="flex-1 min-h-0 overflow-y-auto p-0"
      @close="closeSignModal"
    >
      <template #header>
        <div id="home-signature-sign-modal" class="flex min-w-0 flex-1 items-center gap-4">
          <div class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--info">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21h-7a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v7"></path><path d="M14 19l2 2l4 -4"></path><path d="M9 7h4"></path><path d="M9 11h4"></path></svg>
          </div>
          <div class="min-w-0">
            <div class="deasy-eyebrow">Firmador singular</div>
            <div class="truncate text-base font-bold text-strong">Firmar documento</div>
          </div>
        </div>
      </template>
      <div class="flex min-h-0 flex-col px-4 pb-4 pt-2">
        <FirmarPdf
          ref="signModalRef"
          embedded
          :show-start-heading="false"
          launcher-mode="sign"
          @request-close="closeSignModal"
        />
      </div>
    </AppModalShell>

    <AppModalShell
      controlled
      :open="requestModalOpen"
      labelled-by="home-signature-request-modal"
      size="xl"
      dialog-class="max-w-[108rem]"
      content-class="flex max-h-[calc(100vh-4rem)] flex-col"
      body-class="flex-1 min-h-0 overflow-y-auto p-0"
      @close="closeRequestModal"
    >
      <template #header>
        <div id="home-signature-request-modal" class="flex min-w-0 flex-1 items-center gap-4">
          <div class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--success">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14l11 -11"></path><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7.5l-7.5 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"></path></svg>
          </div>
          <div class="min-w-0">
            <div class="deasy-eyebrow">Solicitud singular</div>
            <div class="truncate text-base font-bold text-strong">Solicitar firmas</div>
          </div>
        </div>
      </template>
      <div class="flex min-h-0 flex-col px-4 pb-4 pt-2">
        <FirmarPdf
          ref="requestModalRef"
          embedded
          :show-start-heading="false"
          launcher-mode="request"
          @request-close="closeRequestModal"
        />
      </div>
    </AppModalShell>

    <AppModalShell
      controlled
      :open="generalMultiSignerOpen"
      labelled-by="home-signature-general-multisigner-modal"
      size="xl"
      dialog-class="max-w-[108rem]"
      content-class="flex max-h-[calc(100vh-4rem)] flex-col"
      body-class="flex-1 min-h-0 overflow-y-auto p-0"
      footer-class="justify-center"
      @close="closeGeneralMultiSignerModal"
    >
      <template #header>
        <div id="home-signature-general-multisigner-modal" class="flex min-w-0 flex-1 items-center gap-4">
          <div class="flex min-w-0 max-w-[22rem] items-center gap-3">
            <div class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--info">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3v4a1 1 0 0 0 1 1h4"></path><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2"></path><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path></svg>
            </div>
            <div class="min-w-0">
              <div class="deasy-eyebrow">Previsualizando PDF</div>
              <div class="truncate text-base font-bold text-strong" :title="generalMultiSignerHeader.documentName">{{ formatHeaderFileName(generalMultiSignerHeader.documentName) }}</div>
            </div>
          </div>
        </div>
      </template>
      <div class="flex min-h-0 flex-col px-4 pb-4 pt-2">
        <div class="flex min-h-0 flex-1 flex-col">
          <FirmarPdf
            v-if="generalMultiSignerOpen"
            ref="generalMultiSignerRef"
            embedded
            multi-only
            @close-multi="closeGeneralMultiSignerModal"
            @batch-finished="handleGeneralBatchFinished"
            @multi-header-update="updateGeneralMultiSignerHeader"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex w-full flex-wrap items-center justify-center gap-3">
          <AppCounterNavigator
            label="Documento"
            editable
            :model-value="generalMultiSignerHeader.documentInput"
            :min="1"
            :current="generalMultiSignerHeader.documentCurrent"
            :total="generalMultiSignerHeader.documentTotal"
            :previous-disabled="!generalMultiSignerHeader.canPrevDocument"
            :next-disabled="!generalMultiSignerHeader.canNextDocument"
            previous-title="Documento anterior"
            next-title="Siguiente documento"
            @update:modelValue="generalMultiSignerHeader.documentInput = $event"
            @previous="generalMultiSignerRef?.multiPrevDocument?.()"
            @next="generalMultiSignerRef?.multiNextDocument?.()"
            @submit="generalMultiSignerRef?.multiGoToDocument?.(generalMultiSignerHeader.documentInput)"
          />
          <AppCounterNavigator
            label="Página"
            editable
            :model-value="generalMultiSignerHeader.pageInput"
            :min="1"
            :current="generalMultiSignerHeader.pageCurrent"
            :total="generalMultiSignerHeader.pageTotal"
            :previous-disabled="!generalMultiSignerHeader.canPrevPage"
            :next-disabled="!generalMultiSignerHeader.canNextPage"
            previous-title="Página anterior"
            next-title="Página siguiente"
            @update:modelValue="generalMultiSignerHeader.pageInput = $event"
            @previous="generalMultiSignerRef?.multiPrevPage?.()"
            @next="generalMultiSignerRef?.multiNextPage?.()"
            @submit="generalMultiSignerRef?.multiGoToPage?.(generalMultiSignerHeader.pageInput)"
          />
        </div>
      </template>
    </AppModalShell>

    <AppModalShell
      controlled
      :open="pendingModalOpen"
      labelled-by="home-signature-pending-modal"
      size="xl"
      title="Documentos pendientes por firma"
      body-class="px-0 py-0"
      @close="closePendingModal"
    >
      <div class="flex flex-col gap-5 p-6">
        <div class="deasy-filter-shell">
          <div class="deasy-filter-grid xl:grid-cols-5">
            <label class="deasy-filter-field xl:col-span-2">
            <span class="sr-only">Buscar</span>
            <input
              v-model="tableFilters.query"
              type="text"
              placeholder="Documento, proceso, unidad o paso"
              class="deasy-filter-search-input"
            />
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Año</span>
            <select v-model="tableFilters.year" class="deasy-filter-control">
              <option value="all">Año</option>
              <option v-for="option in yearOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Unidad</span>
            <select v-model="tableFilters.unit" class="deasy-filter-control">
              <option value="all">Unidad</option>
              <option v-for="option in unitOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="deasy-filter-field">
            <span class="sr-only">Proceso</span>
            <select v-model="tableFilters.process" class="deasy-filter-control">
              <option value="all">Proceso</option>
              <option v-for="option in processOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          </div>
          <div class="deasy-filter-toolbar">
          <div class="deasy-filter-summary">
            Seleccionados: <span class="font-bold text-body">{{ selectedItems.length }}</span>
          </div>
          <div class="deasy-filter-actions">
            <AppButton variant="secondary" icon-only size="sm" @click="resetTableFilters" title="Limpiar filtros" aria-label="Limpiar filtros"><font-awesome-icon icon="times" /></AppButton>
            <AppButton variant="primary" size="sm" :disabled="pendingPreparation" @click="openSelectedInMultiSigner">
              {{ pendingPreparation ? "Preparando..." : "Enviar al multifirmador" }}
            </AppButton>
          </div>
        </div>
        </div>

        <AppDataTable
          :fields="tableFields"
          :rows="filteredItems"
          :row-key="(row) => `home-signature-${row.signature_request_id}`"
          empty-text="No hay documentos pendientes por firma."
          actions-label="Acciones"
        >
          <template #cell="{ row, field }">
            <template v-if="field.name === 'select'">
              <input
                type="checkbox"
                aria-label="Seleccionar documento"
                class="h-4 w-4 rounded border-line-strong text-info"
                :checked="isSelected(row)"
                @change="toggleSelection(row)"
              />
            </template>
            <template v-else-if="field.name === 'document'">
              <div class="flex flex-col gap-1">
                <strong class="text-sm font-bold text-strong">{{ row.template_artifact_name || row.definition_name || `Documento #${row.document_id}` }}</strong>
                <span class="text-xs font-medium text-muted">{{ row.document_version ? `v${row.document_version}` : "Sin versión" }}</span>
              </div>
            </template>
            <template v-else-if="field.name === 'process'">{{ row.process_name }}</template>
            <template v-else-if="field.name === 'unit'">{{ row.unit_label || "Sin unidad" }}</template>
            <template v-else-if="field.name === 'period'">{{ row.term_name || "Sin periodo" }}</template>
            <template v-else-if="field.name === 'requested'">{{ formatDateTime(row.requested_at) }}</template>
            <template v-else-if="field.name === 'step'">
              <AppTag variant="warning">{{ row.step_name || `Paso ${row.step_order || "s/n"}` }}</AppTag>
            </template>
          </template>
          <template #actions="{ row }">
            <div class="flex flex-wrap justify-end gap-2">
              <AppButton variant="softNeutral" size="sm" :disabled="rowActionLoading[row.signature_request_id] === 'preview'" @click="previewItem(row)">
                Ver PDF
              </AppButton>
              <AppButton variant="softPrimary" size="sm" :disabled="rowActionLoading[row.signature_request_id] === 'download'" @click="downloadItem(row)">
                Descargar
              </AppButton>
            </div>
          </template>
        </AppDataTable>
      </div>
    </AppModalShell>

    <AppModalShell
      controlled
      :open="multiSignerOpen"
      labelled-by="home-signature-multisigner-modal"
      size="xl"
      dialog-class="max-w-[108rem]"
      content-class="flex max-h-[calc(100vh-4rem)] flex-col"
      body-class="flex-1 min-h-0 overflow-y-auto p-0"
      footer-class="justify-center"
      @close="closeMultiSignerModal"
    >
      <template #header>
        <div id="home-signature-multisigner-modal" class="flex min-w-0 flex-1 items-center gap-4">
          <div class="flex min-w-0 max-w-[22rem] items-center gap-3">
            <div class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--info">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3v4a1 1 0 0 0 1 1h4"></path><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2"></path><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path></svg>
            </div>
            <div class="min-w-0">
              <div class="deasy-eyebrow">Previsualizando PDF</div>
              <div class="truncate text-base font-bold text-strong" :title="pendingMultiSignerHeader.documentName">{{ formatHeaderFileName(pendingMultiSignerHeader.documentName) }}</div>
            </div>
          </div>
        </div>
      </template>
      <div class="flex min-h-0 flex-col px-4 pb-4 pt-2">
        <div v-if="multiSignerError" class="deasy-alert deasy-alert--danger mb-4">
          {{ multiSignerError }}
        </div>
        <div v-if="pendingPreparation" class="rounded-2xl border border-line bg-surface p-5 text-sm font-bold text-icon">
          Preparando documentos del lote...
        </div>
        <div v-else class="flex min-h-0 flex-1 flex-col">
          <FirmarPdf
            ref="multiSignerRef"
            embedded
            multi-only
            @close-multi="closeMultiSignerModal"
            @batch-finished="handleBatchFinished"
            @multi-header-update="updatePendingMultiSignerHeader"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex w-full flex-wrap items-center justify-center gap-3">
          <AppCounterNavigator
            label="Documento"
            editable
            :model-value="pendingMultiSignerHeader.documentInput"
            :min="1"
            :current="pendingMultiSignerHeader.documentCurrent"
            :total="pendingMultiSignerHeader.documentTotal"
            :previous-disabled="!pendingMultiSignerHeader.canPrevDocument"
            :next-disabled="!pendingMultiSignerHeader.canNextDocument"
            previous-title="Documento anterior"
            next-title="Siguiente documento"
            @update:modelValue="pendingMultiSignerHeader.documentInput = $event"
            @previous="multiSignerRef?.multiPrevDocument?.()"
            @next="multiSignerRef?.multiNextDocument?.()"
            @submit="multiSignerRef?.multiGoToDocument?.(pendingMultiSignerHeader.documentInput)"
          />
          <AppCounterNavigator
            label="Página"
            editable
            :model-value="pendingMultiSignerHeader.pageInput"
            :min="1"
            :current="pendingMultiSignerHeader.pageCurrent"
            :total="pendingMultiSignerHeader.pageTotal"
            :previous-disabled="!pendingMultiSignerHeader.canPrevPage"
            :next-disabled="!pendingMultiSignerHeader.canNextPage"
            previous-title="Página anterior"
            next-title="Página siguiente"
            @update:modelValue="pendingMultiSignerHeader.pageInput = $event"
            @previous="multiSignerRef?.multiPrevPage?.()"
            @next="multiSignerRef?.multiNextPage?.()"
            @submit="multiSignerRef?.multiGoToPage?.(pendingMultiSignerHeader.pageInput)"
          />
        </div>
      </template>
    </AppModalShell>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppCounterNavigator from "@/shared/components/widgets/AppCounterNavigator.vue";
import FirmarPdf from "@/modules/firmas/components/FirmarPdf.vue";
import ProcessDefinitionPanelService from "@/core/services/ProcessDefinitionPanelService.js";

const emit = defineEmits(["refresh-home"]);
const processPanelService = new ProcessDefinitionPanelService();
const HEADER_FILE_NAME_LIMIT = 20;

const createEmptyMultiHeader = () => ({
  documentName: "",
  documentInput: 1,
  documentCurrent: 1,
  documentTotal: 1,
  canPrevDocument: false,
  canNextDocument: false,
  pageInput: 1,
  pageCurrent: 1,
  pageTotal: 1,
  canPrevPage: false,
  canNextPage: false
});

const currentUser = ref(null);
const loading = ref(false);
const error = ref("");
const items = ref([]);
const selectedIds = ref([]);
const pendingModalOpen = ref(false);
const generalMultiSignerOpen = ref(false);
const multiSignerOpen = ref(false);
const signModalOpen = ref(false);
const requestModalOpen = ref(false);
const pendingPreparation = ref(false);
const multiSignerError = ref("");
const rowActionLoading = ref({});
const signModalRef = ref(null);
const requestModalRef = ref(null);
const generalMultiSignerRef = ref(null);
const multiSignerRef = ref(null);
const generalMultiSignerHeader = ref(createEmptyMultiHeader());
const pendingMultiSignerHeader = ref(createEmptyMultiHeader());

const tableFilters = ref({
  query: "",
  year: "all",
  unit: "all",
  process: "all",
});

const tableFields = [
  { name: "select", label: "" },
  { name: "document", label: "Documento" },
  { name: "process", label: "Proceso" },
  { name: "unit", label: "Unidad" },
  { name: "period", label: "Periodo" },
  { name: "requested", label: "Solicitado" },
  { name: "step", label: "Paso" },
];

const yearOptions = computed(() => uniqueOptions(items.value, "term_year").sort((a, b) => Number(b) - Number(a)));
const unitOptions = computed(() => uniqueOptions(items.value, "unit_label"));
const processOptions = computed(() => uniqueOptions(items.value, "process_name"));

const filteredItems = computed(() => {
  const filters = tableFilters.value;
  const query = String(filters.query || "").trim().toLowerCase();
  return items.value.filter((item) => {
    if (filters.year !== "all" && String(item.term_year || "") !== String(filters.year)) return false;
    if (filters.unit !== "all" && String(item.unit_label || "") !== String(filters.unit)) return false;
    if (filters.process !== "all" && String(item.process_name || "") !== String(filters.process)) return false;
    if (query) {
      const haystack = [
        item.template_artifact_name,
        item.definition_name,
        item.process_name,
        item.unit_label,
        item.term_name,
        item.step_name,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
});

const selectedItems = computed(() => {
  const selected = new Set(selectedIds.value.map((value) => Number(value)));
  return filteredItems.value.filter((item) => selected.has(Number(item.signature_request_id)));
});

const readCurrentUser = () => {
  try {
    currentUser.value = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    currentUser.value = null;
  }
};

const currentUserId = computed(() => currentUser.value?.id || currentUser.value?._id || null);

const uniqueOptions = (rows, key) => {
  const values = new Set(
    (rows || []).map((row) => String(row?.[key] || "").trim()).filter(Boolean)
  );
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

const resetTableFilters = () => {
  tableFilters.value = {
    query: "",
    year: "all",
    unit: "all",
    process: "all",
  };
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("es-EC", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatHeaderFileName = (value = "") => {
  const normalized = String(value || "");
  if (normalized.length <= HEADER_FILE_NAME_LIMIT) return normalized;
  return `${normalized.slice(0, HEADER_FILE_NAME_LIMIT)}...`;
};

const loadSignatureCenter = async () => {
  const userId = Number(currentUserId.value || 0);
  if (!userId) return;
  loading.value = true;
  error.value = "";
  try {
    const response = await processPanelService.getSignatureCenter(userId);
    items.value = Array.isArray(response?.signatures) ? response.signatures : [];
    selectedIds.value = [];
  } catch (loadError) {
    items.value = [];
    error.value = loadError?.response?.data?.message || loadError?.message || "No se pudo cargar la bandeja de firmas.";
  } finally {
    loading.value = false;
  }
};

const isSelected = (row) => selectedIds.value.includes(Number(row.signature_request_id));

const toggleSelection = (row) => {
  const next = new Set(selectedIds.value.map((value) => Number(value)));
  const signatureRequestId = Number(row.signature_request_id);
  if (!signatureRequestId) return;
  if (next.has(signatureRequestId)) next.delete(signatureRequestId);
  else next.add(signatureRequestId);
  selectedIds.value = Array.from(next);
};

const buildDownloadContext = (item) => ({
  processDefinitionId: Number(item.process_definition_id || 0),
  taskItemId: Number(item.task_item_id || 0),
  documentId: Number(item.document_id || 0) || null,
  preloadFilePath: item.preloadFilePath || item.preload_file_path || item.final_file_path || item.working_file_path || "",
  finalFilePath: item.final_file_path || "",
  name: item.template_artifact_name || item.definition_name || `documento-${item.document_id || item.signature_request_id}`,
});

const getFileNameFromPath = (filePath = "", fallback = "documento.pdf") => {
  const fileName = String(filePath || "").split("/").pop();
  return fileName || fallback;
};

const fetchItemBlob = async (item) => {
  const userId = Number(currentUserId.value || 0);
  const context = buildDownloadContext(item);
  return processPanelService.downloadDeliverableFile(
    userId,
    context.processDefinitionId,
    context.taskItemId,
    context.finalFilePath ? "final" : "working",
    { documentId: context.documentId }
  );
};

const downloadBlob = (blob, fileName) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

const setRowActionLoading = (signatureRequestId, action) => {
  rowActionLoading.value = {
    ...rowActionLoading.value,
    [signatureRequestId]: action,
  };
};

const clearRowActionLoading = (signatureRequestId) => {
  const next = { ...rowActionLoading.value };
  delete next[signatureRequestId];
  rowActionLoading.value = next;
};

const previewItem = async (item) => {
  const key = Number(item.signature_request_id || 0);
  try {
    setRowActionLoading(key, "preview");
    const blob = await fetchItemBlob(item);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (previewError) {
    error.value = previewError?.response?.data?.message || previewError?.message || "No se pudo abrir el PDF del documento.";
  } finally {
    clearRowActionLoading(key);
  }
};

const downloadItem = async (item) => {
  const key = Number(item.signature_request_id || 0);
  const context = buildDownloadContext(item);
  try {
    setRowActionLoading(key, "download");
    const blob = await fetchItemBlob(item);
    downloadBlob(blob, getFileNameFromPath(context.preloadFilePath, `${context.name}.pdf`));
  } catch (downloadError) {
    error.value = downloadError?.response?.data?.message || downloadError?.message || "No se pudo descargar el documento.";
  } finally {
    clearRowActionLoading(key);
  }
};

const buildMultiSignerDocument = async (item) => {
  const blob = await fetchItemBlob(item);
  const context = buildDownloadContext(item);
  const fileName = getFileNameFromPath(context.preloadFilePath, `${context.name}.pdf`);
  return {
    file: new File([blob], fileName, { type: "application/pdf" }),
    metadata: {
      signatureRequestId: Number(item.signature_request_id || 0) || null,
      documentId: Number(item.document_id || 0) || null,
      documentVersionId: Number(item.document_version_id || 0) || null,
      processName: item.process_name || "",
      unitLabel: item.unit_label || "",
      termName: item.term_name || "",
      termYear: item.term_year ? String(item.term_year) : "",
      termTypeName: item.term_type_name || "",
      stepName: item.step_name || "",
      requestedAt: item.requested_at || "",
    },
  };
};

const openPendingModal = () => {
  pendingModalOpen.value = true;
};

const closePendingModal = () => {
  pendingModalOpen.value = false;
};

const openSignModal = async (files = []) => {
  if (!files.length) return;
  await signModalRef.value?.resetToStart?.();
  await signModalRef.value?.openSingleFlowWithFiles?.(files, "sign");
  signModalOpen.value = true;
};

const closeSignModal = () => {
  signModalOpen.value = false;
  signModalRef.value?.resetToStart?.();
};

const openRequestModal = async (files = []) => {
  if (!files.length) return;
  await requestModalRef.value?.resetToStart?.();
  await requestModalRef.value?.openSingleFlowWithFiles?.(files, "request");
  requestModalOpen.value = true;
};

const closeRequestModal = () => {
  requestModalOpen.value = false;
  requestModalRef.value?.resetToStart?.();
};

const handleOpenSignModal = async (payload = {}) => {
  await openSignModal(Array.isArray(payload?.files) ? payload.files : []);
};

const handleOpenRequestModal = async (payload = {}) => {
  await openRequestModal(Array.isArray(payload?.files) ? payload.files : []);
};

const openGeneralMultiSignerModal = async (payload = {}) => {
  generalMultiSignerOpen.value = true;
  generalMultiSignerHeader.value = createEmptyMultiHeader();
  await nextTick();
  const files = Array.isArray(payload?.files) ? payload.files : [];
  if (files.length) {
    generalMultiSignerRef.value?.openMultiSignerWithFiles?.(files);
  }
};

const closeGeneralMultiSignerModal = () => {
  generalMultiSignerOpen.value = false;
  generalMultiSignerHeader.value = createEmptyMultiHeader();
};

const closeMultiSignerModal = () => {
  multiSignerOpen.value = false;
  multiSignerError.value = "";
  pendingPreparation.value = false;
  pendingMultiSignerHeader.value = createEmptyMultiHeader();
  multiSignerRef.value?.resetToStart?.();
};

const updateGeneralMultiSignerHeader = (payload = {}) => {
  generalMultiSignerHeader.value = {
    ...createEmptyMultiHeader(),
    ...payload
  };
};

const updatePendingMultiSignerHeader = (payload = {}) => {
  pendingMultiSignerHeader.value = {
    ...createEmptyMultiHeader(),
    ...payload
  };
};

const openMultiSignerWithItems = async (targetItems) => {
  multiSignerOpen.value = true;
  pendingPreparation.value = false;
  multiSignerError.value = "";
  pendingMultiSignerHeader.value = createEmptyMultiHeader();

  if (!targetItems.length) {
    await nextTick();
    multiSignerRef.value?.resetToStart?.();
    multiSignerError.value = "No hay documentos pendientes disponibles para cargar desde base de datos.";
    return;
  }

  pendingPreparation.value = true;

  try {
    const documents = [];
    for (const item of targetItems) {
      documents.push(await buildMultiSignerDocument(item));
    }
    pendingPreparation.value = false;
    await nextTick();
    multiSignerRef.value?.openMultiSignerWithFiles?.([], {
      documents,
      allowManualUpload: false,
      enableDocumentFilters: true,
    });
  } catch (prepareError) {
    multiSignerError.value = prepareError?.response?.data?.message || prepareError?.message || "No se pudieron preparar los documentos del lote.";
    pendingPreparation.value = false;
    await nextTick();
    multiSignerRef.value?.resetToStart?.();
  }
};

const openSelectedInMultiSigner = async () => {
  closePendingModal();
  await openMultiSignerWithItems(selectedItems.value);
};

const openAllPendingInMultiSigner = async () => {
  await openMultiSignerWithItems(filteredItems.value);
};

const handleBatchFinished = async () => {
  await loadSignatureCenter();
  emit("refresh-home", { source: "pending-multisigner" });
};

const handleGeneralBatchFinished = async () => {
  await loadSignatureCenter();
  emit("refresh-home", { source: "general-multisigner" });
};

onMounted(async () => {
  readCurrentUser();
  await loadSignatureCenter();
});
</script>
