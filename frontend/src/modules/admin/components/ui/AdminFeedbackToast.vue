<template>
  <div
    v-if="visible"
    class="admin-feedback-toast fixed right-6 top-6 z-1080 w-full max-w-md rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur"
    :class="`is-${kind}`"
    role="status"
    aria-live="polite"
  >
    <div class="admin-feedback-toast-body flex items-start gap-3">
      <div class="admin-feedback-toast-copy min-w-0 flex-1">
        <strong class="admin-feedback-toast-title block text-sm font-bold text-slate-900">{{ title }}</strong>
        <div class="admin-feedback-toast-message mt-1 text-sm text-slate-600">{{ message }}</div>
      </div>
      <AdminButton variant="close" size="sm" icon-only title="Cerrar" aria-label="Cerrar" @click="$emit('close')">
        <IconX />
      </AdminButton>
    </div>
  </div>
</template>

<script setup>
import { IconX } from '@tabler/icons-vue';

import AdminButton from "@/shared/components/buttons/AppButton.vue";

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
