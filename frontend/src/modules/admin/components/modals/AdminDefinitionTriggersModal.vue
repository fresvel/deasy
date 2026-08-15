<template>
  <AdminDefinitionTriggersPanel
    v-if="embedded"
    v-bind="panelBindings"
    v-on="panelListeners"
  />
  <AppModalShell
    v-else
    ref="modalRef"
    labelled-by="definitionTriggersModalLabel"
    title="Periodos del proceso"
    size="xl"
    close-action
    @close="$emit('close')"
  >
    <AdminDefinitionTriggersPanel
      v-bind="panelBindings"
      v-on="panelListeners"
    />
    <template #footer>
      <AdminButton variant="secondary" @click="$emit('close')">Cerrar</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('accept')">Aceptar</AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref, computed } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminDefinitionTriggersPanel from "@/modules/admin/components/modals/AdminDefinitionTriggersPanel.vue";

const props = defineProps({
  embedded: { type: Boolean, default: false },
  context: { type: Object, default: null },
  error: { type: String, default: "" },
  canManage: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  requiresTermType: { type: Boolean, default: false },
  labels: { type: Object, default: () => ({}) },
  form: { type: Object, default: () => ({}) },
  editId: { type: [String, Number], default: "" },
  loading: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  suggestProvider: { type: Function, default: null },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits(["update:form", "trigger-mode-change", "clear-term-type", "select-term-type", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row", "close", "accept"]);
const modalRef = ref(null);

const panelBindings = computed(() => ({
  context: props.context,
  error: props.error,
  canManage: props.canManage,
  canSubmit: props.canSubmit,
  requiresTermType: props.requiresTermType,
  labels: props.labels,
  form: props.form,
  editId: props.editId,
  loading: props.loading,
  rows: props.rows,
  tableFields: props.tableFields,
  suggestProvider: props.suggestProvider,
  formatCell: props.formatCell
}));

const panelListeners = {
  "update:form": (value) => emit("update:form", value),
  "trigger-mode-change": () => emit("trigger-mode-change"),
  "clear-term-type": () => emit("clear-term-type"),
  "select-term-type": (option) => emit("select-term-type", option),
  "open-fk-search": () => emit("open-fk-search"),
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
