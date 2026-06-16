<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="recordViewerModalLabel"
    :title="`Detalle de ${recordViewerTable?.label || 'registro'}`"
    size="lg"
    dialog-class="items-start"
    content-class="flex max-h-[calc(100vh-4rem)] flex-col"
    body-class="min-h-0 overflow-y-auto"
    footer-class="shrink-0"
    close-action
    close-label="Cerrar"
    @close="$emit('close')"
  >
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600">
          <IconFileDescription class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <p class="m-0 text-xs font-semibold text-slate-500">{{ recordViewerTable?.label || "Registro" }}</p>
          <h5 id="recordViewerModalLabel" class="deasy-dialog-title admin-dialog-title truncate">
            {{ primaryValue }}
          </h5>
        </div>
      </div>
    </template>

    <div>
      <div v-if="loading" class="flex min-h-40 items-center justify-center text-sm font-medium text-slate-500">
        Cargando informacion del registro...
      </div>
      <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {{ error }}
      </div>
      <div v-else-if="recordViewerTable && recordViewerRow" class="space-y-7">
        <section aria-labelledby="recordViewerGeneralTitle">
          <div class="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p class="m-0 text-xs font-semibold text-slate-500">Detalle del registro</p>
              <h6 id="recordViewerGeneralTitle" class="m-0 mt-1 text-base font-bold text-slate-800">
                Informacion general
              </h6>
            </div>
            <span
              v-if="activeValue"
              class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold"
              :class="activeValue === 'Si'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-100 text-slate-600'"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="activeValue === 'Si' ? 'bg-emerald-500' : 'bg-slate-400'" />
              {{ activeValue === "Si" ? "Activo" : "Inactivo" }}
            </span>
          </div>

          <dl class="grid grid-cols-1 overflow-hidden border-y border-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="row in summaryRows"
              :key="row.id"
              class="min-w-0 border-b border-slate-100 px-1 py-3.5 sm:px-4"
            >
              <dt class="mb-1 text-xs font-semibold text-slate-500">{{ row.label }}</dt>
              <dd class="m-0 min-w-0 text-sm font-semibold leading-6 text-slate-800">
              <template v-if="row.field.name === 'available_formats'">
                <div class="space-y-3">
                  <template v-if="getAvailableFormatSections(recordViewerRow[row.field.name]).length">
                    <div
                      v-for="section in getAvailableFormatSections(recordViewerRow[row.field.name])"
                      :key="section.mode"
                      class="space-y-2"
                    >
                      <div class="text-xs font-bold text-slate-600">{{ section.label }}</div>
                      <div
                        v-for="entry in section.entries"
                        :key="`${section.mode}-${entry.format}`"
                        class="flex min-w-0 flex-wrap items-center gap-2"
                      >
                        <span class="available-formats-badge is-viewer" :style="getAvailableFormatBadgeStyle(section.mode, entry)">
                          {{ entry.formatLabel }}
                        </span>
                        <code class="min-w-0 break-all text-xs font-medium text-slate-500">{{ entry.entryObjectKey }}</code>
                      </div>
                    </div>
                  </template>
                  <span v-else class="text-slate-400">-</span>
                </div>
              </template>
              <span
                v-else
                class="block min-w-0 whitespace-pre-wrap break-words"
                :class="isLongValue(row)
                  ? 'max-h-48 overflow-auto rounded-md bg-slate-50 p-2 font-mono text-xs font-medium text-slate-600'
                  : ''"
              >
                {{ getFormattedViewerValue(row) }}
              </span>
              </dd>
            </div>
          </dl>
        </section>

        <section v-for="section in relatedSections" :key="section.key" class="border-t border-slate-200 pt-5">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                <IconSettings class="h-4.5 w-4.5" />
              </span>
              <div class="min-w-0">
                <p class="m-0 text-xs font-semibold text-slate-500">{{ sectionEyebrow(section) }}</p>
                <h6 class="m-0 mt-0.5 flex items-center gap-2 text-base font-bold text-slate-800">
                  <span>{{ sectionTitle(section) }}</span>
                  <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-xs font-bold text-slate-600">
                    {{ section.rows.length }}
                  </span>
                </h6>
              </div>
            </div>
            <AdminButton
              v-if="canAddProcessConfiguration(section)"
              variant="primary"
              size="sm"
              @click="$emit('add-process-configuration')"
            >
              <IconPlus class="h-4 w-4" />
              <span>Agregar configuracion</span>
            </AdminButton>
          </div>

          <div v-if="section.error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {{ section.error }}
          </div>
          <div
            v-else-if="section.rows.length === 0"
            class="flex min-h-32 flex-col items-center justify-center border-y border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center"
          >
            <IconInbox class="mb-2 h-6 w-6 text-slate-400" />
            <p class="m-0 text-sm font-semibold text-slate-600">
              {{ isProcessConfigurationSection(section) ? "Este proceso aun no tiene configuraciones." : "Sin registros relacionados." }}
            </p>
            <p v-if="isProcessConfigurationSection(section)" class="m-0 mt-1 max-w-lg text-xs leading-5 text-slate-500">
              {{ processConfigurationEmptyText }}
            </p>
          </div>
          <AdminDataTable
            v-else
            :fields="relatedSectionFields(section)"
            :rows="section.rows"
            :row-key="(sectionRow) => rowKeyForTable(section.tableMeta, sectionRow)"
            table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto rounded-lg border border-slate-200 bg-white"
            scroll-class=""
            actions-label="Accion"
          >
            <template #cell="{ row: sectionRow, field }">
              {{ formatValueForTable(section.tableMeta, sectionRow[field.name], field, sectionRow) }}
            </template>
            <template #actions="{ row: sectionRow }">
              <AdminTableActions
                :show-edit="false"
                :show-delete="false"
                view-title="Ver detalle"
                view-label="Ver detalle"
                @view="$emit('view-related-record', { row: sectionRow, tableMeta: section.tableMeta })"
              />
            </template>
          </AdminDataTable>
        </section>
      </div>
      <div v-else class="flex min-h-40 items-center justify-center text-sm font-medium text-slate-500">
        No hay informacion para visualizar.
      </div>
    </div>

    <template #footer>
      <span
        v-if="syncBadge"
        class="mr-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1"
        :class="syncBadge.class"
        :title="syncStatus?.status === 'no_link' ? 'El flujo existe en la plantilla pero aún no está vinculado a ninguna configuración (no está activo).' : (syncStatus?.status === 'stale' ? 'La proyección del flujo en la base de datos no coincide con la versión actual de la plantilla.' : 'La proyección del flujo está al día con la plantilla.')"
      >
        {{ syncBadge.label }}
      </span>
      <AdminButton
        v-if="canResyncWorkflows"
        variant="outlinePrimary"
        :disabled="syncBusy"
        @click="$emit('resync-workflows')"
      >
        <font-awesome-icon icon="rotate-right" />
        <span>{{ syncBusy ? "Sincronizando…" : "Re-sincronizar flujos" }}</span>
      </AdminButton>
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
      <AdminButton variant="secondary" @click="$emit('close')">Cerrar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  IconFileDescription,
  IconInbox,
  IconPlus,
  IconSettings
} from "@tabler/icons-vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

