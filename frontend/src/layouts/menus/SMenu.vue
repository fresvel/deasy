<template>
  <aside 
    class="flex flex-col w-[280px] shrink-0 h-[calc(100vh-4rem)] z-40 overflow-y-auto border-r border-[rgba(226,242,250,0.10)] bg-[linear-gradient(180deg,#131723_0%,#182232_42%,#0d434d_78%,rgba(74,140,255,0.30)_118%,rgba(226,242,250,0.14)_138%)] p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300 left-0
           fixed xl:sticky xl:top-16 xl:translate-x-0"
    :class="show ? 'translate-x-0 top-16 shadow-[20px_0_40px_rgba(0,0,0,0.5)] xl:shadow-none' : '-translate-x-[110%] xl:-translate-x-0 xl:hidden'"
  >
    <slot></slot>
  </aside>

  <!-- Overlay transparent for mobile when menu is open -->
  <div 
    v-if="show" 
    class="fixed inset-0 top-16 z-30 bg-slate-900/50 xl:hidden backdrop-blur-sm transition-opacity duration-300"
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
