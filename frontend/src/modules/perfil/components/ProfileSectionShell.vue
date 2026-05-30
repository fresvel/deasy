<template>
  <div class="admin-page-header">
    <div class="admin-page-header__main" />
    <div class="admin-page-header__actions">
      <AppButton
        v-if="showAdd"
        variant="primary"
        size="md"
        class-name="admin-page-header__create"
        :disabled="addDisabled"
        :title="addDisabled ? addDisabledTitle : addLabel"
        :aria-label="addDisabled ? addDisabledTitle : addLabel"
        @click="$emit('add')"
      >
        <IconPlus class="w-4 h-4 mr-2 stroke-[2.5]" />
        {{ addLabel }}
      </AppButton>
    </div>
  </div>
  <slot />
</template>

<script setup>
import { IconPlus } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';

defineProps({
  addLabel: { type: String, default: 'Agregar' },
  showAdd: { type: Boolean, default: true },
  addDisabled: { type: Boolean, default: false },
  addDisabledTitle: { type: String, default: 'No tienes permiso para agregar registros.' }
});
defineEmits(['add']);
</script>
