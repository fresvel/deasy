<template>
  <aside
    class="fixed left-0 top-[60px] z-40 flex h-[calc(100vh-60px)] w-[282px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#071927] transition-all duration-300 [scrollbar-width:none] xl:sticky xl:top-[60px] xl:h-[calc(100vh-60px)] xl:w-20 xl:translate-x-0 xl:overflow-visible [&::-webkit-scrollbar]:hidden"
    :class="show ? 'translate-x-0 shadow-[18px_0_36px_rgba(7,18,38,0.24)] xl:shadow-none' : '-translate-x-[110%] xl:translate-x-0'"
  >
    <slot></slot>
  </aside>

  <div
    v-if="show"
    class="fixed inset-0 top-[60px] z-30 bg-slate-950/28 backdrop-blur-[3px] transition-opacity duration-300 xl:hidden"
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
