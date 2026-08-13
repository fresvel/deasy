<template>
  <span class="relative block w-full" :class="wrapperClass">
    <select
      v-bind="selectAttrs"
      :value="modelValue"
      class="admin-select-field deasy-control deasy-control--select block h-10 py-2"
      :class="selectClass"
      :disabled="disabled"
      @change="handleChange"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
    >
      <slot />
    </select>
    <span
      class="pointer-events-none absolute inset-y-px right-px flex w-10 items-center justify-center rounded-r-[9px] border-l border-line-field bg-surface text-[#7a869a] transition-colors"
      aria-hidden="true"
    >
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </span>
</template>

<script setup>
import { computed, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  },
  selectClass: {
    type: [String, Array, Object],
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "change", "focus", "blur"]);
const attrs = useAttrs();

const wrapperClass = computed(() => attrs.class);
const selectAttrs = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([key]) => key !== "class"))
);

const handleChange = (event) => {
  emit("update:modelValue", event.target.value);
  emit("change", event);
};
</script>
