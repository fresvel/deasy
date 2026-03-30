<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlFkModalLabel"
    :title="`Buscar referencia ${fkTable?.label || ''}`"
    :dialog-class="isFkTemplateArtifacts || isFkProcessDefinitions ? 'modal-xl' : 'modal-lg'"
  >
    <div class="grid gap-3 md:grid-cols-12 md:items-end mb-3">
      <template v-if="isFkUnits">
        <AdminFieldGroup label="Busqueda" label-class="text-slate-700" group-class="md:col-span-7">
          <AdminInputField
            :model-value="fkSearch"
            placeholder="Buscar referencia"
            @update:model-value="$emit('update:fkSearch', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Tipo de unidad" label-class="text-slate-700" group-class="md:col-span-4">
          <AdminSelectField
            :model-value="fkPositionFilters.unit_type_id"
            :disabled="fkPositionFilterLoading"
            @update:model-value="updatePositionFilter('unit_type_id', $event)"
            @change="$emit('fk-unit-type-change')"
          >
            <option value="">Todos</option>
            <option v-for="row in fkUnitTypeOptions" :key="row.id" :value="String(row.id)">
              {{ formatFkOptionLabel("unit_types", row) }}
            </option>
          </AdminSelectField>
        </AdminFieldGroup>
        <div class="md:col-span-1 md:flex md:items-end md:justify-end fk-inline-clear-col">
          <AdminButton
            variant="secondary"
            class-name="fk-inline-clear-btn"
            title="Limpiar filtro"
            aria-label="Limpiar filtro"
            :disabled="!fkPositionFilters.unit_type_id"
            @click="$emit('clear-fk-unit-position-filters')"
          >
            <font-awesome-icon icon="times" />
          </AdminButton>
        </div>
      </template>
      <template v-else-if="isFkProcessDefinitions">
        <AdminFieldGroup label="Busqueda" label-class="text-slate-700" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkSearch"
            placeholder="Buscar referencia"
            @update:model-value="$emit('update:fkSearch', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Proceso" label-class="text-slate-700" group-class="md:col-span-3">
          <AdminSelectField
            :model-value="fkFilters.process_id"
            @update:model-value="updateFilter('process_id', $event)"
            @change="$emit('process-definition-filter-change')"
          >
            <option value="">Todos</option>
            <option v-for="row in fkProcessDefinitionProcessOptions" :key="row.id" :value="String(row.id)">
              {{ formatFkOptionLabel("processes", row) }}
            </option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Serie" label-class="text-slate-700" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkFilters.variation_key"
            placeholder="Filtrar por serie"
            @update:model-value="updateFilter('variation_key', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Modo" label-class="text-slate-700" group-class="md:col-span-2">
          <AdminSelectField
            :model-value="fkFilters.execution_mode"
            @update:model-value="updateFilter('execution_mode', $event)"
            @change="$emit('process-definition-filter-change')"
          >
            <option value="">Todos</option>
            <option
              v-for="option in getFkTableFieldOptions('execution_mode')"
              :key="option"
              :value="option"
            >
              {{ formatSelectOptionLabel(getFkTableField('execution_mode'), option) }}
            </option>
          </AdminSelectField>
        </AdminFieldGroup>
        <div class="md:col-span-1 md:flex md:items-end md:justify-end fk-inline-clear-col">
          <AdminButton
            variant="secondary"
            class-name="fk-inline-clear-btn"
            title="Limpiar filtro"
            aria-label="Limpiar filtro"
            :disabled="!hasFkProcessDefinitionFilters"
            @click="$emit('clear-fk-process-definition-filters')"
          >
            <font-awesome-icon icon="times" />
          </AdminButton>
        </div>
      </template>
      <template v-else-if="isFkTemplateArtifacts">
        <AdminFieldGroup label="Busqueda" label-class="text-slate-700" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkSearch"
            placeholder="Buscar referencia"
            @update:model-value="$emit('update:fkSearch', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Codigo" label-class="text-slate-700" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkFilters.template_code"
            placeholder="Filtrar por codigo"
            @update:model-value="updateFilter('template_code', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Version storage" label-class="text-slate-700" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkFilters.storage_version"
            placeholder="Filtrar por version"
            @update:model-value="updateFilter('storage_version', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Activo" label-class="text-slate-700" group-class="md:col-span-2">
          <AdminSelectField
            :model-value="fkFilters.is_active"
            @update:model-value="updateFilter('is_active', $event)"
            @change="$emit('template-artifact-filter-change')"
          >
            <option value="">Todos</option>
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <div class="md:col-span-1 md:flex md:items-end md:justify-end fk-inline-clear-col">
          <AdminButton
            variant="secondary"
            class-name="fk-inline-clear-btn"
            title="Limpiar filtro"
            aria-label="Limpiar filtro"
            :disabled="!hasFkTemplateArtifactFilters"
            @click="$emit('clear-fk-template-artifact-filters')"
          >
            <font-awesome-icon icon="times" />
          </AdminButton>
        </div>
      </template>
      <AdminFieldGroup v-else label="Busqueda" label-class="text-slate-700" group-class="md:col-span-12">
        <AdminInputField
          :model-value="fkSearch"
          placeholder="Buscar referencia"
          @update:model-value="$emit('update:fkSearch', $event)"
          @input="$emit('debounced-search')"
        />
      </AdminFieldGroup>
    </div>

    <div v-if="isFkUnitPositions" class="mb-3 grid gap-3 md:grid-cols-12 md:items-end">
      <AdminFieldGroup label="Tipo de unidad" label-class="text-slate-700" group-class="md:col-span-4">
        <AdminSelectField
          :model-value="fkPositionFilters.unit_type_id"
          :disabled="fkPositionFilterLoading"
          @update:model-value="updatePositionFilter('unit_type_id', $event)"
          @change="$emit('fk-unit-type-change')"
        >
          <option value="">Todos</option>
          <option v-for="row in fkUnitTypeOptions" :key="row.id" :value="String(row.id)">
            {{ formatFkOptionLabel("unit_types", row) }}
          </option>
        </AdminSelectField>
      </AdminFieldGroup>
      <AdminFieldGroup label="Unidad" label-class="text-slate-700" group-class="md:col-span-4">
        <AdminSelectField
          :model-value="fkPositionFilters.unit_id"
          :disabled="!fkPositionFilters.unit_type_id || fkPositionFilterLoading"
          @update:model-value="updatePositionFilter('unit_id', $event)"
          @change="$emit('fk-unit-change')"
        >
          <option value="">Todas</option>
          <option v-for="row in fkUnitOptions" :key="row.id" :value="String(row.id)">
            {{ formatFkOptionLabel("units", row) }}
          </option>
        </AdminSelectField>
      </AdminFieldGroup>
      <AdminFieldGroup label="Cargo" label-class="text-slate-700" group-class="md:col-span-4">
        <AdminSelectField
          :model-value="fkPositionFilters.cargo_id"
          :disabled="fkPositionFilterLoading"
          @update:model-value="updatePositionFilter('cargo_id', $event)"
          @change="$emit('fk-cargo-change')"
        >
          <option value="">Todos</option>
          <option v-for="row in fkCargoOptions" :key="row.id" :value="String(row.id)">
            {{ formatFkOptionLabel("cargos", row) }}
          </option>
        </AdminSelectField>
      </AdminFieldGroup>
      <div class="md:col-span-12 md:flex md:justify-end fk-inline-clear-col">
        <AdminButton
          variant="secondary"
          class-name="fk-inline-clear-btn"
          title="Limpiar filtro"
          aria-label="Limpiar filtro"
          :disabled="!fkPositionFilters.unit_type_id && !fkPositionFilters.unit_id && !fkPositionFilters.cargo_id"
          @click="$emit('clear-fk-unit-position-filters')"
        >
          <font-awesome-icon icon="times" />
        </AdminButton>
      </div>
    </div>

    <div v-if="fkLoading" class="text-sm text-slate-500">Cargando...</div>
    <div v-else-if="fkError" class="admin-inline-error" role="alert">{{ fkError }}</div>
    <AdminDataTable
      v-else
      :fields="fkSearchTableFields"
      :rows="fkRows"
      :row-key="(row) => row.id"
    >
      <template #cell="{ row, field }">
        <template v-if="field.name === '__primary'">
          {{ formatFkPrimaryCell(row) }}
        </template>
        <template v-else-if="field.name === 'available_formats'">
          <div class="available-formats-cell">
            <template v-if="getAvailableFormatSections(row[field.name]).length">
              <div
                v-for="section in getAvailableFormatSections(row[field.name])"
                :key="section.mode"
                class="available-formats-group"
                :class="{ 'is-inline': section.mode === 'user' }"
              >
                <span class="available-formats-mode">{{ section.label }}</span>
                <div class="available-formats-badges">
                  <span
                    v-for="entry in section.entries"
                    :key="`${section.mode}-${entry.format}`"
                    class="available-formats-badge"
                    :style="getAvailableFormatBadgeStyle(section.mode, entry)"
                  >
                    {{ entry.formatLabel }}
                  </span>
                </div>
              </div>
            </template>
            <span v-else>—</span>
          </div>
        </template>
        <template v-else>
          {{ formatFkListCell(row, field) }}
        </template>
      </template>
      <template #actions="{ row }">
        <div class="inline-flex items-center gap-1 fk-row-actions">
          <AdminButton
            variant="secondary"
            size="sm"
            icon-only
            class-name="hope-action-btn hope-action-view"
            title="Visualizar"
            aria-label="Visualizar"
            @click="$emit('open-fk-viewer', row)"
          >
            <font-awesome-icon icon="eye" />
          </AdminButton>
          <AdminButton
            variant="secondary"
            size="sm"
            icon-only
            class-name="hope-action-btn hope-action-select"
            title="Seleccionar"
            aria-label="Seleccionar"
            @click="$emit('select-fk-row', row)"
          >
            <font-awesome-icon icon="check" />
          </AdminButton>
        </div>
      </template>
    </AdminDataTable>
    <template #footer>
      <AdminButton
        v-if="canOpenFkFilterModal"
        variant="secondary"
        title="Buscar"
        aria-label="Buscar"
        @click="$emit('open-fk-filter')"
      >
        <font-awesome-icon icon="search" />
      </AdminButton>
      <AdminButton
        variant="outlinePrimary"
        :disabled="!canCreateFkReference"
        @click="$emit('open-fk-create')"
      >
        <font-awesome-icon icon="plus" class="mr-2" />
        Crear nuevo
      </AdminButton>
      <AdminButton variant="outlineDanger" data-modal-dismiss>
        Cerrar
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminDataTable from "@/views/admin/components/AdminDataTable.vue";
import AdminFieldGroup from "@/views/admin/components/AdminFieldGroup.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";

