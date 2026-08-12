<template>
  <header
    class="sticky top-0 z-50 flex h-[60px] w-full flex-col justify-center border-b border-brand-white/10 bg-brand-navy-deep pl-[4.25rem] pr-3 text-white shadow-none transition-all duration-300 xl:pl-20"
  >
    <AppLogo
      to="/home"
      size="sm"
      class-name="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center overflow-hidden rounded-2xl border border-brand-white/20 bg-brand-white p-1 shadow-sm"
      image-class="max-h-8 max-w-8 rounded-xl"
      aria-label="Ir al inicio"
    />
    <div class="mx-auto flex w-full max-w-[2560px] items-center gap-2 sm:gap-3">
      <button
        class="deasy-nav-action h-9 w-9"
        type="button"
        aria-label="Abrir menu"
        @click="onClick('User')"
      >
        <IconMenu2 class="h-5.5 w-5.5" />
      </button>
      <div class="flex w-full items-center justify-between gap-2 overflow-x-auto [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
        <slot></slot>
      </div>
    </div>
  </header>
</template>

<script setup>
import { defineEmits, defineProps } from "vue";
import { IconMenu2 } from "@tabler/icons-vue";
import AppLogo from "@/shared/components/layout/AppLogo.vue";

defineProps({
  menuOpen: {
    type: Boolean,
    default: false
  },
  menu: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(["onclick"]);

const onClick = (item) => {
  emit("onclick", item);
};
</script>
