<template>
  <div :class="groupClass">
    <label
      v-if="label"
      class="admin-field-label mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700"
      :class="labelClass"
    >
      {{ label }}
      <span v-if="required" class="text-red-600">*</span>
    </label>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: ""
  },
  required: {
    type: Boolean,
    default: false
  },
  groupClass: {
    type: [String, Array, Object],
    default: ""
  },
  labelClass: {
    type: [String, Array, Object],
    default: ""
  }
});
</script>
