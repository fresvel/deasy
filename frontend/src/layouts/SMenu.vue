<template>
  <aside 
    v-if="show" 
    class="flex flex-col w-full lg:w-[280px] shrink-0 h-[calc(100vh-4rem)] z-40 overflow-y-auto border-r border-sky-600/30 bg-gradient-to-b from-sky-900 via-sky-800 to-sky-700 p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300
           fixed lg:sticky top-16 left-0"
  >
    <slot></slot>
  </aside>

  <!-- Overlay transparent for mobile when menu is open -->
  <div 
    v-if="show" 
    class="fixed inset-0 top-16 z-30 bg-black/20 lg:hidden backdrop-blur-sm"
    @click="$emit('close-mobile')"
  ></div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue"

defineProps({
  show: {
    type: Boolean,
    default: true,
  }
})

defineEmits(['close-mobile'])
</script>
