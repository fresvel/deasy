<template>
  <div class="row mt-4">
    <div class="col-12">
      <div class="profile-section-header mb-3">
        <div>
          <h2 class="text-start profile-section-title table-title-with-icon">
            <span class="table-title-icon" aria-hidden="true">
              <font-awesome-icon icon="layer-group" />
            </span>
            <span>Artifacts sin definicion</span>
          </h2>
          <p class="profile-section-subtitle mb-0">Muestra artifacts que aun no tienen ningun vinculo en plantillas de definicion.</p>
        </div>
        <div class="profile-section-actions">
          <span class="badge text-bg-light">{{ rows.length }}</span>
        </div>
      </div>
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="row g-3 align-items-center mb-3">
            <div class="col-12 col-md-4 col-lg-3">
              <AdminInputField :model-value="searchTerm" placeholder="Buscar artifacts sin definicion" @update:model-value="$emit('update:search-term', $event)" @input="$emit('debounced-search')" />
            </div>
            <div class="col-12 col-md-4 col-lg-2">
              <AdminSelectField :model-value="filters.is_active" :disabled="loading" @update:model-value="updateFilter('is_active', $event)" @change="$emit('load')">
                <option value="">Activo</option>
                <option value="1">Si</option>
                <option value="0">No</option>
              </AdminSelectField>
            </div>
            <div class="col-12 col-md-4 col-lg-2 text-lg-end ms-lg-auto">
              <div class="d-inline-flex align-items-center gap-2">
                <AdminButton variant="secondary" size="lg" title="Limpiar filtros" aria-label="Limpiar filtros" :disabled="!hasFilters" @click="$emit('clear-filters')">
                  <font-awesome-icon icon="times" />
                </AdminButton>
                <AdminButton variant="secondary" size="lg" title="Actualizar" aria-label="Actualizar" @click="$emit('load')">
                  <font-awesome-icon icon="rotate-right" />
                </AdminButton>
              </div>
            </div>
          </div>

          <div v-if="loading" class="text-muted">Cargando artifacts sin definicion...</div>
          <div v-else-if="error" class="admin-inline-error" role="alert">{{ error }}</div>
          <AdminDataTable v-else :fields="tableFields" :rows="rows" :row-key="(row) => `artifact-free-${row.id}`" empty-text="No hay artifacts sin definicion.">
            <template #cell="{ row, field }">
              <template v-if="field.name === 'available_formats'">
                <div class="available-formats-cell">
                  <template v-if="getAvailableFormatSections(row.available_formats).length">
                    <div v-for="section in getAvailableFormatSections(row.available_formats)" :key="section.mode" class="available-formats-group" :class="{ 'is-inline': section.mode === 'user' }">
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
              <div class="d-inline-flex align-items-center gap-1">
                <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-view" title="Visualizar" aria-label="Visualizar" @click="$emit('view', row)">
                  <font-awesome-icon icon="eye" />
                </AdminButton>
                <AdminButton variant="secondary" size="sm" icon-only class-name="hope-action-btn hope-action-edit" title="Vincular" aria-label="Vincular" @click="$emit('link', row)">
                  <font-awesome-icon icon="link" />
                </AdminButton>
              </div>
            </template>
          </AdminDataTable>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminDataTable from "@/views/admin/components/AdminDataTable.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";

const props = defineProps({
  searchTerm: { type: String, default: "" },
  filters: { type: Object, default: () => ({}) },
  hasFilters: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true }
});

const emit = defineEmits(["update:search-term", "update:filters", "debounced-search", "clear-filters", "load", "view", "link"]);
const updateFilter = (field, value) => emit("update:filters", { ...props.filters, [field]: value });
</script>
