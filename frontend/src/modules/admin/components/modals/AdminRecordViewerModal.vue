<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="recordViewerModalLabel"
    :title="`Visualizar registro ${recordViewerTable?.label || ''}`"
    size="xl"
    dialog-class="items-start max-w-[min(92rem,calc(100vw-2rem))]"
    content-class="flex max-h-[calc(100vh-4rem)] flex-col"
    body-class="min-h-0 overflow-y-auto bg-slate-50/70 p-0"
    footer-class="shrink-0"
    close-action
    @close="$emit('close')"
  >
    <template #header>
      <div class="min-w-0">
        <p class="record-viewer-kicker">Detalle del registro</p>
        <h5 id="recordViewerModalLabel" class="deasy-dialog-title admin-dialog-title">
          Visualizar {{ recordViewerTable?.label || "registro" }}
        </h5>
      </div>
    </template>

    <div class="record-viewer-shell">
      <div v-if="loading" class="record-viewer-state">Cargando informacion del registro...</div>
      <div v-else-if="error" class="record-viewer-error">{{ error }}</div>
      <div v-else-if="recordViewerTable && recordViewerRow" class="space-y-5">
        <section class="record-viewer-summary" aria-label="Informacion del registro">
          <article v-for="row in displayRows" :key="row.id" class="record-viewer-field">
            <dt class="record-viewer-label">{{ row.label }}</dt>
            <dd class="record-viewer-value">
              <template v-if="row.field.name === 'available_formats'">
                <div class="available-formats-viewer">
                  <template v-if="getAvailableFormatSections(recordViewerRow[row.field.name]).length">
                    <div
                      v-for="section in getAvailableFormatSections(recordViewerRow[row.field.name])"
                      :key="section.mode"
                      class="available-formats-viewer-section"
                    >
                      <div class="available-formats-viewer-title">{{ section.label }}</div>
                      <div
                        v-for="entry in section.entries"
                        :key="`${section.mode}-${entry.format}`"
                        class="available-formats-viewer-entry"
                      >
                        <span class="available-formats-badge is-viewer" :style="getAvailableFormatBadgeStyle(section.mode, entry)">
                          {{ entry.formatLabel }}
                        </span>
                        <code class="available-formats-path">{{ entry.entryObjectKey }}</code>
                      </div>
                    </div>
                  </template>
                  <span v-else class="record-viewer-empty">-</span>
                </div>
              </template>
              <span v-else :class="{ 'record-viewer-value--long': isLongValue(row) }">
                {{ getFormattedViewerValue(row) }}
              </span>
            </dd>
          </article>
        </section>

        <section v-for="section in relatedSections" :key="section.key" class="record-viewer-related">
          <header class="record-viewer-related-header">
            <div>
              <p class="record-viewer-kicker">Relacion</p>
              <h6 class="record-viewer-related-title">
                <font-awesome-icon icon="list-check" />
                <span>{{ section.label }}</span>
              </h6>
            </div>
            <span class="record-viewer-count">{{ section.rows.length }}</span>
          </header>
          <div v-if="section.error" class="record-viewer-error">{{ section.error }}</div>
          <div v-else-if="section.rows.length === 0" class="record-viewer-state">Sin registros relacionados.</div>
          <AdminDataTable
            v-else
            :fields="section.fields"
            :rows="section.rows"
            :row-key="(sectionRow) => rowKeyForTable(section.tableMeta, sectionRow)"
            table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="record-viewer-related-table"
            scroll-class=""
          >
            <template #cell="{ row: sectionRow, field }">
              {{ formatValueForTable(section.tableMeta, sectionRow[field.name], field, sectionRow) }}
            </template>
          </AdminDataTable>
        </section>
      </div>
      <div v-else class="record-viewer-state">No hay informacion para visualizar.</div>
    </div>

    <template #footer>
      <AdminButton
        v-if="canDownloadArchive"
        variant="outlinePrimary"
        :disabled="downloading"
        @click="$emit('download-archive')"
      >
        <font-awesome-icon icon="file-zipper" />
        <span>{{ downloading ? "Generando ZIP…" : "Descargar formatos (ZIP)" }}</span>
      </AdminButton>
      <AdminButton
        v-if="canEditSource"
        variant="secondary"
        :disabled="sourceBusy"
        @click="$emit('download-source')"
      >
        <font-awesome-icon icon="download" />
        <span>Descargar código (LaTeX)</span>
      </AdminButton>
      <AdminButton
        v-if="canEditSource"
        variant="primary"
        :disabled="sourceBusy"
        @click="triggerSourceUpload"
      >
        <font-awesome-icon icon="rotate-right" />
        <span>{{ sourceBusy ? "Verificando…" : "Subir código editado" }}</span>
      </AdminButton>
      <input ref="sourceInputRef" type="file" accept=".zip" class="hidden" @change="onSourcePicked" />
      <AdminButton variant="outlineDanger" @click="$emit('close')">Cerrar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";

