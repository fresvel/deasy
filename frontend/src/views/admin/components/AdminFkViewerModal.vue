<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlFkViewerModalLabel"
    :title="`Visualizar referencia ${fkTable?.label || ''}`"
    size="lg"
    close-action
    @close="$emit('close')"
  >
    <div v-if="!fkViewerRow" class="text-muted">No hay información para visualizar.</div>
    <AdminDataTable
      v-else
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
        <td>{{ formatFkViewerValue(row.field, fkViewerRow) }}</td>
      </template>
    </AdminDataTable>
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
  fkTable: { type: Object, default: null },
  fkViewerRow: { type: Object, default: null },
  summaryTableFields: { type: Array, default: () => [] },
  displayRows: { type: Array, default: () => [] },
  formatFkViewerValue: { type: Function, required: true }
});
defineEmits(["close"]);
const modalRef = ref(null);
defineExpose({ el: modalRef });
</script>
