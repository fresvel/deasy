<template>
  <!-- ⚠️ ANTES ESTO ERA UNA `AppActionBar` SUELTA Y EL BOTON FLOTABA SOBRE LAS PESTAÑAS.
       Medido el 2026-08-21 en `/perfil/formacion`: «Agregar» en y=76, las pestañas en y=120 y la
       tabla en y=197 — tres bloques sin relacion, y el boton pegado al borde derecho de la pagina
       mientras en `/admin` los suyos caian 17 px mas adentro. Ahora los tres viven en la misma
       barra: `AppTableToolbar` pone las pestañas arriba y las acciones a la derecha de la fila de
       abajo, igual que en admin. -->
  <AppTableToolbar :title="title">
    <template v-if="$slots.tabs" #tabs><slot name="tabs" /></template>
    <template #search><slot name="search" /></template>
    <template #actions>
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
    </template>
  </AppTableToolbar>
  <slot />
</template>

<script setup>
import { IconPlus } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import AppTableToolbar from '@/shared/components/layout/AppTableToolbar.vue';

defineProps({
  /* El nombre de la seccion, para la fila superior cuando no hay pestañas. */
  title: { type: String, default: '' },
  addLabel: { type: String, default: 'Agregar' },
  showAdd: { type: Boolean, default: true },
  addDisabled: { type: Boolean, default: false },
  addDisabledTitle: { type: String, default: 'No tienes permiso para agregar registros.' }
});
defineEmits(['add']);
</script>
