<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="processDefinitionActivationModalLabel"
    title="Activar definicion"
    dialog-class="definition-activation-shell"
    close-action
    @close="$emit('cancel')"
  >
    <ProcessActivationPanel
      :checking="checking"
      :has-active-rules="hasActiveRules"
      :has-active-triggers="hasActiveTriggers"
      :has-required-artifacts="hasRequiredArtifacts"
      :requires-artifacts="requiresArtifacts"
      :view="view"
      :selected-row="selectedRow"
      :rules="rules"
      :triggers="triggers"
      :artifacts="artifacts"
      :rule-table-fields="ruleTableFields"
      :trigger-table-fields="triggerTableFields"
      :artifact-table-fields="artifactTableFields"
      :format-cell="formatCell"
      :format-definition-rule-summary="formatDefinitionRuleSummary"
      @update:view="$emit('update:view', $event)"
    />
    <template #footer>
      <AdminButton variant="cancel" @click="$emit('cancel')">Cancelar</AdminButton>
      <AdminButton variant="outlinePrimary" :disabled="checking || !primaryAction" @click="$emit('primary-action')">{{ primaryActionLabel }}</AdminButton>
      <AdminButton variant="success" :disabled="checking || !allRequirementsMet" @click="$emit('confirm')">Activar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import ProcessActivationPanel from "@/modules/admin/components/modals/ProcessActivationPanel.vue";

defineProps({
  checking: { type: Boolean, default: false },
  hasActiveRules: { type: Boolean, default: false },
  hasActiveTriggers: { type: Boolean, default: false },
  hasRequiredArtifacts: { type: Boolean, default: false },
  requiresArtifacts: { type: Boolean, default: false },
  view: { type: String, default: "definition" },
  selectedRow: { type: Object, default: null },
  rules: { type: Array, default: () => [] },
  triggers: { type: Array, default: () => [] },
  artifacts: { type: Array, default: () => [] },
  ruleTableFields: { type: Array, default: () => [] },
  triggerTableFields: { type: Array, default: () => [] },
  artifactTableFields: { type: Array, default: () => [] },
  primaryAction: { type: [String, Object], default: "" },
  primaryActionLabel: { type: String, default: "" },
  allRequirementsMet: { type: Boolean, default: false },
  formatCell: { type: Function, required: true },
  formatDefinitionRuleSummary: { type: Function, required: true }
});
defineEmits(["update:view", "cancel", "primary-action", "confirm"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
