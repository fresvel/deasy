<template>
  <div class="deasy-field-wrapper" :class="columnClass">
    <div>
      <label :for="selectId" class="deasy-field-label">{{ label }}</label>
      <select
        :id="selectId"
        class="deasy-field-select"
        :multiple="multiple"
        v-model="model"
      >
        <option v-if="!multiple" value="" disabled>
          {{ placeholder }}
        </option>
        <option
          v-for="(option, index) in normalizedOptions"
          :key="index"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed, ref, watch } from "vue";

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    required: true
  },
  wide: {
    type: String
  },
  modelValue: {
    type: [String, Number, Array],
    default: ""
  },
  multiple: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: "Seleccione una opción"
  }
});

const emit = defineEmits(["update:modelValue", "fromselect"]);

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

const selectId = computed(() => `select-${Math.random().toString(36).substr(2, 9)}`);

const normalizedOptions = computed(() => {
  return props.options.map((option) => {
    if (typeof option === "string") {
      return { value: option, label: option };
    }

    if (option && typeof option === "object") {
      const value =
        option.value ??
        option.code ??
        option.es_name ??
        option.name;

      const label =
        option.name ??
        option.es_name ??
        option.label ??
        value ??
        "";

      return { value, label };
    }

    return { value: "", label: "" };
  });
});

const localState = ref(
  props.multiple
    ? Array.isArray(props.modelValue)
      ? [...props.modelValue]
      : []
    : props.modelValue
);

watch(
  () => props.modelValue,
  (val) => {
    if (props.multiple && Array.isArray(val)) {
      localState.value = [...val];
    } else {
      localState.value = val;
    }
  }
);

const model = computed({
  get() {
    if (props.multiple) {
      return Array.isArray(props.modelValue)
        ? [...props.modelValue]
        : [...localState.value];
    }
    return props.modelValue !== "" ? props.modelValue : localState.value;
  },
  set(value) {
    localState.value = value;
    emit("update:modelValue", value);
    emit("fromselect", value);
  }
});
</script>