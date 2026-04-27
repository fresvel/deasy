<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlFkViewerModalLabel"
    :title="`Visualizar referencia ${fkTable?.label || ''}`"
    size="lg"
    close-action
    @close="$emit('close')"
  >
    <div v-if="!fkViewerRow" class="text-sm text-slate-500">No hay información para visualizar.</div>
    <AdminDataTable
      v-else
      :fields="summaryTableFields"
      :rows="displayRows"
      :row-key="(row) => row.id"
      table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
      :show-header="false"
      responsive-class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
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
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";

defineProps({
  fkTable: { type: Object, default: null },
  fkViewerRow: { type: Object, default: null },
  summaryTableFields: { type: Array, default: () => [] },
  displayRows: { type: Array, default: () => [] },
  formatFkViewerValue: { type: Function, required: true }
});
defineEmits(["close"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
