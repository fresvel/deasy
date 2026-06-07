<template>
  <component :is="rootTag" v-bind="rootAttrs" :class="rootClasses">
    <img
      src="/brand/deasy-logo.png"
      alt="Logo de DEASY"
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
  },
  framed: {
    type: Boolean,
    default: false
  }
});

const sizeClasses = {
  sm: "h-8 max-w-8",
  md: "h-12 max-w-12",
  lg: "h-20 max-w-20",
  xl: "h-24 max-w-24"
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
  props.framed ? "rounded-[14px] border border-[rgba(15,53,118,0.08)] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(11,31,63,0.06)]" : "",
  props.to ? "transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[rgba(18,63,136,0.18)] rounded-lg" : "",
  props.className
]);

const imageClasses = computed(() => [
  "block w-auto object-contain select-none",
  sizeClasses[props.size] || sizeClasses.md,
  props.imageClass
]);
</script>
