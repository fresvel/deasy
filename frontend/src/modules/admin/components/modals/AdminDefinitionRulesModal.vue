<template>
  <AdminDefinitionRulesPanel
    v-if="embedded"
    v-bind="panelBindings"
    v-on="panelListeners"
  />
  <AdminModalShell
    v-else
    ref="modalRef"
    labelled-by="definitionRulesModalLabel"
    title="Reglas de la configuracion"
    size="xl"
    close-action
    @close="$emit('close')"
  >
    <AdminDefinitionRulesPanel
      v-bind="panelBindings"
      v-on="panelListeners"
    />
    <template #footer>
      <AdminButton variant="outlineDanger" @click="$emit('close')">Cerrar</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('accept')">Aceptar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref, computed } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminDefinitionRulesPanel from "@/modules/admin/components/modals/AdminDefinitionRulesPanel.vue";

const props = defineProps({
  embedded: { type: Boolean, default: false },
  context: { type: Object, default: null },
  error: { type: String, default: "" },
  canManage: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  labels: { type: Object, default: () => ({}) },
  form: { type: Object, default: () => ({}) },
  editId: { type: [String, Number], default: "" },
  loading: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  seriesScope: { type: Object, default: null },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits([
  "update:form",
  "scope-change",
  "recipient-policy-change",
  "clear-field",
  "open-fk-search",
  "submit",
  "reset",
  "view-row",
  "edit-row",
  "delete-row",
  "close",
  "accept"
]);
const modalRef = ref(null);

const panelBindings = computed(() => ({
  context: props.context,
  error: props.error,
  canManage: props.canManage,
  canSubmit: props.canSubmit,
  labels: props.labels,
  form: props.form,
  editId: props.editId,
  loading: props.loading,
  rows: props.rows,
  tableFields: props.tableFields,
  seriesScope: props.seriesScope,
  formatCell: props.formatCell
}));

const panelListeners = {
  "update:form": (value) => emit("update:form", value),
  "scope-change": (value) => emit("scope-change", value),
  "recipient-policy-change": (value) => emit("recipient-policy-change", value),
  "clear-field": (field) => emit("clear-field", field),
  "open-fk-search": (field) => emit("open-fk-search", field),
  submit: () => emit("submit"),
  reset: () => emit("reset"),
  "view-row": (row) => emit("view-row", row),
  "edit-row": (row) => emit("edit-row", row),
  "delete-row": (row) => emit("delete-row", row)
};

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