const ARCHIVE_DOWNLOADABLE_TABLES = new Set(["template_artifacts", "template_seeds"]);

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  recordViewerTable: { type: Object, default: null },
  recordViewerRow: { type: Object, default: null },
  summaryTableFields: { type: Array, default: () => [] },
  displayRows: { type: Array, default: () => [] },
  relatedSections: { type: Array, default: () => [] },
  downloading: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  sourceBusy: { type: Boolean, default: false },
  formatRecordViewerValue: { type: Function, required: true },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true },
  rowKeyForTable: { type: Function, required: true },
  formatValueForTable: { type: Function, required: true }
});

const emit = defineEmits(["close", "download-archive", "download-source", "upload-source"]);

const canDownloadArchive = computed(() =>
  Boolean(props.recordViewerRow?.id) && ARCHIVE_DOWNLOADABLE_TABLES.has(props.recordViewerTable?.table)
);
// Edición de código (LaTeX) solo para admin y solo sobre paquetes de plantilla.
const canEditSource = computed(() =>
  props.isAdmin && Boolean(props.recordViewerRow?.id) && props.recordViewerTable?.table === "template_artifacts"
);
const sourceInputRef = ref(null);
const triggerSourceUpload = () => sourceInputRef.value?.click();
const onSourcePicked = (event) => {
  const file = event?.target?.files?.[0];
  if (file) emit("upload-source", file);
  if (event?.target) event.target.value = "";
};

const modalRef = ref(null);

const normalizeViewerValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const getFormattedViewerValue = (row) => normalizeViewerValue(
  props.formatRecordViewerValue(row.field, props.recordViewerRow)
);

const isLongValue = (row) => getFormattedViewerValue(row).length > 90;

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>

<style scoped>
.record-viewer-shell {
  padding: 1.25rem;
}

.record-viewer-kicker {
  margin: 0 0 0.25rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

.record-viewer-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 0.8rem;
}

.record-viewer-field {
  min-width: 0;
  margin: 0;
  border: 1px solid #dbe3ef;
  border-radius: 0.9rem;
  background: #ffffff;
  padding: 0.85rem 0.95rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.record-viewer-label {
  margin: 0 0 0.35rem;
  color: #64748b;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.record-viewer-value {
  min-width: 0;
  margin: 0;
  color: #0f172a;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.record-viewer-value--long {
  display: block;
  max-height: 12rem;
  overflow: auto;
  border-radius: 0.65rem;
  background: #f8fafc;
  padding: 0.55rem 0.65rem;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.8rem;
  font-weight: 500;
}

.record-viewer-empty {
  color: #94a3b8;
}

.record-viewer-related {
  border: 1px solid #dbe3ef;
  border-radius: 1rem;
  background: #ffffff;
  padding: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.record-viewer-related-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}

.record-viewer-related-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: #0f172a;
  font-size: 0.98rem;
  font-weight: 800;
}

.record-viewer-count {
  display: inline-flex;
  min-width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 1px solid #bfdbfe;
  border-radius: 0.7rem;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.8rem;
  font-weight: 800;
}

.record-viewer-related-table {
  overflow-x: auto;
  border: 1px solid #dbe3ef;
  border-radius: 0.85rem;
  background: #ffffff;
}

.record-viewer-state,
.record-viewer-error {
  border-radius: 0.9rem;
  padding: 1rem;
  font-size: 0.92rem;
  font-weight: 600;
}

.record-viewer-state {
  border: 1px solid #dbe3ef;
  background: #ffffff;
  color: #64748b;
}

.record-viewer-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}
</style>
