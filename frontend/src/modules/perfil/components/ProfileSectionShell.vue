<template>
  <section class="deasy-section-shell">
    <div class="deasy-section-card">
      
      <header class="deasy-section-header">
        <div class="deasy-section-header__body">
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
import AppButton from '@/shared/components/ui/AppButton.vue';

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
