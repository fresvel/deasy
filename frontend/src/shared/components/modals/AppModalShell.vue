<template>
  <div
    ref="rootElement"
    class="deasy-dialog-root fixed inset-0 overflow-y-auto px-4 py-8 z-(--z-modal)"
    :class="controlled ? (open ? 'flex' : 'hidden') : 'hidden'"
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
            <h5 class="deasy-title deasy-title--panel" :id="labelledBy">
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
import { computed, nextTick, ref, useAttrs, watch } from "vue";
import { elevarSobreLoVisible, liberarAltura } from "@/shared/utils/modalController";

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

/* LA ALTURA — sólo para los modales que gobierna Vue (`controlled`, con `:open`). Los demás pasan
   por `Modal.show()`, que llama al mismo ayudante: una sola regla para las dos mitades.

   Esta mitad era la unica que NO elevaba, y por eso era la unica que se podia romper: el asistente
   de procesos se abria por debajo del editor que lo habia lanzado y parecia que el boton no hacia
   nada. Se intento arreglar declarando un nivel fijo por componente y **no cabe**: ese mismo
   asistente se abre desde siete sitios a dos profundidades distintas.

   El `nextTick` no es adorno: al abrir hay que medir con las clases YA aplicadas, o el modal que
   acaba de cerrarse en el mismo ciclo todavia cuenta como visible y el nuevo sale un escalon de
   mas. Y liberar al cerrar es la otra mitad del mecanismo — sin ello cada apertura deja un peldaño
   que no vuelve a bajar. */
watch(
  () => props.open,
  async (abierto) => {
    if (!props.controlled) return;
    if (!abierto) {
      liberarAltura(rootElement.value);
      return;
    }
    await nextTick();
    elevarSobreLoVisible(rootElement.value);
  }
);


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
