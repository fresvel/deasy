<template>
  <!-- [F4.C 2026-08-16] DOS DELTAS ADOPTADOS de su receta de notifications:
       · radio 16 -> 12 (`rounded-2xl` -> `rounded-xl`). Era el ultimo panel del sistema en 16 px;
         el dropzone y la tabla ya habian bajado a 12.
       · `bg-white/95 backdrop-blur` -> BLANCO SOLIDO. El alfa hacia que el color del aviso
         dependiera de lo que hubiera debajo —el mismo toast en dos grises segun la pantalla—, que
         es el anti-patron que este repo evita en todo lo demas. Su receta lo pinta opaco. Con el
         se va el desenfoque, que solo estaba ahi para disimular ese problema. -->
  <div
    v-if="visible"
    class="fixed right-6 top-6 z-1080 w-full max-w-md rounded-xl border bg-white p-4 shadow-theme-lg"
    :class="`is-${kind}`"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <strong class="block text-sm font-bold text-navy">{{ title }}</strong>
        <div class="mt-1 text-sm text-icon">{{ message }}</div>
      </div>
      <AppCloseButton @click="$emit('close')" />
    </div>
  </div>
</template>

<script setup>
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";

defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  kind: {
    type: String,
    default: "success"
  },
  title: {
    type: String,
    default: ""
  },
  message: {
    type: String,
    default: ""
  }
});

defineEmits(["close"]);
</script>
