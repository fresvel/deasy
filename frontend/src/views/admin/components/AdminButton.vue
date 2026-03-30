<template>
  <button
    :type="type"
    :class="classes"
    :title="title || ariaLabel"
    :aria-label="ariaLabel || title"
    :disabled="disabled"
    v-bind="attrs"
    @click="$emit('click', $event)"
  >
    <span v-if="$slots.default && showInnerWrapper" class="btn-inner">
      <slot />
    </span>
    <slot v-else />
  </button>
</template>

<script setup>
import { computed, useAttrs } from "vue";

const props = defineProps({
  type: {
    type: String,
    default: "button"
  },
  variant: {
    type: String,
    default: "secondary"
  },
  size: {
    type: String,
    default: ""
  },
  iconOnly: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ""
  },
  ariaLabel: {
    type: String,
    default: ""
  },
  className: {
    type: [String, Array, Object],
    default: ""
  }
});

defineEmits(["click"]);
const attrs = useAttrs();

const variantClassMap = {
  primary: "btn-primary",
  secondary: "btn-outline-secondary",
  cancel: "btn-outline-danger",
  outlinePrimary: "btn-outline-primary",
  outlineDanger: "btn-outline-danger",
  success: "btn-success",
  danger: "btn-danger",
  close: "btn-close",
  menu: "person-assignment-menu-btn",
  plain: ""
};

const sizeClassMap = {
  sm: "btn-sm",
  lg: "btn-lg"
};

const classes = computed(() => [
  ["close", "plain"].includes(props.variant) ? "" : "btn",
  variantClassMap[props.variant] || props.variant,
  props.size ? sizeClassMap[props.size] || props.size : "",
  props.iconOnly ? "btn-icon" : "",
  props.className
]);

const showInnerWrapper = computed(() => props.iconOnly || props.variant === "close");
</script>
