<template>
  <section class="max-w-[2560px] mx-auto px-4 sm:px-6 lg:px-8 w-full mt-10 mb-8 font-sans">
    <div class="bg-white rounded-2xl shadow-[0_2px_15px_rgba(2,132,199,0.06)] border border-slate-200 relative pt-12 p-5 sm:px-8 sm:pb-8">
      
      <!-- Elevated Header -->
      <header class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] sm:w-[90%] bg-white rounded-2xl border border-slate-200 p-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div class="flex-1">
          <h2 class="m-0 font-bold text-xl sm:text-2xl text-slate-800 tracking-tight flex items-center gap-2">
            {{ title }}
          </h2>
          <p class="mt-1 mb-0 text-sm text-slate-500 font-medium">{{ subtitle }}</p>
        </div>
        <button v-if="showAdd" class="w-full sm:w-auto flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 hover:-translate-y-0.5" type="button" @click="$emit('add')">
          <IconPlus class="w-5 h-5 stroke-[2.5]" />
          {{ addLabel }}
        </button>
      </header>

      <div class="mt-4 sm:mt-2">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";
import { IconPlus } from '@tabler/icons-vue';

defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ""
  },
  addLabel: {
    type: String,
    default: "Agregar"
  },
  showAdd: {
    type: Boolean,
    default: true
  }
});

defineEmits(["add"]);
</script>
