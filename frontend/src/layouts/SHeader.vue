<template>
  <header
    class="sticky top-0 z-30 flex flex-col justify-center w-full bg-gradient-to-r from-sky-900 via-sky-800 to-sky-700 text-white shadow-xl border-b border-sky-600/50 px-4 py-2 min-h-[4rem] transition-all duration-300"
  >
    <div class="flex items-center gap-4 w-full max-w-[1920px] mx-auto">
      <button 
        class="flex shrink-0 items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-white/90 hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30"
        type="button" 
        @click="onClick('User')" 
        aria-label="Abrir menú"
      >
        <IconMenu2 class="w-6 h-6" />
      </button>
      <div class="flex items-center justify-between w-full gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <slot></slot>
      </div>
    </div>
  </header>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { IconMenu2 } from '@tabler/icons-vue'

defineProps({
  menuOpen: {
    type: Boolean,
    default: false
  },
  menu: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['onclick'])

const onClick = (item) => {
  emit('onclick', item)
}
</script>