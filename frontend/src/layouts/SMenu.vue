<template>
  <aside 
    class="flex flex-col w-[280px] shrink-0 h-[calc(100vh-4rem)] z-40 overflow-y-auto border-r border-sky-600/30 bg-gradient-to-b from-sky-900 via-sky-800 to-sky-700 p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 left-0
           fixed lg:sticky lg:top-16 lg:translate-x-0"
    :class="show ? 'translate-x-0 top-16 shadow-[20px_0_40px_rgba(0,0,0,0.5)] lg:shadow-none' : '-translate-x-[110%] lg:-translate-x-0 lg:hidden'"
  >
    <slot></slot>
  </aside>

  <!-- Overlay transparent for mobile when menu is open -->
  <div 
    v-if="show" 
    class="fixed inset-0 top-16 z-30 bg-slate-900/50 lg:hidden backdrop-blur-sm transition-opacity duration-300"
    @click="$emit('close-mobile')"
    aria-hidden="true"
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
