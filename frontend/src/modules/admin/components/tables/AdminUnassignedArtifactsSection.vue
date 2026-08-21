<template>
  <section class="mt-4 space-y-4">
      <div class="deasy-card p-4">
          <div class="deasy-filter-shell deasy-filter-shell--embedded">
            <div class="deasy-filter-grid deasy-filter-grid--admin">
              <div class="md:col-span-4 lg:col-span-3">
                <AdminInputField :model-value="searchTerm" input-class="deasy-control" placeholder="Buscar plantillas sin configuracion" @update:model-value="$emit('update:search-term', $event)" @input="$emit('debounced-search')" />
              </div>
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="filters.is_active" select-class="deasy-control" :disabled="loading" @update:model-value="updateFilter('is_active', $event)" @change="$emit('load')">
                  <option value="">Activo</option>
                  <option value="1">Si</option>
                  <option value="0">No</option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-4 lg:col-span-2 lg:col-start-11 lg:justify-self-end">
                <div class="deasy-filter-actions">
                  <AdminButton variant="neutral-outline" icon-only title="Limpiar filtros" aria-label="Limpiar filtros" :disabled="!hasFilters" @click="$emit('clear-filters')"><font-awesome-icon icon="times" /></AdminButton>
                  <AdminButton variant="primary-outline" icon-only title="Buscar" aria-label="Buscar" @click="$emit('load')"><font-awesome-icon icon="search" /></AdminButton>
                  <AdminButton variant="primary-outline" icon-only title="Actualizar" aria-label="Actualizar" @click="$emit('load')"><font-awesome-icon icon="rotate-right" /></AdminButton>
                </div>
              </div>
            </div>
          </div>

          <div v-if="loading" class="text-sm text-muted">Cargando plantillas sin configuracion...</div>
          <div v-else-if="error" role="alert">{{ error }}</div>
          <AppDataTable v-else :fields="tableFields" :rows="rows" :row-key="(row) => `artifact-free-${row.id}`" empty-text="No hay plantillas sin configuracion.">
            <template #cell="{ row, field }">
              <template v-if="field.name === 'available_formats'">
                <div>
                  <template v-if="getAvailableFormatSections(row.available_formats).length">
                    <div v-for="section in getAvailableFormatSections(row.available_formats)" :key="section.mode" :class="{ 'is-inline': section.mode === 'reference' }">
                      <span>{{ section.label }}</span>
                      <div>
                        <AppTag v-for="entry in section.entries" :key="`${section.mode}-${entry.format}`" variant="neutral" outlined>
                          {{ entry.formatLabel }}
                        </AppTag>
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
              <div class="inline-flex items-center gap-2">
                <AdminButton variant="info-soft" icon-only title="Visualizar" aria-label="Visualizar" @click="$emit('view', row)">
                  <font-awesome-icon icon="eye" />
                </AdminButton>
                <AdminButton v-if="canLink" variant="success-soft" icon-only title="Vincular" aria-label="Vincular" @click="$emit('link', row)">
                  <font-awesome-icon icon="link" />
                </AdminButton>
              </div>
            </template>
          </AppDataTable>
      </div>
  </section>
</template>

<script setup>
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
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
  canLink: { type: Boolean, default: true }
});

const emit = defineEmits(["update:search-term", "update:filters", "debounced-search", "clear-filters", "load", "view", "link"]);
const updateFilter = (field, value) => emit("update:filters", { ...props.filters, [field]: value });
</script>