const props = defineProps({
  fkTable: { type: Object, default: null },
  isFkUnits: { type: Boolean, default: false },
  isFkProcessDefinitions: { type: Boolean, default: false },
  isFkTemplateArtifacts: { type: Boolean, default: false },
  isFkUnitPositions: { type: Boolean, default: false },
  fkSearch: { type: String, default: "" },
  fkFilters: { type: Object, default: () => ({}) },
  fkPositionFilters: { type: Object, default: () => ({}) },
  fkPositionFilterLoading: { type: Boolean, default: false },
  fkUnitTypeOptions: { type: Array, default: () => [] },
  fkUnitOptions: { type: Array, default: () => [] },
  fkCargoOptions: { type: Array, default: () => [] },
  fkProcessDefinitionProcessOptions: { type: Array, default: () => [] },
  hasFkProcessDefinitionFilters: { type: Boolean, default: false },
  hasFkTemplateArtifactFilters: { type: Boolean, default: false },
  fkLoading: { type: Boolean, default: false },
  fkError: { type: String, default: "" },
  fkSearchTableFields: { type: Array, default: () => [] },
  fkRows: { type: Array, default: () => [] },
  canOpenFkFilterModal: { type: Boolean, default: false },
  canCreateFkReference: { type: Boolean, default: false },
  formatFkOptionLabel: { type: Function, required: true },
  getFkTableFieldOptions: { type: Function, required: true },
  getFkTableField: { type: Function, required: true },
  formatSelectOptionLabel: { type: Function, required: true },
  formatFkPrimaryCell: { type: Function, required: true },
  formatFkListCell: { type: Function, required: true },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true }
});

const emit = defineEmits([
  "update:fkSearch",
  "update:fkFilters",
  "update:fkPositionFilters",
  "debounced-search",
  "fk-unit-type-change",
  "fk-unit-change",
  "fk-cargo-change",
  "process-definition-filter-change",
  "template-artifact-filter-change",
  "clear-fk-unit-position-filters",
  "clear-fk-process-definition-filters",
  "clear-fk-template-artifact-filters",
  "open-fk-viewer",
  "select-fk-row",
  "open-fk-filter",
  "open-fk-create"
]);

const modalRef = ref(null);

const updateFilter = (fieldName, value) => {
  emit("update:fkFilters", {
    ...props.fkFilters,
    [fieldName]: value
  });
};

const updatePositionFilter = (fieldName, value) => {
  emit("update:fkPositionFilters", {
    ...props.fkPositionFilters,
    [fieldName]: value
  });
};

defineExpose({
  el: modalRef
});
</script>
