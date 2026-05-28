<template>
  <div class="deasy-inline-tabs" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      class="deasy-inline-tab"
      :class="tab.key === modelValue ? 'deasy-inline-tab--active' : ''"
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
});

defineEmits(['update:modelValue']);
</script>
