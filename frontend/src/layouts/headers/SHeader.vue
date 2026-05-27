<template>
  <header
    class="sticky top-0 z-50 flex h-[60px] w-full flex-col justify-center border-b border-white/10 bg-[#071927] px-3 text-white shadow-none transition-all duration-300 xl:pl-20"
  >
    <div class="mx-auto flex w-full max-w-[2560px] items-center gap-2 sm:gap-3">
      <button
        class="deasy-nav-action h-8 w-8 xl:hidden"
        type="button"
        aria-label="Abrir menu"
        @click="onClick('User')"
      >
        <IconMenu2 class="h-5 w-5" />
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
