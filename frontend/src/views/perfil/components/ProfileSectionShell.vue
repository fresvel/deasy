<template>
  <section class="max-w-[2560px] mx-auto w-full mt-6 mb-8 font-sans px-2 sm:px-6 lg:px-8">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 lg:p-8">
      
      <!-- Componente Header Integrado al Contenedor Principal -->
      <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
        <div class="flex-1 min-w-0">
          <h2 class="m-0 font-bold text-lg sm:text-xl text-slate-800 tracking-tight flex items-center gap-2">
            {{ title }}
          </h2>
          <p class="mt-1 text-sm text-slate-500 font-medium">{{ subtitle }}</p>
        </div>
        
        <AppButton
          v-if="showAdd"
          variant="primary"
          size="md"
          class-name="w-full sm:w-auto shrink-0"
          type="button"
          @click="$emit('add')"
        >
          <IconPlus class="w-4 h-4 stroke-[2.5]" />
          {{ addLabel }}
        </AppButton>
      </header>

      <!-- Contenido Principal -->
      <div class="mt-2 min-w-0 max-w-full">
        <slot />
      </div>

    </div>
  </section>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { IconPlus } from '@tabler/icons-vue';
import AppButton from '@/components/AppButton.vue';

defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  addLabel: {
    type: String,
    default: 'Agregar'
  },
  showAdd: {
    type: Boolean,
    default: true
  }
});

defineEmits(['add']);
</script>
