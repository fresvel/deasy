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
    <div class="deasy-card mb-4 flex items-stretch gap-1 overflow-x-auto p-2">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        type="button"
        class="deasy-stepper__step group"
        :class="{
          'deasy-stepper__step--active': step.key === currentStep,
          'deasy-stepper__step--complete': isStepComplete(step)
        }"
        :disabled="isStepLocked(step, index)"
        @click="$emit('go-to-step', step.key)"
      >
        <span
          class="deasy-icon-box deasy-icon-box--sm deasy-icon-box--round"
          :class="clasesPaso(step)"
        >
          <font-awesome-icon v-if="isStepComplete(step)" icon="check" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="flex flex-col">
          <span class="text-sm font-bold leading-tight">{{ step.label }}</span>
          <span class="deasy-stepper__hint">
            {{ stepHint(step, index) }}
          </span>
        </span>
      </button>
    </div>

    <AppAlert v-if="wizardError">
      {{ wizardError }}
    </AppAlert>

    <AppAlert variant="success" class="mb-3 flex flex-wrap items-center gap-2" v-if="definitionContext?.id && showContextSummary">
      <strong>{{ definitionContext.name || `Configuración #${definitionContext.id}` }}</strong>
      <span class="inline-flex items-center rounded-xl bg-white/70 px-2 py-0.5 text-xs font-semibold text-icon ring-1 ring-line">
        {{ definitionContext.definition_version || "—" }}
      </span>
      <AppTag :variant="tonoEstadoDefinicion">
        {{ definitionStatusLabel }}
      </AppTag>
    </AppAlert>

    <slot />

    <template #footer>
      <slot name="footer" />
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed, ref } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoCicloVida, etiquetaCicloVida } from "@/shared/utils/estadoTono.js";
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

/* `DEFINITION_STATUS_META` murio el 2026-08-15 (F3.3 · L5). Era un mapa de tres ramas que
   devolvia cadenas de Tailwind —color viviendo en JavaScript, invisible a todo gate de CSS— y
   estaba DUPLICADO byte a byte en `AdminMainTableSection`. Las dos copias son ahora el mismo
   diccionario, `estadoTono.js`, con el mismo esquema que el resto del repo. */
const estadoDefinicion = computed(() => String(props.definitionContext?.status || "draft").toLowerCase());
const tonoEstadoDefinicion = computed(() => tonoCicloVida(estadoDefinicion.value));
const definitionStatusLabel = computed(() => etiquetaCicloVida(estadoDefinicion.value));

// El paso "Activar" refleja el estado real de la configuración: una configuración ya activa
// (o retirada) no está "pendiente" de activación, sino completada/cerrada.
const isStepComplete = (step) => {
  if (step.key === "activate") {
    return estadoDefinicion.value === "active" || estadoDefinicion.value === "retired";
  }
  return Boolean(props.stepStatus?.[step.key]);
};
const isStepLocked = (step, index) =>
  Boolean(step.locked || step.disabled || (props.lockAfterFirstUntilContext && index > 0 && !hasDefinition.value));

/* `stepButtonClass` se retiro el 2026-08-15 (G1): devolvia clases de Tailwind en una cadena, o
   sea colores viviendo en JavaScript — invisibles para todos los gates de CSS. Las tres ramas que
   tenia las cubre ahora `deasy-stepper__step`: el activo con `--active`, el bloqueado con el
   `:disabled` que el propio boton ya declara, y el resto con su `:hover`. */
/* `stepBadgeClass` y `stepHintClass` murieron el 2026-08-15 (F3.3 · L5), como su hermano
   `stepButtonClass` en G1: devolvian cadenas de Tailwind. Quedan reducidos a lo unico que era
   suyo —decidir en que estado esta el paso— y el color lo pone el CSS:
     · el NUMERO pide un tono de `deasy-icon-box`, que ya tiene los seis (F3.1);
     · la PISTA se pinta por descendencia de `--complete` / `--active`, sin funcion ninguna.
   Las dos ultimas ramas de `stepBadgeClass` devolvian lo MISMO, asi que `isStepLocked` no
   pintaba nada distinto: el bloqueado ya se ve por el `:disabled` que el boton declara. */
const tonoPaso = (step) => {
  if (isStepComplete(step)) return "success";
  if (step.key === props.currentStep) return "primary";
  return "neutral";
};

/* EL NUMERO VA SOLIDO — decision del dueño el 2026-08-15, revirtiendo el aspecto que L5 le habia
   dado sin querer. L5 movio el color de JavaScript al CSS, que era el objetivo, pero de paso
   convirtio el numero en suave como el resto de pastillas, y en un stepper el numero **es** el
   acento de la pantalla: es lo que dice de un vistazo por donde vas.
   Lo que NO se revierte es la arquitectura: aqui sigue saliendo un NOMBRE DE TONO, no un color.
   `neutral` se queda suave a proposito — es el unico que no admite `--solid` (blanco sobre gris
   claro no se lee), y ademas es lo correcto: el paso pendiente no debe competir con el actual. */
const clasesPaso = (step) => {
  const tono = tonoPaso(step);
  return tono === "neutral"
    ? "deasy-icon-box--neutral"
    : `deasy-icon-box--${tono} deasy-icon-box--solid`;
};
const stepHint = (step, index) => {
  if (step.hint) return step.hint;
  if (step.key === "activate") {
    if (["active", "retired"].includes(estadoDefinicion.value)) return etiquetaCicloVida(estadoDefinicion.value);
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
