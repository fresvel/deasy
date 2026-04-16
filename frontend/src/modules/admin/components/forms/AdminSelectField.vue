<template>
  <select
    :value="modelValue"
    class="admin-select-field w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-700 shadow-sm transition-colors duration-150 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    :class="selectClass"
    :disabled="disabled"
    @change="handleChange"
    @focus="$emit('focus', $event)"
    @blur="$emit('blur', $event)"
  >
    <slot />
  </select>
</template>

<script setup>
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

const handleChange = (event) => {
  emit("update:modelValue", event.target.value);
  emit("change", event);
};
</script>