const ARCHIVE_DOWNLOADABLE_TABLES = new Set(["template_artifacts", "template_seeds"]);
const MAX_RELATED_FIELDS = 6;
const RELATED_FIELD_PRIORITY = {
  process_definition_versions: ["series_id", "definition_version", "name", "has_document", "status", "effective_from"],
  process_definition_templates: ["template_artifact_id", "instance_mode", "creates_task", "sort_order"],
  process_target_rules: ["unit_scope_type", "unit_id", "unit_type_id", "cargo_id", "position_id", "is_active"],
  process_definition_period_types: ["term_type_id", "is_active"],
  process_runs: ["status", "term_id", "started_at", "completed_at"],
  tasks: ["title", "name", "status", "due_at", "created_at"],
  task_items: ["process_definition_template_id", "status", "sort_order", "created_at"],
  task_assignments: ["responsible_position_id", "status", "assigned_at"],
  documents: ["title", "name", "status", "current_version_id", "created_at"],
  document_versions: ["version_number", "status", "created_at"],
  document_fill_flows: ["status", "created_at"],
  signature_flow_instances: ["status", "created_at"],
  position_assignments: ["position_id", "cargo_id", "start_date", "end_date", "is_active"],
  role_assignments: ["role_id", "assigned_at", "is_active"],
  contracts: ["contract_type", "start_date", "end_date", "is_active"]
};
const NOISY_RELATED_FIELDS = new Set([
  "id",
  "description",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by",
  "created_by_user_id",
  "updated_by",
  "effective_to",
  "metadata",
  "payload"
]);

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  recordViewerTable: { type: Object, default: null },
  recordViewerRow: { type: Object, default: null },
  summaryTableFields: { type: Array, default: () => [] },
  displayRows: { type: Array, default: () => [] },
  relatedSections: { type: Array, default: () => [] },
  downloading: { type: Boolean, default: false },
  editable: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  canCreateProcessConfiguration: { type: Boolean, default: false },
  sourceBusy: { type: Boolean, default: false },
  syncStatus: { type: Object, default: null },
  syncBusy: { type: Boolean, default: false },
  formatRecordViewerValue: { type: Function, required: true },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true },
  rowKeyForTable: { type: Function, required: true },
  formatValueForTable: { type: Function, required: true }
});

