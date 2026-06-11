<template>
  <section class="space-y-4">
    <div class="admin-surface-frame">
      <div class="deasy-filter-shell deasy-filter-shell--embedded">
      <div class="deasy-filter-grid deasy-filter-grid--admin">
            <div :class="searchColumnClass">
              <AdminInputField
                ref="searchInputRef"
                :model-value="searchTerm"
                placeholder="Buscar en la tabla"
                input-class="deasy-filter-control"
                @update:model-value="$emit('update:search-term', $event)"
                @input="$emit('debounced-search')"
              />
            </div>

            <template v-if="showAdvancedFilters && isPositionFilterTable">
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="unitPositionFilters.unit_type_id" select-class="deasy-filter-control" :disabled="unitPositionFilterLoading" @update:model-value="updateUnitPositionFilter('unit_type_id', $event)" @change="$emit('handle-unit-position-type-change')">
                  <option value="">Tipo de unidad</option>
                  <option v-for="row in unitPositionUnitTypeOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("unit_types", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="unitPositionFilters.unit_id" select-class="deasy-filter-control" :disabled="!unitPositionFilters.unit_type_id || unitPositionFilterLoading" @update:model-value="updateUnitPositionFilter('unit_id', $event)" @change="$emit('handle-unit-position-unit-change')">
                  <option value="">Unidad</option>
                  <option v-for="row in unitPositionUnitOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("units", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="unitPositionFilters.cargo_id" select-class="deasy-filter-control" :disabled="unitPositionFilterLoading" @update:model-value="updateUnitPositionFilter('cargo_id', $event)" @change="$emit('handle-unit-position-cargo-change')">
                  <option value="">Cargo</option>
                  <option v-for="row in unitPositionCargoOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("cargos", row) }}
                  </option>
                </AdminSelectField>
              </div>
            </template>

            <template v-else-if="showAdvancedFilters && isProcessDefinitionFilterTable">
              <div class="md:col-span-6 lg:col-span-2">
                <AdminSelectField :model-value="processDefinitionInlineFilters.process_id" select-class="deasy-filter-control" @update:model-value="updateProcessDefinitionFilter('process_id', $event)" @change="$emit('fetch-rows')">
                  <option value="">Proceso</option>
                  <option v-for="row in processDefinitionProcessOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("processes", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-6 lg:col-span-2">
                <AdminSelectField :model-value="processDefinitionInlineFilters.status" select-class="deasy-filter-control" @update:model-value="updateProcessDefinitionFilter('status', $event)" @change="$emit('fetch-rows')">
                  <option value="">Estado</option>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="retired">retired</option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-12 lg:col-span-3">
                <AdminSelectField :model-value="processDefinitionInlineFilters.variation_key" select-class="deasy-filter-control" @update:model-value="updateProcessDefinitionFilter('variation_key', $event)" @change="$emit('fetch-rows')">
                  <option value="">Variación</option>
                  <option v-for="row in processDefinitionSeriesOptions" :key="row.id" :value="String(row.code || '')">
                    {{ formatFkOptionLabel("process_definition_series", row) }}
                  </option>
                </AdminSelectField>
              </div>
            </template>

            <template v-else-if="showAdvancedFilters && isProcessTargetRuleFilterTable">
              <div class="md:col-span-6 lg:col-span-2">
                <AdminSelectField :model-value="processTargetRuleInlineFilters.definition_status" select-class="deasy-filter-control" @update:model-value="updateProcessTargetRuleFilter('definition_status', $event)" @change="$emit('fetch-rows')">
                  <option value="">Estado</option>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="retired">retired</option>
                </AdminSelectField>
              </div>
            </template>

            <template v-else-if="showAdvancedFilters && isTemplateArtifactsTable">
              <div class="md:col-span-6 lg:col-span-3">
                <AdminSelectField :model-value="templateArtifactInlineFilters.artifact_stage" select-class="deasy-filter-control" @update:model-value="updateTemplateArtifactFilter('artifact_stage', $event)" @change="$emit('fetch-rows')">
                  <option value="">Etapa</option>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </AdminSelectField>
              </div>
            </template>

            <div :class="actionColumnClass">
              <div class="deasy-filter-actions">
                <AdminButton
                  v-if="!isPositionFilterTable && !isProcessDefinitionFilterTable && !isProcessTargetRuleFilterTable && !isTemplateArtifactsTable"
                  variant="secondary"
                  size="sm"
                  class-name="deasy-filter-btn"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                  :disabled="!searchTerm"
                  @click="resetGenericSearch"
                >
                  <font-awesome-icon icon="times" />
                  <span>Reset</span>
                </AdminButton>
                <AdminButton
                  v-if="isPositionFilterTable"
                  variant="secondary"
                  size="sm"
                  class-name="deasy-filter-btn"
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros"
                  :disabled="!hasUnitPositionFilters"
                  @click="$emit('clear-unit-position-inline-filters')"
                >
                  <font-awesome-icon icon="times" />
                  <span>Reset</span>
                </AdminButton>
                <AdminButton
                  v-else-if="isProcessDefinitionFilterTable"
                  variant="secondary"
                  size="sm"
                  class-name="deasy-filter-btn"
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros"
                  :disabled="!hasProcessDefinitionInlineFilters"
                  @click="$emit('clear-process-definition-inline-filters')"
                >
                  <font-awesome-icon icon="times" />
                  <span>Reset</span>
                </AdminButton>
                <AdminButton
                  v-else-if="isProcessTargetRuleFilterTable"
                  variant="secondary"
                  size="sm"
                  class-name="deasy-filter-btn"
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros"
                  :disabled="!hasProcessTargetRuleInlineFilters"
                  @click="$emit('clear-process-target-rule-inline-filters')"
                >
                  <font-awesome-icon icon="times" />
                  <span>Reset</span>
                </AdminButton>
                <AdminButton
                  v-else-if="isTemplateArtifactsTable"
                  variant="secondary"
                  size="sm"
                  class-name="deasy-filter-btn"
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros"
                  :disabled="!hasTemplateArtifactInlineFilters"
                  @click="$emit('clear-template-artifact-inline-filters')"
                >
                  <font-awesome-icon icon="times" />
                  <span>Reset</span>
                </AdminButton>
                <AdminButton variant="outlinePrimary" size="sm" class-name="deasy-filter-btn" title="Buscar" aria-label="Buscar" @click="$emit('fetch-rows')">
                  <font-awesome-icon icon="search" />
                  <span>Search</span>
                </AdminButton>
                <AdminButton
                  v-if="hasExpandableFilters"
                  variant="secondary"
                  size="sm"
                  icon-only
                  class-name="deasy-filter-btn deasy-filter-btn--icon"
                  :title="showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'"
                  :aria-label="showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'"
                  @click="showAdvancedFilters = !showAdvancedFilters"
                >
                  <font-awesome-icon :icon="showAdvancedFilters ? 'arrow-up' : 'arrow-down'" />
                </AdminButton>
              </div>
            </div>
          </div>
          <div class="deasy-filter-toolbar">
            <div class="deasy-filter-summary"></div>
            <div class="deasy-filter-actions">
              <AdminButton variant="primary" size="sm" class-name="deasy-filter-btn" title="Refresh" aria-label="Refresh" @click="$emit('fetch-rows')">
                <font-awesome-icon icon="rotate-right" />
                <span>Refresh</span>
              </AdminButton>
            </div>
          </div>
          </div>

          <div v-if="loading" class="text-sm text-slate-500">Cargando datos...</div>
          <div v-else-if="error" class="admin-inline-error" role="alert">{{ error }}</div>
          <AdminDataTable v-else :fields="tableListFields" :rows="rows" :row-key="rowKey">
            <template #cell="{ row, field }">
              <template v-if="field.name === 'available_formats'">
                <div class="available-formats-cell">
                  <template v-if="getAvailableFormatSections(row[field.name]).length">
                    <div v-for="section in getAvailableFormatSections(row[field.name])" :key="section.mode" class="available-formats-group" :class="{ 'is-inline': section.mode === 'reference' }">
                      <span class="available-formats-mode">{{ section.label }}</span>
                      <div class="available-formats-badges">
                        <span v-for="entry in section.entries" :key="`${section.mode}-${entry.format}`" class="available-formats-badge" :style="getAvailableFormatBadgeStyle(section.mode, entry)">
                          {{ entry.formatLabel }}
                        </span>
                      </div>
                    </div>
                  </template>
                  <span v-else>—</span>
                </div>
              </template>
              <template v-else-if="isDefinitionStatusField(field) && row[field.name]">
                <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold" :class="definitionStatusBadge(row[field.name]).class">
                  {{ definitionStatusBadge(row[field.name]).label }}
                </span>
              </template>
              <template v-else>
                {{ formatCell(row[field.name], field, row) }}
              </template>
            </template>
            <template #actions="{ row }">
              <AdminTableActions
                delete-message="Eliminar"
                :show-edit="canUpdate && isRowEditable(row)"
                :show-delete="canDelete && isRowDeletable(row)"
                @view="$emit('open-record-viewer', row)"
                @edit="$emit('open-edit', row)"
                @delete="$emit('open-delete', row)"
              >
                <template #between>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions'"
                    variant="secondary"
                    size="sm"
                    icon-only
                    class-name="hope-action-btn hope-action-version"
                    title="Versionar"
                    aria-label="Versionar"
                    @click="$emit('start-process-definition-versioning', row)"
                  >
                    <font-awesome-icon icon="rotate-right" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions' && String(row?.status || '') === 'draft'"
                    variant="secondary"
                    size="sm"
                    icon-only
                    class-name="hope-action-btn hope-action-assign"
                    title="Activar"
                    aria-label="Activar"
                    @click="$emit('open-process-definition-activation-for-row', row)"
                  >
                    <font-awesome-icon icon="check" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions' && String(row?.status || '') === 'active'"
                    variant="secondary"
                    size="sm"
                    icon-only
                    class-name="hope-action-btn hope-action-retire"
                    title="Retirar (desactivar)"
                    aria-label="Retirar (desactivar)"
                    @click="$emit('retire-process-definition', row)"
                  >
                    <font-awesome-icon icon="times-circle" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && isPersonTable"
                    variant="secondary"
                    size="sm"
                    icon-only
                    class-name="hope-action-btn hope-action-assign"
                    title="Gestionar asignaciones"
                    aria-label="Gestionar asignaciones"
                    @click="$emit('open-person-assignments', row)"
                  >
                    <font-awesome-icon icon="list-check" />
                  </AdminButton>
                </template>
                <template v-if="isTemplateArtifactsTable" #edit>
                  <AdminButton
                    v-if="canUpdate"
                    variant="secondary"
                    size="sm"
                    icon-only
                    class-name="text-primary hope-action-btn hope-action-edit"
                    :title="!row?.owner_ref ? 'Las plantillas oficiales del sistema se sincronizan desde MinIO' : 'Editar'"
                    :aria-label="!row?.owner_ref ? 'Edicion bloqueada para plantillas del sistema' : 'Editar'"
                    :disabled="!row?.owner_ref"
                    @click="!row?.owner_ref ? undefined : $emit('open-edit', row)"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M11.4925 2.78906H7.75349C4.67849 2.78906 2.75049 4.96606 2.75049 8.04806V16.3621C2.75049 19.4441 4.66949 21.6211 7.75349 21.6211H16.5775C19.6625 21.6211 21.5815 19.4441 21.5815 16.3621V12.3341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M8.82812 10.921L16.3011 3.44799C17.2321 2.51799 18.7411 2.51799 19.6721 3.44799L20.8891 4.66499C21.8201 5.59599 21.8201 7.10599 20.8891 8.03599L13.3801 15.545C12.9731 15.952 12.4211 16.181 11.8451 16.181H8.09912L8.19312 12.401C8.20712 11.845 8.43412 11.315 8.82812 10.921Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M15.1655 4.60254L19.7315 9.16854" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </AdminButton>
                </template>
              </AdminTableActions>
            </template>
          </AdminDataTable>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

