<template>
  <div>
    <div
      v-show="show"
      class="fixed inset-0 top-16 z-[20] bg-slate-950/20 backdrop-blur-[2px]"
      @click="$emit('close')"
    ></div>

    <div
      v-show="show"
      class="fixed right-4 top-[4.5rem] z-[50] flex w-[calc(100vw-2rem)] origin-top-right transform flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_48px_rgba(15,23,42,0.12)] transition-all duration-200 sm:right-6 sm:w-80 md:w-96 lg:right-8"
      :class="show ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-2 scale-95 opacity-0'"
    >
      <header class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div class="flex items-center gap-2 text-slate-800">
          <IconBellFilled class="h-5 w-5 text-blue-600" />
          <h3 class="m-0 text-sm font-semibold leading-tight">Notificaciones</h3>
        </div>
        <button
          class="rounded-2xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/15 sm:hidden"
          aria-label="Cerrar notificaciones"
          @click="$emit('close')"
        >
          <IconX class="h-5 w-5" />
        </button>
      </header>

      <div class="custom-scrollbar flex max-h-[60vh] flex-1 flex-col overflow-y-auto p-3">
        <div class="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            <IconInbox class="h-6 w-6 stroke-[1.5]" />
          </div>
          <span class="text-sm font-medium">Bandeja vacía</span>
        </div>
      </div>

      <footer class="border-t border-slate-200 bg-slate-50/70 p-3">
        <button class="deasy-btn deasy-btn--secondary deasy-btn--sm w-full">
          Marcar todo como leído
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { IconBellFilled, IconX, IconInbox } from "@tabler/icons-vue";

defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

defineEmits(["close"]);
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