const emit = defineEmits([
  "close",
  "download-archive",
  "download-source",
  "upload-source",
  "add-process-configuration",
  "view-related-record",
  "resync-workflows"
]);

// Indicador de sincronización del flujo (plantillas): synced / stale / no_link.
const SYNC_BADGE_META = {
  synced: { label: "Flujo sincronizado", class: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  stale: { label: "Flujo desincronizado", class: "bg-amber-100 text-amber-800 ring-amber-200" },
  no_link: { label: "Flujo sin vínculo", class: "bg-slate-100 text-slate-600 ring-slate-200" }
};
const syncBadge = computed(() => {
  const status = props.syncStatus?.status;
  if (!status || !SYNC_BADGE_META[status]) return null;
  return SYNC_BADGE_META[status];
});
const canResyncWorkflows = computed(() =>
  props.recordViewerTable?.table === "template_artifacts"
  && props.syncStatus?.status === "stale"
);

const canDownloadArchive = computed(() =>
  Boolean(props.recordViewerRow?.id) && ARCHIVE_DOWNLOADABLE_TABLES.has(props.recordViewerTable?.table)
);
// Edición de código (LaTeX) solo cuando el visor fue abierto desde un flujo editable.
const canEditSource = computed(() =>
  props.editable && props.isAdmin && Boolean(props.recordViewerRow?.id) && props.recordViewerTable?.table === "template_artifacts"
);
const canAddProcessConfiguration = (section) =>
  props.editable && isProcessConfigurationSection(section) && props.canCreateProcessConfiguration;
const processConfigurationEmptyText = computed(() =>
  props.editable && props.canCreateProcessConfiguration
    ? "Agrega una configuracion para definir su variacion, vigencia, reglas, paquetes y disparadores."
    : "Las configuraciones se gestionan desde el modo editar."
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

const primaryField = computed(() => {
  const preferredNames = ["name", "title", "display_name", "email", "label", "code", "slug"];
  return preferredNames
    .map((name) => props.displayRows.find((row) => row.field?.name === name))
    .find(Boolean) || null;
});

const primaryValue = computed(() => {
  if (!props.recordViewerRow) {
    return `Detalle de ${props.recordViewerTable?.label || "registro"}`;
  }
  if (primaryField.value) {
    return getFormattedViewerValue(primaryField.value);
  }
  const id = props.recordViewerRow.id;
  return id === null || id === undefined || id === ""
    ? (props.recordViewerTable?.label || "Registro")
    : `${props.recordViewerTable?.label || "Registro"} #${id}`;
});

const summaryRows = computed(() => props.displayRows.filter((row) => (
  row.field?.name !== primaryField.value?.field?.name
  && row.field?.name !== "is_active"
)));

const activeValue = computed(() => {
  const activeRow = props.displayRows.find((row) => row.field?.name === "is_active");
  return activeRow ? getFormattedViewerValue(activeRow) : "";
});

const isProcessConfigurationSection = (section) => (
  props.recordViewerTable?.table === "processes"
  && section?.key === "process_definition_versions"
);

const sectionEyebrow = (section) => (
  isProcessConfigurationSection(section) ? "Configuraciones" : "Registros relacionados"
);

const sectionTitle = (section) => (
  isProcessConfigurationSection(section) ? "Configuraciones del proceso" : section.label
);

const relatedSectionFields = (section) => {
  const fields = Array.isArray(section?.fields) ? section.fields : [];
  const tableName = section?.tableMeta?.table || section?.key || "";
  const priority = RELATED_FIELD_PRIORITY[tableName] || [];
  const byName = new Map(fields.map((field) => [field.name, field]));
  const selected = priority
    .map((fieldName) => byName.get(fieldName))
    .filter(Boolean);
  if (selected.length) {
    return selected.slice(0, MAX_RELATED_FIELDS);
  }
  return fields
    .filter((field) => field?.name && !NOISY_RELATED_FIELDS.has(field.name))
    .slice(0, MAX_RELATED_FIELDS);
};

const isLongValue = (row) => getFormattedViewerValue(row).length > 90;

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
