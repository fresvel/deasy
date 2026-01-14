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
    }
})

const contentClass = computed(() => {
    if (props.showmenu && props.shownotify) {
        return "col-lg-7 col-md-6 col-12";
    }
    if (!props.showmenu && !props.shownotify) {
        return "col-12";
    }
    if (props.showmenu && !props.shownotify) {
        return "col-lg-9 col-md-8 col-12";
    }
    return "col-lg-10 col-md-9 col-12";
});


</script>

<style scoped>
  .content-panel {
      min-height: 100vh;
      padding: 0.75rem;
  }

</style>
