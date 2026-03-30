<template>
  <div
    v-if="visible"
    class="admin-feedback-toast"
    :class="`is-${kind}`"
    role="status"
    aria-live="polite"
  >
    <div class="admin-feedback-toast-body">
      <div class="admin-feedback-toast-copy">
        <strong class="admin-feedback-toast-title">{{ title }}</strong>
        <div class="admin-feedback-toast-message">{{ message }}</div>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-icon admin-feedback-toast-close"
        title="Cerrar"
        aria-label="Cerrar"
        @click="$emit('close')"
      >
        <font-awesome-icon icon="times" />
      </button>
    </div>
  </div>
</template>

<script setup>
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
