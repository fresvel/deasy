<template>
  <div class="col" :class="bootstrapColumnClass">
    <div class="mb-3">
      <label :for="selectId" class="form-label">{{ label }}</label>
      <select
        :id="selectId"
        class="form-select"
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