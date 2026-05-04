<template>
  <component :is="rootTag" v-bind="rootAttrs" :class="rootClasses">
    <img
      src="/brand/deasy-logo.svg"
      alt="DEASY"
      :class="imageClasses"
      decoding="async"
      draggable="false"
    />
  </component>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
  to: {
    type: [String, Object],
    default: ""
  },
  size: {
    type: String,
    default: "md"
  },
  className: {
    type: [String, Array, Object],
    default: ""
  },
  imageClass: {
    type: [String, Array, Object],
    default: ""
  },
  ariaLabel: {
    type: String,
    default: "DEASY"
  }
});

const sizeClasses = {
  sm: "h-8 max-w-[8.5rem]",
  md: "h-10 max-w-[11rem]",
  lg: "h-12 max-w-[14rem]",
  xl: "h-16 max-w-[18rem]"
};

const rootTag = computed(() => (props.to ? RouterLink : "div"));

const rootAttrs = computed(() => {
  if (!props.to) {
    return { role: "img", "aria-label": props.ariaLabel };
  }

  return { to: props.to, "aria-label": props.ariaLabel };
});

const rootClasses = computed(() => [
  "inline-flex min-w-0 items-center",
  props.to ? "transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-lg" : "",
  props.className
]);

const imageClasses = computed(() => [
  "block w-auto object-contain select-none",
  sizeClasses[props.size] || sizeClasses.md,
  props.imageClass
]);
</script>
