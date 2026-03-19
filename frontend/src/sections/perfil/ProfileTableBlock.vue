<template>
  <section class="mt-6 mb-6 font-sans">
    <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      
      <!-- List Integrated Header -->
      <header class="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
        <h3 class="m-0 text-sm sm:text-base font-bold text-slate-700 tracking-wide uppercase">
          {{ title }}
        </h3>
      </header>
      
      <div class="overflow-x-auto rounded-lg">
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
