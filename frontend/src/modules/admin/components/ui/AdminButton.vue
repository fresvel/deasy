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
  primary: "admin-btn--primary deasy-btn--primary",
  secondary: "admin-btn--secondary deasy-btn--secondary",
  cancel: "admin-btn--cancel deasy-btn--cancel",
  outlinePrimary: "admin-btn--outline-primary deasy-btn--outline-primary",
  outlineDanger: "admin-btn--outline-danger deasy-btn--outline-danger",
  success: "admin-btn--success border-emerald-600 bg-emerald-600 text-white hover:bg-success hover:border-success",
  danger: "admin-btn--danger border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700",
  close: "admin-btn--close deasy-btn--close",
  menu: "person-assignment-menu-btn",
  plain: ""
};

const sizeClassMap = {
  sm: "admin-btn--sm px-3 py-2 text-sm",
  lg: "admin-btn--lg px-5 py-3 text-base"
};

const classes = computed(() => [
  ["close", "plain"].includes(props.variant)
    ? ""
    : "admin-btn deasy-btn",
  variantClassMap[props.variant] || props.variant,
  props.size ? sizeClassMap[props.size] || props.size : "",
  props.iconOnly ? "admin-btn--icon deasy-btn deasy-btn--icon" : "",
  props.className
]);

const showInnerWrapper = computed(() => props.iconOnly || props.variant === "close");
</script>
