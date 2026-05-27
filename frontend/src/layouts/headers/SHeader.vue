<template>
  <header
    class="sticky top-0 z-30 flex w-full flex-col justify-center border-b px-2 py-2 text-white shadow-[0_1px_2px_rgba(7,18,38,0.12),0_8px_18px_rgba(7,18,38,0.12)] backdrop-blur transition-all duration-300 sm:min-h-[4rem] sm:px-4"
    style="border-color: rgba(255,255,255,0.06); background: linear-gradient(180deg, #345364 0%, #456878 100%);"
  >
    <div class="mx-auto flex w-full max-w-[2560px] items-center gap-2 sm:gap-4">
      <button
        class="deasy-nav-action h-9 w-9 sm:h-11 sm:w-11"
        type="button"
        aria-label="Abrir menu"
        @click="onClick('User')"
      >
        <IconMenu2 class="h-5 w-5 sm:h-6 sm:w-6" />
      </button>
      <AppLogo
        to="/dashboard"
        size="sm"
        class-name="shrink-0"
        image-class="max-w-[7rem] sm:max-w-[8.5rem]"
      />
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
