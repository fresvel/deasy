<template>
  <AdminProcessWizardShell
    ref="modalRef"
    labelled-by="processDefinitionActivationModalLabel"
    title="Activar configuracion"
    dialog-class="max-w-6xl"
    :steps="activationSteps"
    :current-step="view"
    :step-status="activationStepStatus"
    :definition-context="selectedRow"
    :show-context-summary="true"
    @close="$emit('cancel')"
    @go-to-step="$emit('update:view', $event)"
  >
    <ProcessActivationPanel
      :checking="checking"
      :has-active-rules="hasActiveRules"
      :has-active-triggers="hasActiveTriggers"
      :has-active-artifacts="hasActiveArtifacts"
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
      :show-menu="false"
      @update:view="$emit('update:view', $event)"
      @view-row="$emit('view-row', $event)"
    />

    <!-- Confirmación con tono de advertencia: la activación es irreversible en esta versión. -->
    <AppDialogOverlay
      :open="showConfirm"
      title="Confirmar activación"
      panel-class="max-w-md"
      @close="showConfirm = false"
    >
      <div class="deasy-alert deasy-alert--warning flex items-start gap-3 leading-relaxed">
        <font-awesome-icon icon="triangle-exclamation" class="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <span>
          Al activar, <strong>ya no podrás modificar</strong> reglas, periodos ni paquetes en esta versión.
          Si ya existe una configuración activa en la misma serie, <strong>se retirará automáticamente</strong>.
        </span>
      </div>
      <AdminConfigActivationDiff v-if="showConfirm" :definition-id="selectedRow?.id" class="mt-3" />
      <template #footer>
        <AdminButton variant="cancel" @click="showConfirm = false">Cancelar</AdminButton>
        <AdminButton variant="success" @click="confirmActivate">Sí, activar</AdminButton>
      </template>
    </AppDialogOverlay>

    <template #footer>
      <AdminButton variant="cancel" @click="$emit('cancel')">Cancelar</AdminButton>
      <AdminButton v-if="primaryAction" variant="outlinePrimary" :disabled="checking" @click="$emit('primary-action')">{{ primaryActionLabel }}</AdminButton>
      <AdminButton variant="success" :disabled="checking || !allRequirementsMet" @click="showConfirm = true">Activar</AdminButton>
    </template>
  </AdminProcessWizardShell>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminProcessWizardShell from "@/modules/admin/components/modals/AdminProcessWizardShell.vue";
import ProcessActivationPanel from "@/modules/admin/components/modals/ProcessActivationPanel.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";
import AdminConfigActivationDiff from "@/modules/admin/components/modals/AdminConfigActivationDiff.vue";

const props = defineProps({
  checking: { type: Boolean, default: false },
  hasActiveRules: { type: Boolean, default: false },
  hasActiveTriggers: { type: Boolean, default: false },
  hasActiveArtifacts: { type: Boolean, default: false },
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
const emit = defineEmits(["update:view", "view-row", "cancel", "primary-action", "confirm"]);
const modalRef = ref(null);
const showConfirm = ref(false);
const confirmActivate = () => {
  showConfirm.value = false;
  emit("confirm");
};

const activationSteps = [
  { key: "definition", label: "Configuración" },
  { key: "rules", label: "Alcance" },
  { key: "triggers", label: "Periodos" },
  { key: "artifacts", label: "Paquetes" },
  { key: "activate", label: "Activar", hint: "Final" }
];
const activationStepStatus = computed(() => ({
  definition: Boolean(props.selectedRow?.id),
  rules: props.hasActiveRules,
  triggers: props.hasActiveTriggers,
  artifacts: props.hasActiveArtifacts,
  activate: props.allRequirementsMet
}));

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
