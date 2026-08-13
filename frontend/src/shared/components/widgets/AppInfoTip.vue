<template>
  <!-- Ícono de información con tooltip: descarga de la UI los textos de ayuda que de otro modo generan ruido.
       Se revela al pasar el cursor, al enfocar con teclado o al hacer clic (persistente para táctil/lectura). -->
  <span
    class="relative inline-flex"
    @mouseenter="open = true"
    @mouseleave="open = false"
  >
    <button
      type="button"
      class="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition-colors hover:text-icon focus:text-icon focus:outline-none"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click.stop="open = !open"
      @focus="open = true"
      @blur="open = false"
      @keydown.escape="open = false"
    >
      <IconInfoCircle class="h-4 w-4" stroke-width="2" />
    </button>
    <span
      v-show="open"
      role="tooltip"
      class="absolute z-[1100] w-64 max-w-xs rounded-2xl bg-strong px-3 py-2 text-xs font-medium leading-snug text-white shadow-lg"
      :class="placementClass"
    >
      <slot>{{ text }}</slot>
    </span>
  </span>
</template>

<script setup>
import { ref, computed } from "vue";
import { IconInfoCircle } from "@tabler/icons-vue";

const props = defineProps({
  // Texto del tooltip (alternativa al slot por defecto para contenido enriquecido).
  text: {
    type: String,
    default: ""
  },
  ariaLabel: {
    type: String,
    default: "Más información"
  },
  // Posición de la burbuja respecto al ícono: top | bottom | left | right.
  placement: {
    type: String,
    default: "top"
  }
});

const open = ref(false);

const PLACEMENT_CLASSES = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2"
};
const placementClass = computed(() => PLACEMENT_CLASSES[props.placement] || PLACEMENT_CLASSES.top);
</script>
