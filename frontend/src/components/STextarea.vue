<template>
  <div class="deasy-field-wrapper" :class="columnClass">
    <div>
      <label :for="textareaId" class="deasy-field-label">{{ label }}</label>
      <textarea
        :id="textareaId"
        :placeholder="placeholder"
        :value="input"
        @input="updateValue"
        class="deasy-field-textarea"
        :rows="rows"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, computed } from "vue";

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    required: true
  },
  modelValue: {
    type: String,
    default: ""
  },
  rows: {
    type: [Number, String],
    default: 3
  },
  wide: {
    type: String
  }
});

const emit = defineEmits(["update:modelValue"]);

const columnClass = computed(() => {
  const wideMap = {
    one: "deasy-col-1",
    two: "deasy-col-2",
    three: "deasy-col-3",
    four: "deasy-col-4",
    five: "deasy-col-5",
    six: "deasy-col-6",
    seven: "deasy-col-7",
    eight: "deasy-col-8",
    nine: "deasy-col-9",
    ten: "deasy-col-10",
    eleven: "deasy-col-11",
    twelve: "deasy-col-12",
    thirteen: "deasy-col-12",
    fourteen: "deasy-col-12",
    fifteen: "deasy-col-12",
    sixteen: "deasy-col-12"
  };
  return props.wide ? wideMap[props.wide] || "deasy-col-12" : "deasy-col-12";
});

const textareaId = computed(() => `textarea-${Math.random().toString(36).substr(2, 9)}`);

const input = ref(props.modelValue);

watch(() => props.modelValue, (newVal) => {
  input.value = newVal;
});

const updateValue = (event) => {
  emit("update:modelValue", event.target.value);
};
</script>

<style scoped>
/* Agrega tus estilos aquí */
</style>