const props = defineProps({
  table: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  searchTerm: { type: String, default: "" },
  isPositionFilterTable: { type: Boolean, default: false },
  isProcessDefinitionFilterTable: { type: Boolean, default: false },
  isProcessTargetRuleFilterTable: { type: Boolean, default: false },
  isTemplateArtifactsTable: { type: Boolean, default: false },
  isPersonTable: { type: Boolean, default: false },
  unitPositionFilters: { type: Object, default: () => ({}) },
  unitPositionFilterLoading: { type: Boolean, default: false },
  unitPositionUnitTypeOptions: { type: Array, default: () => [] },
  unitPositionUnitOptions: { type: Array, default: () => [] },
  unitPositionCargoOptions: { type: Array, default: () => [] },
  processDefinitionInlineFilters: { type: Object, default: () => ({}) },
  processDefinitionProcessOptions: { type: Array, default: () => [] },
  processDefinitionSeriesOptions: { type: Array, default: () => [] },
  processTargetRuleInlineFilters: { type: Object, default: () => ({}) },
  templateArtifactInlineFilters: { type: Object, default: () => ({}) },
  hasUnitPositionFilters: { type: Boolean, default: false },
  hasProcessDefinitionInlineFilters: { type: Boolean, default: false },
  hasProcessTargetRuleInlineFilters: { type: Boolean, default: false },
  hasTemplateArtifactInlineFilters: { type: Boolean, default: false },
  tableListFields: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  rowKey: { type: Function, required: true },
  formatFkOptionLabel: { type: Function, required: true },
  formatCell: { type: Function, required: true },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true },
  canUpdate: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true }
});

