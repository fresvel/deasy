<template>
  <AppActionBar>
    <AppButton
        v-if="showAdd"
        variant="primary-outline"
        size="md"
        class-name="deasy-btn--wide"
        :disabled="addDisabled"
        :title="addDisabled ? addDisabledTitle : addLabel"
        :aria-label="addDisabled ? addDisabledTitle : addLabel"
        @click="$emit('add')"
      >
        <IconPlus class="w-4 h-4 mr-2 stroke-[2.5]" />
      {{ addLabel }}
    </AppButton>
  </AppActionBar>
  <slot />
</template>

<script setup>
import { IconPlus } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import AppActionBar from '@/shared/components/layout/AppActionBar.vue';

defineProps({
  addLabel: { type: String, default: 'Agregar' },
  showAdd: { type: Boolean, default: true },
  addDisabled: { type: Boolean, default: false },
  addDisabledTitle: { type: String, default: 'No tienes permiso para agregar registros.' }
});
defineEmits(['add']);
</script>
