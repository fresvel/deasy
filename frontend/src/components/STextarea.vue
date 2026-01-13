<template>
  <div class="col" :class="bootstrapColumnClass">
    <div class="mb-3">
      <label :for="textareaId" class="form-label">{{ label }}</label>
      <textarea
        :id="textareaId"
        :placeholder="placeholder"
        :value="input"
        @input="updateValue"
        class="form-control"
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

const bootstrapColumnClass = computed(() => {
  const wideMap = {
    one: "col-1",
    two: "col-2",
    three: "col-3",
    four: "col-4",
    five: "col-5",
    six: "col-6",
    seven: "col-7",
    eight: "col-8",
    nine: "col-9",
    ten: "col-10",
    eleven: "col-11",
    twelve: "col-12",
    thirteen: "col-12",
    fourteen: "col-12",
    fifteen: "col-12",
    sixteen: "col-12"
  };
  return props.wide ? wideMap[props.wide] || "col" : "col";
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
