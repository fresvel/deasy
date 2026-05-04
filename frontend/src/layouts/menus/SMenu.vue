<template>
  <aside
    class="left-0 z-40 flex h-[calc(100vh-4rem)] w-[280px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 [scrollbar-width:none] fixed xl:sticky xl:top-16 xl:translate-x-0 [&::-webkit-scrollbar]:hidden"
    :class="show ? 'top-16 translate-x-0 shadow-[20px_0_40px_rgba(15,23,42,0.12)] xl:shadow-sm' : '-translate-x-[110%] xl:hidden xl:-translate-x-0'"
  >
    <slot></slot>
  </aside>

  <div
    v-if="show"
    class="fixed inset-0 top-16 z-30 bg-slate-950/20 backdrop-blur-[2px] transition-opacity duration-300 xl:hidden"
    @click="$emit('close-mobile')"
    aria-hidden="true"
  ></div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";

defineProps({
  show: {
    type: Boolean,
    default: true
  }
});

defineEmits(["close-mobile"]);
</script>
