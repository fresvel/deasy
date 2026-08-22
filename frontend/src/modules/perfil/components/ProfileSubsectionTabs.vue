<template>
  <!-- ⚠️ UN SOLO COMPONENTE PARA LOS DOS NIVELES DE PESTAÑA, con `nested` decidiendo el aspecto.
       El comportamiento es identico —lista con estado, contador y `role="tablist"`— asi que
       duplicarlo seria duplicar la accesibilidad; lo que cambia es como se lee: el nivel 1 con
       subrayado (navegacion) y el 2 como grupo segmentado (filtro de lo ya elegido). -->
  <div
    class="deasy-inline-tabs"
    :class="nested ? 'deasy-inline-tabs--anidadas' : ''"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      class="deasy-inline-tab"
      :class="[nested ? 'deasy-inline-tab--anidada' : '', tab.key === modelValue ? 'deasy-inline-tab--active' : '']"
      :aria-selected="tab.key === modelValue ? 'true' : 'false'"
      @click="$emit('update:modelValue', tab.key)"
    >
      <span class="truncate">{{ tab.label }}</span>
      <span
        v-if="typeof tab.count === 'number'"
        class="deasy-inline-tab__badge"
        :class="tab.key === modelValue ? 'deasy-inline-tab__badge--active' : ''"
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  tabs: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: 'Subsecciones',
  },
  /* El segundo nivel: se dibuja como grupo segmentado en vez de con subrayado. */
  nested: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['update:modelValue']);
</script>
