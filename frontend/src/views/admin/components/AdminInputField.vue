<template>
  <component
    :is="tagName"
    :value="modelValue"
    :type="tagName === 'input' ? type : undefined"
    class="admin-input-field w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm transition-colors duration-150 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    :class="inputClass"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :rows="tagName === 'textarea' ? rows : undefined"
    :min="min"
    :max="max"
    :step="step"
    @input="handleInput"
    @change="$emit('change', $event)"
    @focus="$emit('focus', $event)"
    @blur="$emit('blur', $event)"
  />
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ""
  },
  type: {
    type: String,
    default: "text"
  },
  as: {
    type: String,
    default: "input"
  },
  placeholder: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  rows: {
    type: [Number, String],
    default: 3
  },
  min: {
    type: [Number, String],
    default: undefined
  },
  max: {
    type: [Number, String],
    default: undefined
  },
  step: {
    type: [Number, String],
    default: undefined
  },
  inputClass: {
    type: [String, Array, Object],
    default: ""
  }
});

const emit = defineEmits(["update:modelValue", "input", "change", "focus", "blur"]);

const tagName = computed(() => (props.as === "textarea" ? "textarea" : "input"));

const handleInput = (event) => {
  emit("update:modelValue", event.target.value);
  emit("input", event);
};
</script>
