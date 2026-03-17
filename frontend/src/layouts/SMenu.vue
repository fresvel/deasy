<template>
  <div v-if="show" class="w-full md:w-64 lg:w-[280px] shrink-0">
    <aside class="flex flex-col h-[calc(100vh-6rem)] mt-1 mb-2 sticky top-20 overflow-y-auto rounded-b-2xl md:rounded-2xl bg-gradient-to-br from-sky-800 via-sky-700 to-sky-600 shadow-xl border border-sky-400/30 p-4 z-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <slot></slot>
    </aside>
  </div>
</template>

<script setup>
import { defineProps } from "vue"

defineProps({
  show: {
    type: Boolean,
    default: true,
  },
  menu: {
    type: Array,
    default: () => [],
  },
})
</script>
