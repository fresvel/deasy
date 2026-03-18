<template>
  <section class="mt-8 mb-6 font-sans">
    <div class="bg-white rounded-xl border border-slate-200 p-1 sm:p-5 relative pt-8 shadow-sm">
      <header class="absolute top-0 left-4 sm:left-6 -translate-y-1/2 bg-sky-600/10 text-sky-800 border border-sky-600/20 px-4 py-1.5 rounded-lg backdrop-blur-sm">
        <h3 class="m-0 text-xs sm:text-sm font-bold tracking-wide uppercase">{{ title }}</h3>
      </header>
      <div class="overflow-x-auto rounded-xl mt-1">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { defineProps } from "vue";

defineProps({
  title: {
    type: String,
    required: true
  }
});
</script>
