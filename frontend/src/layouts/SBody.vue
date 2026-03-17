<template>
  <div class="flex flex-col flex-1 min-w-0 w-full transition-all duration-300">
    <div class="w-full h-full pb-8">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps } from 'vue';

const props = defineProps({
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
})
</script>
