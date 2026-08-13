<template>
  <div :class="rootClass">
    <label
      :for="toggleId"
      class="items-center gap-3"
      :class="labelPosition === 'end' ? 'inline-flex flex-row-reverse' : 'flex justify-between'"
    >
      <span v-if="$slots.default || label || description" class="min-w-0">
        <slot>
          <span class="block text-sm font-semibold text-slate-700 select-none">{{ label }}</span>
          <span v-if="description" class="mt-0.5 block text-xs font-medium text-slate-500">{{ description }}</span>
        </slot>
      </span>

      <span class="relative inline-block w-11 h-6 shrink-0" :class="{ 'cursor-pointer': !disabled }">
        <input
          :id="toggleId"
          type="checkbox"
          class="peer sr-only"
          :checked="modelValue"
          :disabled="disabled"
          @change="onChange"
        />
        <span
          class="absolute inset-0 rounded-full bg-slate-300 transition-colors duration-200 ease-in-out peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 peer-disabled:opacity-50 peer-disabled:pointer-events-none"
        ></span>
        <span
          class="absolute top-1/2 left-0.5 -translate-y-1/2 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out peer-checked:translate-x-full"
        ></span>
      </span>
    </label>
  </div>
</template>

<script setup>
import { computed, useId } from "vue";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    default: ""
  },
  disabled: {
    type: Boolean,
    default: false
  },
  // 'start' -> label a la izquierda, switch a la derecha (fila, ancho completo).
  // 'end'   -> switch a la izquierda, label a la derecha (inline/compacto).
  labelPosition: {
    type: String,
    default: "start",
    validator: (value) => ["start", "end"].includes(value)
  },
  // Integración con el grid de formularios (deasy-col-N), como SInput/SSelect.
  wide: {
    type: String
  },
  id: {
    type: String
  }
});

const emit = defineEmits(["update:modelValue", "change"]);

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
    twelve: "deasy-col-12"
  };
  return props.wide ? wideMap[props.wide] || "deasy-col-12" : "";
});

const rootClass = computed(() => {
  if (props.wide) return ["deasy-field-wrapper", columnClass.value];
  return props.labelPosition === "end" ? "inline-block" : "w-full";
});

// La prop `id` manda; el id por instancia de useId() es solo el respaldo estable.
const toggleId = computed(() => props.id || fieldId("toggle"));

function onChange(event) {
  const value = event.target.checked;
  emit("update:modelValue", value);
  emit("change", value);
}
</script>
