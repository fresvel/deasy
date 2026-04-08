<template>
  <div
    v-if="visible"
    :class="[
      'flex flex-col items-center justify-center p-6 transition-all duration-300',
      {
        'fixed inset-0 z-100 bg-slate-900/40 backdrop-blur-sm': overlay && fullScreen,
        'absolute inset-0 z-40 bg-white/80 backdrop-blur-[2px] rounded-inherit': overlay && !fullScreen,
        'relative bg-transparent': !overlay,
      }
    ]"
  >
    <div class="flex flex-col items-center justify-center">
      <div class="relative w-16 h-16 mb-4 flex items-center justify-center">
        <!-- Background pulse -->
        <span class="absolute inset-0 rounded-full border-4 border-sky-100 opacity-70"></span>
        <!-- Spinner icon -->
        <IconLoader2
          class="w-10 h-10 text-sky-600 animate-spin relative z-10"
          stroke-width="2.5"
        />
      </div>
      <p v-if="text" class="text-sm font-bold text-slate-700 tracking-wide uppercase mt-1 animate-pulse">
        {{ text }}
      </p>
      <p v-if="subText" class="text-xs text-slate-500 mt-2 font-medium max-w-xs text-center leading-relaxed">
        {{ subText }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { IconLoader2 } from '@tabler/icons-vue';

defineOptions({
  name: 'AppLoading'
});

defineProps({
  visible: {
    type: Boolean,
    default: true
  },
  text: {
    type: String,
    default: 'Cargando...'
  },
  subText: {
    type: String,
    default: ''
  },
  overlay: {
    type: Boolean,
    default: true
  },
  fullScreen: {
    type: Boolean,
    default: false
  }
});
</script>
