<template>
  <div :class="groupClass">
    <label
      v-if="label || $slots.labelSuffix"
      :for="labelFor || undefined"
      class="admin-field-label mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700"
      :class="labelClass"
    >
      {{ label }}
      <span v-if="required" class="text-red-600">*</span>
      <slot name="labelSuffix" />
    </label>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: ""
  },
  // Id del control que el consumidor renderiza en el slot por defecto. Se emite como <label for>
  // para que la etiqueta quede asociada al control (a11y); si no se pasa, no se renderiza el atributo.
  labelFor: {
    type: String,
    default: ""
  },
  required: {
    type: Boolean,
    default: false
  },
  groupClass: {
    type: [String, Array, Object],
    default: ""
  },
  labelClass: {
    type: [String, Array, Object],
    default: ""
  }
});
</script>
