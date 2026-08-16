<template>
  <div
    ref="rootElement"
    class="deasy-dialog-root fixed inset-0 overflow-y-auto px-4 py-8"
    :class="[controlled ? (open ? 'flex' : 'hidden') : 'hidden', nested ? 'z-[1075]' : 'z-1060']"
    data-dialog-root
    tabindex="-1"
    role="dialog"
    :aria-labelledby="labelledBy || undefined"
    :aria-hidden="controlled ? (!open).toString() : 'true'"
    aria-modal="true"
    v-bind="attrs"
    @click.self="handleBackdropClick"
  >
    <div class="deasy-dialog-shell mx-auto flex min-h-full w-full justify-center" :class="shellClass">
      <div class="deasy-dialog-panel relative w-full overflow-hidden" :class="contentClass">
        <div
          v-if="showHeader"
          class="deasy-dialog-header flex items-center justify-between gap-4"
        >
          <slot name="header">
            <h5 class="deasy-dialog-title" :id="labelledBy">
              <slot name="title">{{ title }}</slot>
            </h5>
          </slot>
          <AppCloseButton
            v-if="showCloseButton"
            :label="closeLabel"
            v-bind="closeButtonAttrs"
            @click="handleClose"
          />
        </div>
        <div class="deasy-dialog-body" :class="bodyClass">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="deasy-dialog-footer flex flex-wrap items-center justify-end gap-3"
          :class="footerClass"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
import { computed, ref, useAttrs } from "vue";

const props = defineProps({
  title: {
    type: String,
    default: ""
  },
  /* Deja de ser obligatorio al absorber `AppDialogOverlay` (2026-08-15): aquel no lo pedia y sus
     nueve consumidores no lo pasan. Sin el, no se emite el atributo en vez de emitirlo vacio. */
  labelledBy: {
    type: String,
    default: ""
  },
  /* ANIDADO — un modal que se abre DESDE otro modal, como el alta de alcance o de periodo dentro
     del asistente. Sube una capa (1075) para quedar por encima del que lo abrio, y por debajo del
     selector de clave ajena (1090). Era la unica razon de ser de `AppDialogOverlay`, junto con su
     mecanica de `v-if`, que ahora la pone el consumidor. */
  nested: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: "md"
  },
  dialogClass: {
    type: [String, Array, Object],
    default: ""
  },
  contentClass: {
    type: [String, Array, Object],
    default: ""
  },
  bodyClass: {
    type: [String, Array, Object],
    default: ""
  },
  footerClass: {
    type: [String, Array, Object],
    default: ""
  },
  closeLabel: {
    type: String,
    default: "Close"
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  closeAction: {
    type: Boolean,
    default: false
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true
  },
  controlled: {
    type: Boolean,
    default: false
  },
  open: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close"]);

const attrs = useAttrs();
const rootElement = ref(null);

const shellClass = computed(() => {
  const classes = ["items-center"];
  if (props.size === "md") classes.push("max-w-3xl");
  if (props.size === "lg") classes.push("max-w-5xl");
  if (props.size === "xl") classes.push("max-w-7xl");
  if (props.size === "scrollable") classes.push("max-w-5xl");
  if (props.size === "centered") classes.push("max-w-3xl");
  if (Array.isArray(props.dialogClass)) {
    classes.push(...props.dialogClass);
  } else if (props.dialogClass) {
    classes.push(props.dialogClass);
  }
  return classes;
});

const closeButtonAttrs = computed(() => {
  if (props.controlled || props.closeAction) {
    return {};
  }
  return { "data-modal-dismiss": true };
});

const handleClose = (event) => {
  if (props.controlled || props.closeAction) {
    emit("close", event);
  }
};

const handleBackdropClick = (event) => {
  if (props.controlled && props.closeOnBackdrop) {
    emit("close", event);
  }
};

defineExpose({
  get el() {
    return rootElement.value;
  }
});
</script>
