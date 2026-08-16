<template>
  <div
    v-if="visible"
    class="fixed right-6 top-6 z-1080 w-full max-w-md rounded-2xl border bg-white/95 p-4 shadow-theme-lg backdrop-blur"
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
