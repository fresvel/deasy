<template>
  <AppModalShell
    ref="modalRef"
    labelled-by="sqlFkModalLabel"
    :title="modalTitle"
    :size="isFkTemplateArtifacts || isFkProcessDefinitions ? 'lg' : 'md'"
  >
    <!-- Solo plantillas: dos pestañas — Crear una nueva, o Seleccionar una existente (lista filtrable). -->
    <div v-if="createTabEnabled" class="mt-1 mb-3">
      <div class="deasy-inline-tabs" role="tablist" aria-label="Crear o seleccionar plantilla">
        <button type="button" role="tab" class="deasy-inline-tab" :class="{ 'deasy-inline-tab--active': activeTab === 'create' }" :aria-selected="activeTab === 'create'" @click="$emit('update:activeTab', 'create')"><IconPlus class="deasy-inline-tab__icon" /><span class="truncate">Crear nueva</span></button>
        <button type="button" role="tab" class="deasy-inline-tab" :class="{ 'deasy-inline-tab--active': activeTab === 'select' }" :aria-selected="activeTab === 'select'" @click="$emit('update:activeTab', 'select')"><IconListSearch class="deasy-inline-tab__icon" /><span class="truncate">Seleccionar existente</span></button>
      </div>
    </div>

    <div v-if="createTabEnabled" v-show="activeTab === 'create'">
      <slot name="create" />
    </div>

    <div v-show="!createTabEnabled || activeTab === 'select'">
    <div class="grid gap-3 md:grid-cols-12 md:items-end mb-3">
      <template v-if="isFkUnits">
        <AdminFieldGroup label="Busqueda" label-class="text-body" group-class="md:col-span-7">
          <AdminInputField
            :model-value="fkSearch"
            placeholder="Buscar referencia"
            @update:model-value="$emit('update:fkSearch', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Tipo de unidad" label-class="text-body" group-class="md:col-span-4">
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
        <div class="md:col-span-1 md:flex md:items-end md:justify-end">
          <AdminButton
            variant="secondary"
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
        <AdminFieldGroup label="Busqueda" label-class="text-body" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkSearch"
            placeholder="Buscar referencia"
            @update:model-value="$emit('update:fkSearch', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Proceso" label-class="text-body" group-class="md:col-span-3">
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
        <AdminFieldGroup label="Variación" label-class="text-body" group-class="md:col-span-3">
          <AdminInputField
            :model-value="fkFilters.variation_key"
            placeholder="Filtrar por variación"
            @update:model-value="updateFilter('variation_key', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <div class="md:col-span-1 md:flex md:items-end md:justify-end">
          <AdminButton
            variant="secondary"
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
        <AdminFieldGroup label="Busqueda" label-class="text-body" group-class="md:col-span-4">
          <AdminInputField
            :model-value="fkSearch"
            placeholder="Buscar por nombre"
            @update:model-value="$emit('update:fkSearch', $event)"
            @input="$emit('debounced-search')"
          />
        </AdminFieldGroup>
        <AdminFieldGroup label="Proceso" label-class="text-body" group-class="md:col-span-4">
          <AdminSelectField
            :model-value="fkFilters.process_id"
            @update:model-value="updateFilter('process_id', $event)"
            @change="$emit('template-artifact-filter-change')"
          >
            <option value="">Todos</option>
            <option v-for="row in fkProcessDefinitionProcessOptions" :key="row.id" :value="String(row.id)">
              {{ formatFkOptionLabel("processes", row) }}
            </option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Activo" label-class="text-body" group-class="md:col-span-3">
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
        <div class="md:col-span-1 md:flex md:items-end md:justify-end">
          <AdminButton
            variant="secondary"
            title="Limpiar filtro"
            aria-label="Limpiar filtro"
            :disabled="!hasFkTemplateArtifactFilters"
            @click="$emit('clear-fk-template-artifact-filters')"
          >
            <font-awesome-icon icon="times" />
          </AdminButton>
        </div>
      </template>
      <AdminFieldGroup v-else label="Busqueda" label-class="text-body" group-class="md:col-span-12">
        <AdminInputField
          :model-value="fkSearch"
          placeholder="Buscar referencia"
          @update:model-value="$emit('update:fkSearch', $event)"
          @input="$emit('debounced-search')"
        />
      </AdminFieldGroup>
    </div>

    <div v-if="isFkTemplateArtifacts && hasProcessFilterContext" class="mb-3 flex items-center gap-2">
      <!-- Era un `role="switch"` de 13 lineas escrito a mano, con su propio ancho (36 px frente a
           los 44 de SToggle) y su propio color activo (`blue-light-600` en vez de `primary`).
           SToggle existe desde antes y ya lo usan el wizard de procesos y el editor de borradores. -->
      <SToggle
        :model-value="processContextFilterActive"
        label="Solo plantillas de este proceso"
        label-position="end"
        @update:model-value="toggleProcessContextFilter"
      />
    </div>

    <div v-if="isFkUnitPositions" class="mb-3 grid gap-3 md:grid-cols-12 md:items-end">
      <AdminFieldGroup label="Tipo de unidad" label-class="text-body" group-class="md:col-span-4">
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
      <AdminFieldGroup label="Unidad" label-class="text-body" group-class="md:col-span-4">
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
      <AdminFieldGroup label="Cargo" label-class="text-body" group-class="md:col-span-4">
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
      <div class="md:col-span-12 md:flex md:justify-end">
        <AdminButton
          variant="secondary"
          title="Limpiar filtro"
          aria-label="Limpiar filtro"
          :disabled="!fkPositionFilters.unit_type_id && !fkPositionFilters.unit_id && !fkPositionFilters.cargo_id"
          @click="$emit('clear-fk-unit-position-filters')"
        >
          <font-awesome-icon icon="times" />
        </AdminButton>
      </div>
    </div>

    <div v-if="fkLoading" class="text-sm text-muted">Cargando...</div>
    <div v-else-if="fkError" role="alert">{{ fkError }}</div>
    <AppDataTable
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
          <div>
            <template v-if="getAvailableFormatSections(row[field.name]).length">
              <div
                v-for="section in getAvailableFormatSections(row[field.name])"
                :key="section.mode"
                :class="{ 'is-inline': section.mode === 'reference' }"
              >
                <span>{{ section.label }}</span>
                <div>
                  <span
                    v-for="entry in section.entries"
                    :key="`${section.mode}-${entry.format}`"
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
        <div class="inline-flex items-center gap-1">
          <AdminButton
            variant="softInfo"
            size="sm"
            icon-only
            title="Visualizar"
            aria-label="Visualizar"
            @click="$emit('open-fk-viewer', row)"
          >
            <font-awesome-icon icon="eye" />
          </AdminButton>
          <AdminButton
            variant="softSuccess"
            size="sm"
            icon-only
            title="Seleccionar"
            aria-label="Seleccionar"
            @click="$emit('select-fk-row', row)"
          >
            <font-awesome-icon icon="check" />
          </AdminButton>
        </div>
      </template>
    </AppDataTable>
    </div>
    <template #footer>
      <template v-if="!createTabEnabled || activeTab === 'select'">
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
          v-if="!createTabEnabled"
          variant="outlinePrimary"
          :disabled="!canCreateFkReference"
          :title="fkCreateActionLabel"
          :aria-label="fkCreateActionLabel"
          @click="$emit('open-fk-create')"
        >
          <font-awesome-icon icon="plus" class="mr-2" />
          {{ fkCreateActionLabel }}
        </AdminButton>
      </template>
      <AdminButton variant="secondary" data-modal-dismiss>
        Cerrar
      </AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { IconListSearch, IconPlus } from "@tabler/icons-vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";

