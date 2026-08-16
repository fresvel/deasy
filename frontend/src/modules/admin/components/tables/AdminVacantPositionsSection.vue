<template>
  <section class="mt-4 space-y-4">
      <div class="admin-surface-frame">
          <div class="deasy-filter-shell deasy-filter-shell--embedded">
          <div class="deasy-filter-grid deasy-filter-grid--admin">
            <div class="md:col-span-4 lg:col-span-2">
              <AdminInputField :model-value="searchTerm" input-class="deasy-control" placeholder="Buscar puestos sin ocupaciones" @update:model-value="$emit('update:search-term', $event)" @input="$emit('debounced-search')" />
            </div>
            <div v-if="showAdvancedFilters" class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.unit_type_id" select-class="deasy-control" :disabled="filterLoading" @update:model-value="updateFilter('unit_type_id', $event)" @change="$emit('handle-type-change')">
                <option value="">Tipo de unidad</option>
                <option v-for="row in unitTypeOptions" :key="row.id" :value="String(row.id)">{{ formatFkOptionLabel("unit_types", row) }}</option>
              </AdminSelectField>
            </div>
            <div v-if="showAdvancedFilters" class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.unit_id" select-class="deasy-control" :disabled="!filters.unit_type_id || filterLoading" @update:model-value="updateFilter('unit_id', $event)" @change="$emit('handle-unit-change')">
                <option value="">Unidad</option>
                <option v-for="row in unitOptions" :key="row.id" :value="String(row.id)">{{ formatFkOptionLabel("units", row) }}</option>
              </AdminSelectField>
            </div>
            <div v-if="showAdvancedFilters" class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.cargo_id" select-class="deasy-control" :disabled="filterLoading" @update:model-value="updateFilter('cargo_id', $event)" @change="$emit('handle-cargo-change')">
                <option value="">Cargo</option>
                <option v-for="row in cargoOptions" :key="row.id" :value="String(row.id)">{{ formatFkOptionLabel("cargos", row) }}</option>
              </AdminSelectField>
            </div>
            <div v-if="showAdvancedFilters" class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.position_type" select-class="deasy-control" :disabled="filterLoading" @update:model-value="updateFilter('position_type', $event)" @change="$emit('handle-position-type-filter-change')">
                <option value="">Tipo de puesto</option>
                <option value="real">Real</option>
                <option value="promocion">Promocion</option>
                <option value="simbolico">Simbolico</option>
                </AdminSelectField>
              </div>
            <div class="md:col-span-4 lg:col-span-2 lg:justify-self-end">
              <div class="deasy-filter-actions">
                <AdminButton variant="neutralOutline" icon-only size="sm" title="Limpiar filtros" aria-label="Limpiar filtros" :disabled="!hasFilters" @click="$emit('clear-filters')"><font-awesome-icon icon="times" /></AdminButton>
                <AdminButton variant="primaryOutline" icon-only size="sm" title="Buscar" aria-label="Buscar" @click="$emit('load')"><font-awesome-icon icon="search" /></AdminButton>
                <AdminButton
                  variant="neutralOutline"
                  size="sm"
                  icon-only
                  :title="showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'"
                  :aria-label="showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'"
                  @click="showAdvancedFilters = !showAdvancedFilters"
                >
                  <font-awesome-icon :icon="showAdvancedFilters ? 'arrow-up' : 'arrow-down'" />
                </AdminButton>
                <AdminButton variant="primary" icon-only size="sm" title="Actualizar" aria-label="Actualizar" @click="$emit('load')"><font-awesome-icon icon="rotate-right" /></AdminButton>
              </div>
            </div>
          </div>
          </div>

          <div v-if="loading" class="text-sm text-muted">Cargando puestos sin ocupaciones...</div>
          <div v-else-if="error" role="alert">{{ error }}</div>
          <AppDataTable v-else :fields="tableFields" :rows="rows" :row-key="(row) => `vacant-${row.id}`" empty-text="No hay puestos disponibles sin ocupaciones.">
            <template #cell="{ row, field }">
              <template v-if="field.name === '__unit_type_id'">
                {{ formatFkListCell(row, { name: "__unit_type_id" }) }}
              </template>
              <template v-else-if="field.name === 'unit_id'">
                {{ formatCell(row.unit_id, { name: "unit_id" }, row) }}
              </template>
              <template v-else-if="field.name === 'cargo_id'">
                {{ formatCell(row.cargo_id, { name: "cargo_id" }, row) }}
              </template>
              <template v-else-if="field.name === 'position_type'">
                {{ formatPositionType(row.position_type) }}
              </template>
              <template v-else>
                {{ row[field.name] ?? "—" }}
              </template>
            </template>
            <template v-if="canUpdate" #actions="{ row }">
              <div class="inline-flex items-center gap-1">
                <AdminButton variant="dangerSoft" size="sm" icon-only title="Desactivar" aria-label="Desactivar" @click="$emit('deactivate', row)">
                  <font-awesome-icon icon="times-circle" />
                </AdminButton>
                <AdminButton variant="successSoft" size="sm" icon-only title="Asignar" aria-label="Asignar" @click="$emit('assign', row)">
                  <font-awesome-icon icon="user-plus" />
                </AdminButton>
              </div>
            </template>
          </AppDataTable>
      </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";

const props = defineProps({
  searchTerm: { type: String, default: "" },
  filters: { type: Object, default: () => ({}) },
  filterLoading: { type: Boolean, default: false },
  hasFilters: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  rows: { type: Array, default: () => [] },
  unitTypeOptions: { type: Array, default: () => [] },
  unitOptions: { type: Array, default: () => [] },
  cargoOptions: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  formatFkOptionLabel: { type: Function, required: true },
  formatFkListCell: { type: Function, required: true },
  formatCell: { type: Function, required: true },
  formatPositionType: { type: Function, required: true },
  canUpdate: { type: Boolean, default: true }
});

const emit = defineEmits(["update:search-term", "update:filters", "debounced-search", "handle-type-change", "handle-unit-change", "handle-cargo-change", "handle-position-type-filter-change", "clear-filters", "load", "deactivate", "assign"]);

const showAdvancedFilters = ref(false);

const updateFilter = (field, value) => emit("update:filters", { ...props.filters, [field]: value });
</script>
