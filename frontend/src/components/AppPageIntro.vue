<template>
  <section class="app-page-intro">
    <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div v-if="$slots.media" class="shrink-0">
        <slot name="media" />
      </div>

      <div class="app-page-intro__body">
        <h1 class="app-page-intro__title">{{ title }}</h1>
        <p v-if="meta" class="app-page-intro__meta">{{ meta }}</p>
        <p class="app-page-intro__description">
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
defineProps({
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
  }
});
</script>
