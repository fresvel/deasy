<template>
  <aside
    class="left-0 z-40 flex h-[calc(100vh-4rem)] w-[282px] shrink-0 flex-col overflow-y-auto border-r p-4 transition-all duration-300 [scrollbar-width:none] fixed xl:sticky xl:top-16 xl:translate-x-0 [&::-webkit-scrollbar]:hidden"
    :class="show ? 'top-16 translate-x-0 shadow-[18px_0_36px_rgba(7,18,38,0.22)] xl:shadow-none' : '-translate-x-[110%] xl:hidden xl:-translate-x-0'"
    style="border-color: rgba(255,255,255,0.06); background: linear-gradient(180deg, #2a4554 0%, #355766 42%, #476a79 100%);"
  >
    <slot></slot>
  </aside>

  <div
    v-if="show"
    class="fixed inset-0 top-16 z-30 bg-slate-950/28 backdrop-blur-[3px] transition-opacity duration-300 xl:hidden"
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
