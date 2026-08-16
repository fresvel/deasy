<template>
  <component
    :is="tagName"
    :value="modelValue"
    :type="tagName === 'input' ? type : undefined"
    class="deasy-control"
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
/* ⚠️ AQUI HABIA UN `h-10 py-2` QUE PISABA LA RECETA, con un comentario que decia «altura uniforme
   para que inputs, selects y lookups queden alineados en los grids». Conseguia lo contrario:
   `AdminSelectField` NO lo llevaba, asi que en el mismo formulario el input media **40 px y el
   select 44**. Medido en el modal de personas el 2026-08-15, con celdas de 68 y 72 px en la misma
   rejilla.

   Y ademas deshacia una decision ya tomada: `deasy-control` es la receta de TailAdmin adoptada el
   2026-08-13, que sube la altura de 40 a 44 «mejor objetivo tactil» — su propio bloque en
   `forms.css` avisa de que **el `h-11` solo gana si la plantilla no escribe `h-10`**. Esta era la
   plantilla que lo escribia.

   El `textarea` si conserva padding en vez de altura fija: una caja de varias lineas no tiene
   altura de control. */
const sizeClass = computed(() => (tagName.value === "textarea" ? "py-2.5" : ""));

const handleInput = (event) => {
  emit("update:modelValue", event.target.value);
  emit("input", event);
};
</script>
