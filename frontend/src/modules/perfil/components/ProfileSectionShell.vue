<template>
  <section class="deasy-section-shell">
    <div class="deasy-section-card">
      
      <header class="mb-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-[#fbfcfe] px-5 py-5 sm:flex-row sm:items-center">
        <div class="deasy-section-header__body">
          <div class="mb-2 inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Dossier profesional
          </div>
          <h2 class="deasy-section-header__title flex items-center gap-2">
            {{ title }}
          </h2>
          <p class="deasy-section-header__subtitle">{{ subtitle }}</p>
        </div>
        
        <AppButton
          v-if="showAdd"
          variant="primary"
          size="md"
          class-name="w-full sm:w-auto shrink-0"
          type="button"
          :disabled="addDisabled"
          :title="addDisabled ? addDisabledTitle : addLabel"
          :aria-label="addDisabled ? addDisabledTitle : addLabel"
          @click="$emit('add')"
        >
          <IconPlus class="w-4 h-4 stroke-[2.5]" />
          {{ addLabel }}
        </AppButton>
      </header>

      <div class="mt-2 min-w-0 max-w-full">
        <slot />
      </div>

    </div>
  </section>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import { IconPlus } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';

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
  },
  addDisabled: {
    type: Boolean,
    default: false
  },
  addDisabledTitle: {
    type: String,
    default: 'No tienes permiso para agregar registros.'
  }
});

defineEmits(['add']);
</script>
