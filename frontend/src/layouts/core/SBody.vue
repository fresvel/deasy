<template>
  <main class="flex min-w-0 flex-1 flex-col w-full bg-brand-white px-3 py-4 transition-all duration-300 sm:px-4 lg:px-5">
    <div class="w-full h-full pb-6">
      <slot></slot>
    </div>
  </main>
</template>

<script setup>
import { defineProps } from "vue";

defineProps({
    showmenu: {
        type: Boolean,
        default: false
    },
    shownotify: {
        type: Boolean,
        default: false
    },
    shownavmenu: {
        type: Boolean,
        default: false
    }
});
</script>
