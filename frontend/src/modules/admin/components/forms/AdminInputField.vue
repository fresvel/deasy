<template>
  <component
    :is="tagName"
    :value="modelValue"
    :type="tagName === 'input' ? type : undefined"
    class="admin-input-field w-full rounded-2xl border border-slate-300 bg-white px-3.5 text-sm text-slate-700 shadow-none transition-colors duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    :class="[sizeClass, inputClass]"
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
// Altura uniforme (h-10 = 40px) para que inputs, selects y lookups queden alineados en los grids;
// los textarea conservan padding vertical en vez de altura fija.
const sizeClass = computed(() => (tagName.value === "textarea" ? "py-2.5" : "h-10 py-2"));

const handleInput = (event) => {
  emit("update:modelValue", event.target.value);
  emit("input", event);
};
</script>