const emit = defineEmits([
  "update:search-term",
  "update:unit-position-filters",
  "update:process-definition-inline-filters",
  "update:process-target-rule-inline-filters",
  "update:template-artifact-inline-filters",
  "debounced-search",
  "handle-unit-position-type-change",
  "handle-unit-position-unit-change",
  "handle-unit-position-cargo-change",
  "clear-unit-position-inline-filters",
  "clear-process-definition-inline-filters",
  "clear-process-target-rule-inline-filters",
  "clear-template-artifact-inline-filters",
  "fetch-rows",
  "open-record-viewer",
  "open-edit",
  "open-delete",
  "start-process-definition-versioning",
  "open-process-definition-activation-for-row",
  "retire-process-definition",
  "open-person-assignments"
]);

const searchInputRef = ref(null);

const showAdvancedFilters = ref(false);

// Las configuraciones de proceso solo se editan/eliminan en borrador: activas y retiradas son
// inmutables (las activas solo se pueden retirar; las retiradas son de solo lectura).
const isProcessDefinitionVersionsTable = computed(() => props.table?.table === "process_definition_versions");
const isRowEditable = (row) =>
  !isProcessDefinitionVersionsTable.value || String(row?.status || "").toLowerCase() === "draft";
const isRowDeletable = (row) =>
  !isProcessDefinitionVersionsTable.value || String(row?.status || "").toLowerCase() === "draft";

