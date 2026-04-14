<template>
  <header
    class="sticky top-0 z-30 flex flex-col justify-center w-full bg-gradient-to-r from-sky-900 via-sky-800 to-sky-700 text-white shadow-md border-b border-sky-600/50 px-2 sm:px-4 py-2 min-h-[3.5rem] sm:min-h-[4rem] transition-all duration-300"
  >
    <div class="flex items-center gap-2 sm:gap-4 w-full max-w-[2560px] mx-auto">
      <button 
        class="deasy-nav-action h-9 w-9 rounded-xl !text-white/90 sm:h-11 sm:w-11 hover:!text-white"
        type="button" 
        @click="onClick('User')" 
        aria-label="Abrir menú"
      >
        <IconMenu2 class="w-5 h-5 sm:w-6 sm:h-6" />
      </button>
      <div class="flex items-center justify-between w-full gap-2 sm:gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
