<template>
  <section class="deasy-table-shell overflow-hidden font-sans">
      
      <!-- List Integrated Header -->
      <header class="deasy-table-header mb-0 rounded-t-xl bg-[#f8fafc] px-5 py-4">
        <h3 class="deasy-table-title text-base sm:text-lg">
          {{ title }}
        </h3>
      </header>
      
      <div class="deasy-table-responsive rounded-none border-0 border-t border-[#e2e6f0]">
        <slot />
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
