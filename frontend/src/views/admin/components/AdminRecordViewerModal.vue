<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="recordViewerModalLabel"
    :title="`Visualizar registro ${recordViewerTable?.label || ''}`"
    size="xl"
    close-action
    @close="$emit('close')"
  >
    <div v-if="loading" class="text-muted">Cargando información del registro...</div>
    <div v-else-if="error" class="alert alert-danger mb-0">{{ error }}</div>
    <div v-else-if="recordViewerTable && recordViewerRow">
      <AdminDataTable
        :fields="summaryTableFields"
        :rows="displayRows"
        :row-key="(row) => row.id"
        table-class="table table-striped align-middle table-institutional"
        :show-header="false"
        responsive-class="table-responsive"
        scroll-class=""
      >
        <template #row="{ row }">
          <th class="text-start">{{ row.label }}</th>
          <td>
            <template v-if="row.field.name === 'available_formats'">
              <div class="available-formats-viewer">
                <template v-if="getAvailableFormatSections(recordViewerRow[row.field.name]).length">
                  <div v-for="section in getAvailableFormatSections(recordViewerRow[row.field.name])" :key="section.mode" class="available-formats-viewer-section">
                    <div class="available-formats-viewer-title">{{ section.label }}</div>
                    <div v-for="entry in section.entries" :key="`${section.mode}-${entry.format}`" class="available-formats-viewer-entry">
                      <span class="available-formats-badge is-viewer" :style="getAvailableFormatBadgeStyle(section.mode, entry)">{{ entry.formatLabel }}</span>
                      <code class="available-formats-path">{{ entry.entryObjectKey }}</code>
                    </div>
                  </div>
                </template>
                <span v-else>—</span>
              </div>
            </template>
            <template v-else>
              {{ formatRecordViewerValue(row.field, recordViewerRow) }}
            </template>
          </td>
        </template>
      </AdminDataTable>

      <div v-for="section in relatedSections" :key="section.key" class="mt-4">
        <h6 class="mb-2 person-subtitle">
          <font-awesome-icon icon="list-check" />
          <span>{{ section.label }}</span>
        </h6>
        <div v-if="section.error" class="alert alert-danger py-2 mb-0">{{ section.error }}</div>
        <div v-else-if="section.rows.length === 0" class="text-muted">Sin registros relacionados.</div>
        <AdminDataTable
          v-else
          :fields="section.fields"
          :rows="section.rows"
          :row-key="(sectionRow) => rowKeyForTable(section.tableMeta, sectionRow)"
          table-class="table table-sm table-striped align-middle"
          responsive-class="table-responsive"
          scroll-class=""
        >
          <template #cell="{ row: sectionRow, field }">
            {{ formatValueForTable(section.tableMeta, sectionRow[field.name], field, sectionRow) }}
          </template>
        </AdminDataTable>
      </div>
    </div>
    <div v-else class="text-muted">No hay información para visualizar.</div>
    <template #footer>
      <AdminButton variant="outlineDanger" @click="$emit('close')">Cerrar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminDataTable from "@/views/admin/components/AdminDataTable.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  recordViewerTable: { type: Object, default: null },
  recordViewerRow: { type: Object, default: null },
  summaryTableFields: { type: Array, default: () => [] },
  displayRows: { type: Array, default: () => [] },
  relatedSections: { type: Array, default: () => [] },
  formatRecordViewerValue: { type: Function, required: true },
  getAvailableFormatSections: { type: Function, required: true },
  getAvailableFormatBadgeStyle: { type: Function, required: true },
  rowKeyForTable: { type: Function, required: true },
  formatValueForTable: { type: Function, required: true }
});
defineEmits(["close"]);
const modalRef = ref(null);
defineExpose({ el: modalRef });
</script>
