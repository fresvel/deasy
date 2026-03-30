<template>
  <select
    :value="modelValue"
    class="form-select"
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
