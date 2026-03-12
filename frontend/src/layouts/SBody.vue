<template>
  <div :class="contentClass">
    <div class="content-panel">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import {computed, defineProps } from 'vue';


const props=defineProps({
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

const contentClass = computed(() => {
    const visiblePanels = [props.showmenu, props.shownotify, props.shownavmenu].filter(Boolean).length;
    
    if (visiblePanels === 0) {
        return "col-12";
    }
    if (visiblePanels === 1) {
        return "col-lg-10 col-md-9 col-12";
    }
    if (visiblePanels === 2) {
        return "col-lg-8 col-md-6 col-12";
    }
    // 3 paneles visibles
    return "col-lg-6 col-md-4 col-12";
});


</script>

<style scoped>
  .content-panel {
      min-height: 100vh;
      padding: 0.75rem;
      font-size: 0.2rem;
  }

</style>
