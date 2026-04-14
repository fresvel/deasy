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
  primary: "admin-btn--primary border-sky-700 bg-sky-700 text-white hover:bg-sky-800 hover:border-sky-800",
  secondary: "admin-btn--secondary border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400",
  cancel: "admin-btn--cancel border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-300",
  outlinePrimary: "admin-btn--outline-primary border-sky-700 bg-white text-sky-700 hover:bg-sky-50",
  outlineDanger: "admin-btn--outline-danger border-red-600 bg-white text-red-600 hover:bg-red-50",
  success: "admin-btn--success border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700",
  danger: "admin-btn--danger border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700",
  close: "admin-btn--close h-9 w-9 rounded-full border border-slate-200 bg-white p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700",
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
    : "admin-btn inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
  variantClassMap[props.variant] || props.variant,
  props.size ? sizeClassMap[props.size] || props.size : "",
  props.iconOnly ? "admin-btn--icon h-9 w-9 p-0" : "",
  props.className
]);

const showInnerWrapper = computed(() => props.iconOnly || props.variant === "close");
</script>
