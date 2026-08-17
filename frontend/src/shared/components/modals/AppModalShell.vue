<template>
  <div
    ref="rootElement"
    class="deasy-dialog-root fixed inset-0 overflow-y-auto px-4 py-8"
    :class="[controlled ? (open ? 'flex' : 'hidden') : 'hidden', claseAltura]"
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
  /* NIVEL — a que profundidad de la cadena de modales esta este.
       1  se abre desde la pagina        4  desde uno de tercer nivel
       2  se abre DESDE otro modal       5  el limite; mas hondo es un problema de diseño
       3  desde uno de segundo nivel
     La cadena mas profunda medida en el repo es de TRES (editor de registro -> navegador de clave
     ajena -> crear/filtrar), pero se escribia con CINCO alturas distintas (1060, 1075, 1080, 1090,
     1100) porque nadie sabia cual le tocaba: la confirmacion del asistente valia 1075 y el
     asistente 1080, o sea que **el hijo salia por debajo del padre**.
     ⚠️ Esto es solo el suelo. `modalController.js` sube ademas +1 en linea al mostrar, asi que dos
     modales del mismo nivel no empatan: gana el ultimo en abrirse, que es lo que quieres. */
  nivel: {
    type: [Number, String],
    default: 1,
    validator: (v) => [1, 2, 3, 4, 5].includes(Number(v))
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

/* Las cinco alturas, escritas ENTERAS a proposito: Tailwind rastrea el codigo como TEXTO, y una
   clase compuesta (`z-(--z-modal-${n})`) no la encuentra, asi que la utilidad no se generaria.
   Es el mismo motivo por el que `AppButton` lleva su mapa de variantes literal. */
const CLASE_POR_NIVEL = {
  1: "z-(--z-modal)",
  2: "z-(--z-modal-2)",
  3: "z-(--z-modal-3)",
  4: "z-(--z-modal-4)",
  5: "z-(--z-modal-5)"
};
const claseAltura = computed(() => CLASE_POR_NIVEL[Number(props.nivel)] || CLASE_POR_NIVEL[1]);

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
