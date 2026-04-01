<template>
  <section :class="introClass">
    <div class="deasy-page-intro__layout">
      <div v-if="$slots.media" class="shrink-0">
        <slot name="media" />
      </div>

      <div class="deasy-page-intro__body">
        <h1 class="deasy-page-intro__title">{{ title }}</h1>
        <p v-if="meta" class="deasy-page-intro__meta">{{ meta }}</p>
        <p class="deasy-page-intro__description">
          {{ description }}
        </p>
      </div>

      <div v-if="$slots.actions" class="shrink-0 sm:self-center">
        <slot name="actions" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  meta: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: "default"
  }
});

const introClass = computed(() => [
  "deasy-page-intro",
  props.variant === "dashboard" ? "deasy-page-intro--dashboard" : ""
]);
</script>
