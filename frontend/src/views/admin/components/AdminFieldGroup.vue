<template>
  <div :class="groupClass">
    <label v-if="label" class="form-label" :class="labelClass">
      {{ label }}
      <span v-if="required" class="text-danger">*</span>
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
