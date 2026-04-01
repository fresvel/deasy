<template>
  <section class="mt-4 space-y-4">
      <div class="profile-section-header">
        <div>
          <h2 class="text-start profile-section-title table-title-with-icon">
            <span class="table-title-icon" aria-hidden="true">
              <font-awesome-icon icon="id-card" />
            </span>
            <span>Puestos sin ocupaciones</span>
          </h2>
          <p class="profile-section-subtitle mb-0">Gestiona puestos activos sin ocupacion actual.</p>
        </div>
        <div class="profile-section-actions">
          <span class="inline-flex min-w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">{{ rows.length }}</span>
        </div>
      </div>
      <div class="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div class="grid gap-3 lg:grid-cols-12 lg:items-center">
            <div class="md:col-span-4 lg:col-span-2">
              <AdminInputField :model-value="searchTerm" placeholder="Buscar puestos sin ocupaciones" @update:model-value="$emit('update:search-term', $event)" @input="$emit('debounced-search')" />
            </div>
            <div class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.unit_type_id" :disabled="filterLoading" @update:model-value="updateFilter('unit_type_id', $event)" @change="$emit('handle-type-change')">
                <option value="">Tipo de unidad</option>
                <option v-for="row in unitTypeOptions" :key="row.id" :value="String(row.id)">{{ formatFkOptionLabel("unit_types", row) }}</option>
              </AdminSelectField>
            </div>
            <div class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.unit_id" :disabled="!filters.unit_type_id || filterLoading" @update:model-value="updateFilter('unit_id', $event)" @change="$emit('handle-unit-change')">
                <option value="">Unidad</option>
                <option v-for="row in unitOptions" :key="row.id" :value="String(row.id)">{{ formatFkOptionLabel("units", row) }}</option>
              </AdminSelectField>
            </div>
            <div class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.cargo_id" :disabled="filterLoading" @update:model-value="updateFilter('cargo_id', $event)" @change="$emit('handle-cargo-change')">
                <option value="">Cargo</option>
                <option v-for="row in cargoOptions" :key="row.id" :value="String(row.id)">{{ formatFkOptionLabel("cargos", row) }}</option>
              </AdminSelectField>
            </div>
            <div class="md:col-span-4 lg:col-span-2">
              <AdminSelectField :model-value="filters.position_type" :disabled="filterLoading" @update:model-value="updateFilter('position_type', $event)" @change="$emit('handle-position-type-filter-change')">
                <option value="">Tipo de puesto</option>
                <option value="real">Real</option>
                <option value="promocion">Promocion</option>
                <option value="simbolico">Simbolico</option>
                </AdminSelectField>
              </div>
            <div class="md:col-span-4 lg:col-span-2 lg:justify-self-end">
              <div class="inline-flex items-center gap-2">
                <AdminButton variant="secondary" size="lg" title="Limpiar filtros" aria-label="Limpiar filtros" :disabled="!hasFilters" @click="$emit('clear-filters')">
                  <font-awesome-icon icon="times" />
                </AdminButton>
                <AdminButton variant="secondary" size="lg" title="Actualizar" aria-label="Actualizar" @click="$emit('load')">
                  <font-awesome-icon icon="rotate-right" />
                </AdminButton>
              </div>
            </div>
          </div>

          <div v-if="loading" class="text-sm text-slate-500">Cargando puestos sin ocupaciones...</div>
          <div v-else-if="error" class="admin-inline-error" role="alert">{{ error }}</div>
          <AdminDataTable v-else :fields="tableFields" :rows="rows" :row-key="(row) => `vacant-${row.id}`" empty-text="No hay puestos disponibles sin ocupaciones.">
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
            <template #actions="{ row }">
              <div class="inline-flex items-center gap-1">
                <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-delete" title="Desactivar" aria-label="Desactivar" @click="$emit('deactivate', row)">
                  <font-awesome-icon icon="times-circle" />
                </AdminButton>
                <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-edit" title="Asignar" aria-label="Asignar" @click="$emit('assign', row)">
                  <font-awesome-icon icon="user-plus" />
                </AdminButton>
              </div>
            </template>
          </AdminDataTable>
      </div>
  </section>
</template>

<script setup>
import AdminButton from "@/components/AppButton.vue";
import AdminDataTable from "@/components/AppDataTable.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";

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
  formatPositionType: { type: Function, required: true }
});

const emit = defineEmits(["update:search-term", "update:filters", "debounced-search", "handle-type-change", "handle-unit-change", "handle-cargo-change", "handle-position-type-filter-change", "clear-filters", "load", "deactivate", "assign"]);

const updateFilter = (field, value) => emit("update:filters", { ...props.filters, [field]: value });
</script>
