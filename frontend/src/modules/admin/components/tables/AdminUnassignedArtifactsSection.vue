<template>
  <section class="mt-4 space-y-4">
      <div class="admin-surface-frame">
          <div class="deasy-filter-shell deasy-filter-shell--embedded">
            <div class="deasy-filter-grid deasy-filter-grid--admin">
              <div class="md:col-span-4 lg:col-span-3">
                <AdminInputField :model-value="searchTerm" input-class="deasy-filter-control" placeholder="Buscar plantillas sin configuracion" @update:model-value="$emit('update:search-term', $event)" @input="$emit('debounced-search')" />
              </div>
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="filters.is_active" select-class="deasy-filter-control" :disabled="loading" @update:model-value="updateFilter('is_active', $event)" @change="$emit('load')">
                  <option value="">Activo</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-4 lg:col-span-2 lg:col-start-11 lg:justify-self-end">
                <div class="deasy-filter-actions">
                  <AdminButton variant="secondary" size="sm" class-name="deasy-filter-btn" title="Limpiar filtros" aria-label="Limpiar filtros" :disabled="!hasFilters" @click="$emit('clear-filters')">
                    <font-awesome-icon icon="times" />
                    <span>Reset</span>
                  </AdminButton>
                  <AdminButton variant="outlinePrimary" size="sm" class-name="deasy-filter-btn" title="Buscar" aria-label="Buscar" @click="$emit('load')">
                    <font-awesome-icon icon="search" />
                    <span>Search</span>
                  </AdminButton>
                </div>
              </div>
            </div>
            <div class="deasy-filter-toolbar">
              <div class="deasy-filter-summary"></div>
              <div class="deasy-filter-actions">
                <AdminButton variant="primary" size="sm" class-name="deasy-filter-btn" title="Refresh" aria-label="Refresh" @click="$emit('load')">
                  <font-awesome-icon icon="rotate-right" />
                  <span>Refresh</span>
                </AdminButton>
              </div>
            </div>
          </div>

          <div v-if="loading" class="text-sm text-slate-500">Cargando plantillas sin configuracion...</div>
          <div v-else-if="error" class="admin-inline-error" role="alert">{{ error }}</div>
          <AdminDataTable v-else :fields="tableFields" :rows="rows" :row-key="(row) => `artifact-free-${row.id}`" empty-text="No hay plantillas sin configuracion.">
            <template #cell="{ row, field }">
              <template v-if="field.name === 'available_formats'">
                <div class="available-formats-cell">
                  <template v-if="getAvailableFormatSections(row.available_formats).length">
                    <div v-for="section in getAvailableFormatSections(row.available_formats)" :key="section.mode" class="available-formats-group" :class="{ 'is-inline': section.mode === 'general' }">
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
              <template v-else-if="field.name === 'is_active'">
                {{ Number(row.is_active) === 1 ? "Si" : "No" }}
              </template>
              <template v-else>
                {{ row[field.name] ?? "—" }}
              </template>
            </template>
            <template #actions="{ row }">
              <div class="inline-flex items-center gap-1">
                <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-view" title="Visualizar" aria-label="Visualizar" @click="$emit('view', row)">
                  <font-awesome-icon icon="eye" />
                </AdminButton>
                <AdminButton v-if="canLink" variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-edit" title="Vincular" aria-label="Vincular" @click="$emit('link', row)">
                  <font-awesome-icon icon="link" />
                </AdminButton>
              </div>
            </template>
          </AdminDataTable>
      </div>
  </section>
</template>

<script setup>
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";

const props = defineProps({
  searchTerm: { type: String, default: "" },
  filters: { type: Object, default: () => ({}) },
  hasFilters: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true },
  canLink: { type: Boolean, default: true }
});

const emit = defineEmits(["update:search-term", "update:filters", "debounced-search", "clear-filters", "load", "view", "link"]);
const updateFilter = (field, value) => emit("update:filters", { ...props.filters, [field]: value });
</script>
