<template>
  <div>
    <!-- Overlay para tapar el fondo y capturar clicks -->
    <div 
      v-show="show" 
      class="fixed inset-0 top-16 z-20 bg-slate-900/20 backdrop-blur-sm"
      @click="$emit('close')"
    ></div>

    <!-- Panel Dropdown Notificaciones -->
    <div 
      v-show="show" 
      class="fixed top-18 right-4 sm:right-6 lg:right-8 z-50 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-white rounded-2xl shadow-xl shadow-slate-300/60 border border-slate-100 flex flex-col overflow-hidden transition-all duration-200 transform origin-top-right"
      :class="show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'"
    >
      <header class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div class="flex items-center gap-2 text-slate-800">
          <IconBellFilled class="w-5 h-5 text-sky-600" />
          <h3 class="text-sm font-bold m-0 leading-tight">Notificaciones</h3>
        </div>
        <button 
          class="sm:hidden text-slate-400 hover:text-slate-600 focus:outline-none" 
          @click="$emit('close')"
        >
          <IconX class="w-5 h-5" />
        </button>
      </header>

      <div class="flex flex-col flex-1 max-h-[60vh] overflow-y-auto custom-scrollbar p-3">
        <!-- Lista vacía -->
        <div class="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
          <div class="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
             <IconInbox class="w-6 h-6 stroke-[1.5]" />
          </div>
          <span class="text-sm font-medium">Bandeja vacía</span>
        </div>
      </div>

      <footer class="p-3 border-t border-slate-100 bg-white">
        <button class="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold py-2.5 rounded-xl transition-colors">
          Marcar todo como leído
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { IconBellFilled, IconX, IconInbox } from '@tabler/icons-vue'

defineProps({
    show: {
      type: Boolean,
      default: false,
    }
})

defineEmits(['close'])
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
