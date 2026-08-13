<template>
  <AppModalShell
    ref="modalRef"
    :controlled="controlled"
    :open="open"
    :labelled-by="labelledBy"
    :title="title"
    size="xl"
    :dialog-class="dialogClass"
    :content-class="contentClass"
    :body-class="bodyClass"
    :footer-class="footerClass"
    close-action
    @close="$emit('close')"
  >
    <div class="mb-4 flex items-stretch gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-2">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        type="button"
        class="group flex flex-1 min-w-[7.5rem] items-center gap-2 rounded-xl px-3 py-2 text-left transition"
        :class="stepButtonClass(step, index)"
        :disabled="isStepLocked(step, index)"
        @click="$emit('go-to-step', step.key)"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          :class="stepBadgeClass(step, index)"
        >
          <font-awesome-icon v-if="isStepComplete(step)" icon="check" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="flex flex-col">
          <span class="text-sm font-bold leading-tight">{{ step.label }}</span>
          <span class="text-[0.65rem] font-semibold uppercase tracking-wide" :class="stepHintClass(step, index)">
            {{ stepHint(step, index) }}
          </span>
        </span>
      </button>
    </div>

    <AppAlert v-if="wizardError">
      {{ wizardError }}
    </AppAlert>

    <div
      v-if="definitionContext?.id && showContextSummary"
      class="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-800"
    >
      <strong>{{ definitionContext.name || `Configuración #${definitionContext.id}` }}</strong>
      <span class="inline-flex items-center rounded-xl bg-white/70 px-2 py-0.5 text-xs font-semibold text-icon ring-1 ring-line">
        {{ definitionContext.definition_version || "—" }}
      </span>
      <span class="inline-flex items-center rounded-xl px-2 py-0.5 text-xs font-bold" :class="definitionStatusBadgeClass">
        {{ definitionStatusLabel }}
      </span>
    </div>

    <slot />

    <template #footer>
      <slot name="footer" />
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed, ref } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

const props = defineProps({
  controlled: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  labelledBy: { type: String, required: true },
  title: { type: String, default: "" },
  steps: { type: Array, default: () => [] },
  currentStep: { type: String, default: "" },
  stepStatus: { type: Object, default: () => ({}) },
  definitionContext: { type: Object, default: null },
  wizardError: { type: String, default: "" },
  lockAfterFirstUntilContext: { type: Boolean, default: false },
  showContextSummary: { type: Boolean, default: false },
  dialogClass: { type: [String, Array, Object], default: "max-w-6xl" },
  contentClass: { type: [String, Array, Object], default: "flex max-h-[calc(100vh-4rem)] flex-col" },
  bodyClass: { type: [String, Array, Object], default: "min-h-0 overflow-y-auto" },
  footerClass: { type: [String, Array, Object], default: "shrink-0" }
});

defineEmits(["close", "go-to-step"]);

const modalRef = ref(null);
const hasDefinition = computed(() => Boolean(props.definitionContext?.id));

const DEFINITION_STATUS_META = {
  draft: { label: "Borrador", class: "bg-gray-200 text-body" },
  active: { label: "Activa", class: "bg-emerald-500 text-white" },
  retired: { label: "Retirada", class: "bg-amber-200 text-amber-800" }
};
const definitionStatusMeta = computed(() =>
  DEFINITION_STATUS_META[String(props.definitionContext?.status || "draft").toLowerCase()]
  || { label: props.definitionContext?.status || "—", class: "bg-gray-200 text-body" }
);
const definitionStatusLabel = computed(() => definitionStatusMeta.value.label);
const definitionStatusBadgeClass = computed(() => definitionStatusMeta.value.class);

const definitionStatus = computed(() => String(props.definitionContext?.status || "").toLowerCase());

// El paso "Activar" refleja el estado real de la configuración: una configuración ya activa
// (o retirada) no está "pendiente" de activación, sino completada/cerrada.
const isStepComplete = (step) => {
  if (step.key === "activate") {
    return definitionStatus.value === "active" || definitionStatus.value === "retired";
  }
  return Boolean(props.stepStatus?.[step.key]);
};
const isStepLocked = (step, index) =>
  Boolean(step.locked || step.disabled || (props.lockAfterFirstUntilContext && index > 0 && !hasDefinition.value));

const stepButtonClass = (step, index) => {
  if (step.key === props.currentStep) return "bg-white shadow-elev-1 ring-1 ring-brand-300";
  if (isStepLocked(step, index)) return "opacity-50 cursor-not-allowed";
  return "hover:bg-white/70";
};
const stepBadgeClass = (step, index) => {
  if (isStepComplete(step)) return "bg-emerald-500 text-white";
  if (step.key === props.currentStep) return "bg-brand-500 text-white";
  if (isStepLocked(step, index)) return "bg-gray-200 text-muted";
  return "bg-gray-200 text-muted";
};
const stepHintClass = (step, index) => {
  if (isStepComplete(step)) return "text-emerald-600";
  if (step.key === props.currentStep) return "text-primary";
  if (isStepLocked(step, index)) return "text-muted";
  return "text-muted";
};
const stepHint = (step, index) => {
  if (step.hint) return step.hint;
  if (step.key === "activate") {
    if (definitionStatus.value === "active") return "Activa";
    if (definitionStatus.value === "retired") return "Retirada";
  }
  if (isStepComplete(step)) return "Completo";
  if (isStepLocked(step, index)) return "Bloqueado";
  if (step.key === props.currentStep) return "Pendiente";
  return "Pendiente";
};

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
