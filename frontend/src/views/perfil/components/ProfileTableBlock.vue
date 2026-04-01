<template>
  <section class="deasy-table-shell font-sans">
      
      <!-- List Integrated Header -->
      <header class="deasy-table-header">
        <h3 class="deasy-table-title">
          {{ title }}
        </h3>
      </header>
      
      <div class="deasy-table-responsive">
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