const props = defineProps({
  fkTable: { type: Object, default: null },
  // Habilita las pestañas Crear/Seleccionar (solo en el flujo de plantillas dentro de config de proceso).
  createTabEnabled: { type: Boolean, default: false },
  // Pestaña activa (v-model): "select" | "create".
  activeTab: { type: String, default: "select" },
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
  // process_id del proceso al que pertenece la configuración desde la que se abrió el picker. Habilita el
  // switch que acota la lista de plantillas existentes a ese proceso.
  processFilterContextId: { type: [String, Number], default: "" },
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
  "open-fk-create",
  "update:activeTab"
]);

const modalRef = ref(null);

const modalTitle = computed(() => {
  if (props.isFkTemplateArtifacts) {
    return "Seleccionar plantilla";
  }
  return `Buscar referencia ${props.fkTable?.label || ""}`;
});

const fkCreateActionLabel = computed(() =>
  props.isFkTemplateArtifacts ? "Crear plantilla" : "Crear nuevo"
);

const updateFilter = (fieldName, value) => {
  emit("update:fkFilters", {
    ...props.fkFilters,
    [fieldName]: value
  });
};

// El switch "Solo de este proceso" es un atajo: deja el filtro Proceso fijado al proceso de la configuración
// de origen. Su estado se deriva del filtro vigente, así el select Proceso y el switch quedan sincronizados.
const hasProcessFilterContext = computed(() => String(props.processFilterContextId ?? "") !== "");
const processContextFilterActive = computed(() =>
  hasProcessFilterContext.value
  && String(props.fkFilters.process_id ?? "") === String(props.processFilterContextId)
);
const toggleProcessContextFilter = () => {
  const next = processContextFilterActive.value ? "" : String(props.processFilterContextId ?? "");
  emit("update:fkFilters", { ...props.fkFilters, process_id: next });
  emit("template-artifact-filter-change");
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
