<template>
  <!-- Modal ligero controlado por estado (v-if) para formularios anidados dentro de otro modal (p. ej. alta/
       edición de alcance o periodo). Usa el mismo skin visual (deasy-dialog-*) que AppModalShell, pero sin el
       controlador de Bootstrap: se muestra/oculta con la prop `open`. z por debajo del picker FK (1090). -->
  <div
    v-if="open"
    class="deasy-dialog-root fixed inset-0 z-[1075] flex items-start justify-center overflow-y-auto px-4 py-8"
    role="dialog"
    aria-modal="true"
    @click.self="$emit('close')"
  >
    <div class="deasy-dialog-panel relative w-full overflow-hidden" :class="panelClass">
      <div class="deasy-dialog-header flex items-center justify-between gap-4">
        <h5 class="deasy-dialog-title">{{ title }}</h5>
        <button
          type="button"
          class="deasy-btn--close flex h-9 w-9 items-center justify-center transition-colors"
          aria-label="Cerrar"
          title="Cerrar"
          @click="$emit('close')"
        >
          <IconX class="h-4 w-4" stroke-width="2.5" />
        </button>
      </div>
      <div class="deasy-dialog-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="deasy-dialog-footer flex flex-wrap items-center justify-end gap-3">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { IconX } from "@tabler/icons-vue";

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  panelClass: { type: [String, Array, Object], default: "max-w-3xl" }
});
defineEmits(["close"]);
</script>
