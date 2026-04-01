<template>
  <span :class="classes">
    <slot />
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  variant: {
    type: String,
    default: "info"
  },
  className: {
    type: [String, Array, Object],
    default: ""
  }
});

const classes = computed(() => [
  "deasy-tag",
  `deasy-tag--${props.variant}`,
  props.className
]);
</script>
