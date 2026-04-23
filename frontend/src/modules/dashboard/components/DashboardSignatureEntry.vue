<template>
  <section class="flex flex-col gap-6">
    <AppPageIntro
      variant="dashboard"
      title="Firmas electrónicas"
      :meta="`${filteredItems.length} documento(s) pendiente(s)`"
      description="Centraliza la firma manual, solicitudes, validación, multifirma general y la firma de pendientes vinculados al dashboard."
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <AppButton variant="softNeutral" size="md" :disabled="loading" @click="loadSignatureCenter">
            Actualizar
          </AppButton>
        </div>
      </template>
    </AppPageIntro>

    <section v-if="error" class="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-700">
      {{ error }}
    </section>

    <section class="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/30">
      <FirmarPdf
        :show-start-heading="false"
        :enable-dashboard-shortcuts="true"
        @open-general-multisigner="openGeneralMultiSignerModal"
        @open-dashboard-multisigner="openAllPendingInMultiSigner"
        @open-dashboard-pending="openPendingModal"
      />
    </section>

    <AppModalShell
      controlled
      :open="generalMultiSignerOpen"
      labelled-by="dashboard-signature-general-multisigner-modal"
      size="xl"
      dialog-class="max-w-[108rem]"
      content-class="flex max-h-[calc(100vh-4rem)] flex-col"
      body-class="flex-1 min-h-0 overflow-y-auto p-0"
      footer-class="justify-center"
      @close="closeGeneralMultiSignerModal"
    >
      <template #header>
        <div id="dashboard-signature-general-multisigner-modal" class="flex min-w-0 flex-1 items-center gap-4">
          <div class="flex min-w-0 max-w-[22rem] items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3v4a1 1 0 0 0 1 1h4"></path><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2"></path><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path></svg>
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Previsualizando PDF</div>
              <div class="truncate text-base font-bold text-slate-800" :title="generalMultiSignerHeader.documentName">{{ formatHeaderFileName(generalMultiSignerHeader.documentName) }}</div>
            </div>
          </div>
          <div class="flex flex-1 flex-wrap items-center justify-center gap-3">
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
      labelled-by="dashboard-signature-pending-modal"
      size="xl"
      title="Documentos pendientes por firma"
      body-class="px-0 py-0"
      @close="closePendingModal"
    >
      <div class="flex flex-col gap-5 p-6">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label class="flex flex-col gap-2 xl:col-span-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Buscar</span>
            <input
              v-model="tableFilters.query"
              type="text"
              placeholder="Documento, proceso, unidad o paso"
              class="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Año</span>
            <select v-model="tableFilters.year" class="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
              <option value="all">Todos</option>
              <option v-for="option in yearOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Unidad</span>
            <select v-model="tableFilters.unit" class="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
              <option value="all">Todas</option>
              <option v-for="option in unitOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Proceso</span>
            <select v-model="tableFilters.process" class="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10">
              <option value="all">Todos</option>
              <option v-for="option in processOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-medium text-slate-500">
            Seleccionados: <span class="font-bold text-slate-700">{{ selectedItems.length }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <AppButton variant="softNeutral" size="sm" @click="resetTableFilters">Limpiar filtros</AppButton>
            <AppButton variant="softPrimary" size="sm" :disabled="pendingPreparation" @click="openSelectedInMultiSigner">
              {{ pendingPreparation ? "Preparando..." : "Enviar al multifirmador" }}
            </AppButton>
          </div>
        </div>

        <AppDataTable
          :fields="tableFields"
          :rows="filteredItems"
          :row-key="(row) => `dashboard-signature-${row.signature_request_id}`"
          empty-text="No hay documentos pendientes por firma."
          actions-label="ACCIONES"
        >
          <template #cell="{ row, field }">
            <template v-if="field.name === 'select'">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                :checked="isSelected(row)"
                @change="toggleSelection(row)"
              />
            </template>
            <template v-else-if="field.name === 'document'">
              <div class="flex flex-col gap-1">
                <strong class="text-sm font-bold text-slate-800">{{ row.template_artifact_name || row.definition_name || `Documento #${row.document_id}` }}</strong>
                <span class="text-xs font-medium text-slate-500">{{ row.document_version ? `v${row.document_version}` : "Sin versión" }}</span>
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
      labelled-by="dashboard-signature-multisigner-modal"
      size="xl"
      dialog-class="max-w-[108rem]"
      content-class="flex max-h-[calc(100vh-4rem)] flex-col"
      body-class="flex-1 min-h-0 overflow-y-auto p-0"
      footer-class="justify-center"
      @close="closeMultiSignerModal"
    >
      <template #header>
        <div id="dashboard-signature-multisigner-modal" class="flex min-w-0 flex-1 items-center gap-4">
          <div class="flex min-w-0 max-w-[22rem] items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3v4a1 1 0 0 0 1 1h4"></path><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2"></path><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"></path></svg>
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Previsualizando PDF</div>
              <div class="truncate text-base font-bold text-slate-800" :title="pendingMultiSignerHeader.documentName">{{ formatHeaderFileName(pendingMultiSignerHeader.documentName) }}</div>
            </div>
          </div>
          <div class="flex flex-1 flex-wrap items-center justify-center gap-3">
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
        </div>
      </template>
      <div class="flex min-h-0 flex-col px-4 pb-4 pt-2">
        <div v-if="multiSignerError" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {{ multiSignerError }}
        </div>
        <div v-if="pendingPreparation" class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-600">
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
import AppPageIntro from "@/shared/components/layout/AppPageIntro.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppCounterNavigator from "@/shared/components/widgets/AppCounterNavigator.vue";
import FirmarPdf from "@/modules/firmas/components/FirmarPdf.vue";
import ProcessDefinitionPanelService from "@/core/services/ProcessDefinitionPanelService.js";

const emit = defineEmits(["refresh-dashboard"]);
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
const pendingPreparation = ref(false);
const multiSignerError = ref("");
const rowActionLoading = ref({});
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
  emit("refresh-dashboard");
};

const handleGeneralBatchFinished = async () => {
  await loadSignatureCenter();
  emit("refresh-dashboard");
};

onMounted(async () => {
  readCurrentUser();
  await loadSignatureCenter();
});
</script>
