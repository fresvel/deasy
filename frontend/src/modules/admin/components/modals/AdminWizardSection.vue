<template>
  <section class="flex flex-col gap-4">
    <header v-if="title || $slots.actions" class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h4 class="m-0 text-sm font-bold text-slate-800">{{ title }}</h4>
        <p v-if="subtitle" class="m-0 mt-0.5 text-xs font-medium text-slate-500">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup>
defineProps({
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" }
});
</script>
