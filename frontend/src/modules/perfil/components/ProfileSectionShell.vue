<template>
  <!-- ⚠️ ANTES ESTO ERA UNA `AppActionBar` SUELTA Y EL BOTON FLOTABA SOBRE LAS PESTAÑAS.
       Medido el 2026-08-21 en `/perfil/formacion`: «Agregar» en y=76, las pestañas en y=120 y la
       tabla en y=197 — tres bloques sin relacion, y el boton pegado al borde derecho de la pagina
       mientras en `/admin` los suyos caian 17 px mas adentro. Ahora los tres viven en la misma
       barra: `AppTableToolbar` pone las pestañas arriba y las acciones a la derecha de la fila de
       abajo, igual que en admin. -->
  <AppTableToolbar :title="title">
    <!-- ⚠️ El `v-if` no basta ponerlo en la barra: reenviar un slot hace que `$slots.tabs` este
         definido aunque no llegue contenido, asi que el `v-if` de alla daria verdadero igual y
         pintaria una fila vacia. -->
    <template v-if="$slots.tabs" #tabs><slot name="tabs" /></template>
    <template #actions>
      <!-- ⚠️ «Refrescar» NO existia en perfil y en admin si, que es parte de lo que hacia que no se
           parecieran. Se puede porque `useDossierSection` YA expone `loadDossier`: no hay
           funcionalidad nueva, solo un boton que llama a lo que ya estaba.
           Los otros dos de admin siguen sin estar, y por motivos distintos: «Buscar» pide estado de
           filtrado que el dossier NO tiene —sus filas solo se filtran por subpestaña—, y «Volver»
           no tiene a donde ir, porque aqui la seccion se elige en el menu lateral y no hay indice
           previo al que regresar. -->
      <AppButton
        v-if="showRefresh"
        variant="primary-outline"
        icon-only
        title="Actualizar"
        aria-label="Actualizar"
        @click="$emit('refresh')"
      >
        <IconRefresh class="h-4 w-4" />
      </AppButton>
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
  <!-- ⚠️ EL HUECO ENTRE LA BARRA Y LA TABLA ERA CERO Y HAY QUE DECLARARLO. La barra y el
       contenido eran hermanos sueltos sin contenedor que repartiera espacio, asi que en
       `/perfil/formacion` el boton «Agregar» quedaba **pegado a la tabla** —medido: 0 px—
       mientras en admin la seccion los separaba con 16. Ahora lo pone esta pila: 16 px es el paso
       SEPARADO de la escala de F13.2, el mismo que usa admin. -->
  <div class="mt-4">
    <slot />
  </div>
</template>

<script setup>
import { IconPlus, IconRefresh } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import AppTableToolbar from '@/shared/components/layout/AppTableToolbar.vue';

defineProps({
  /* El nombre de la seccion, para la fila superior cuando no hay pestañas. */
  title: { type: String, default: '' },
  addLabel: { type: String, default: 'Agregar' },
  showRefresh: { type: Boolean, default: true },
  showAdd: { type: Boolean, default: true },
  addDisabled: { type: Boolean, default: false },
  addDisabledTitle: { type: String, default: 'No tienes permiso para agregar registros.' }
});
defineEmits(['add', 'refresh']);
</script>