const searchColumnClass = computed(() => (
  props.isPositionFilterTable ? "lg:col-span-3" :
    props.isProcessDefinitionFilterTable ? "md:col-span-6 lg:col-span-2" :
      props.isProcessTargetRuleFilterTable ? "md:col-span-6 lg:col-span-3" :
        // template_artifacts: con filtros ocultos imita a la tabla de seeds (search ancho); al
        // expandir el filtro de etapa se estrecha para dar espacio.
        props.isTemplateArtifactsTable ? (showAdvancedFilters.value ? "md:col-span-6 lg:col-span-3" : "md:col-span-6") :
          "md:col-span-6"
));

const actionColumnClass = computed(() => (
  props.isPositionFilterTable ? "lg:col-span-2 lg:justify-self-end" :
    props.isProcessDefinitionFilterTable ? "lg:col-span-3 lg:justify-self-end" :
      props.isProcessTargetRuleFilterTable ? "lg:col-span-3 lg:justify-self-end" :
        props.isTemplateArtifactsTable ? (showAdvancedFilters.value ? "md:col-span-12 md:justify-self-end lg:col-span-6 lg:justify-self-end" : "md:col-span-6 md:justify-self-end") :
          "md:col-span-6 md:justify-self-end"
));
const hasExpandableFilters = computed(() =>
  props.isPositionFilterTable ||
  props.isProcessDefinitionFilterTable ||
  props.isProcessTargetRuleFilterTable ||
  props.isTemplateArtifactsTable
);

const updateUnitPositionFilter = (field, value) => emit("update:unit-position-filters", { ...props.unitPositionFilters, [field]: value });
const updateProcessDefinitionFilter = (field, value) => emit("update:process-definition-inline-filters", { ...props.processDefinitionInlineFilters, [field]: value });
const updateProcessTargetRuleFilter = (field, value) => emit("update:process-target-rule-inline-filters", { ...props.processTargetRuleInlineFilters, [field]: value });
const updateTemplateArtifactFilter = (field, value) => emit("update:template-artifact-inline-filters", { ...props.templateArtifactInlineFilters, [field]: value });
const resetGenericSearch = () => {
  emit("update:search-term", "");
  emit("fetch-rows");
};

// Badge de estado de la configuración: aplica al status de process_definition_versions y al estado de la
// definición activa en la tabla de procesos. El resto de columnas 'status' siguen como texto plano.
const DEFINITION_STATUS_BADGES = {
  draft: { label: "Borrador", class: "bg-slate-200 text-slate-700" },
  active: { label: "Activa", class: "bg-emerald-500 text-white" },
  retired: { label: "Retirada", class: "bg-amber-200 text-amber-800" }
};
const isDefinitionStatusField = (field) =>
  field?.name === "active_definition_status"
  || (field?.name === "status" && props.table?.table === "process_definition_versions");
const definitionStatusBadge = (value) =>
  DEFINITION_STATUS_BADGES[String(value || "").toLowerCase()]
  || { label: value, class: "bg-slate-200 text-slate-700" };

defineExpose({ searchInputRef });
</script>
