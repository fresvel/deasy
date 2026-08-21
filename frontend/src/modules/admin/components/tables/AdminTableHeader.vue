<template>
  <!-- ⚠️ ANTES ESTO ERA UNA `AppActionBar` Y LAS TRES PROPS DE CABECERA NO SE LEIAN.
       `AdminTableManager` calculaba y pasaba `tableHeaderTitle`, `tableHeaderIcon` y
       `tableHeaderSubtitle`, y esta plantilla **no mencionaba ninguna de las tres**: el nombre de
       la tabla se tiraba, y en `/admin` solo se sabia que tabla estabas viendo mirando el menu
       lateral. Mismo hallazgo que F13.1b con `SBody` y F1.3c con los `AdminDefinition*`.
       Ahora la fila de arriba lo dice, que es la regla de `AppTableToolbar`: **esa fila dice
       siempre DONDE estas** —pestañas si la pagina tiene variantes, el nombre si no—. -->
  <AppTableToolbar :title="tableHeaderTitle">
    <template #actions>
        <AdminButton
          variant="neutral-outline"
          :disabled="!table"
          title="Regresar"
          aria-label="Regresar"
          @click="$emit('go-back')" icon-only>
          <font-awesome-icon icon="backward" />
        </AdminButton>
        <AdminButton
          v-if="isTemplateSeedsTable && canUpdate"
          variant="neutral-outline"
          :disabled="!table || loading"
          @click="$emit('sync-template-seeds')"
        >
          <font-awesome-icon icon="rotate-right" class="mr-2" />
          Sincronizar seeds
        </AdminButton>
        <AdminButton
          v-if="canCreate"
          variant="primary-outline"
          size="md"
          class-name="deasy-btn--wide"
          :disabled="!table"
          :title="isProcessDefinitionsTable ? 'Configurar proceso' : 'Agregar'"
          :aria-label="isProcessDefinitionsTable ? 'Configurar proceso' : 'Agregar'"
          @click="$emit('create')"
        >
          <font-awesome-icon :icon="isProcessDefinitionsTable ? 'list-check' : 'plus'" class="mr-2" />
          {{ isProcessDefinitionsTable ? "Configurar proceso" : "Agregar" }}
        </AdminButton>
    </template>
  </AppTableToolbar>
</template>

<script setup>
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppTableToolbar from "@/shared/components/layout/AppTableToolbar.vue";

defineProps({
  tableHeaderIcon: {
    type: [Array, String],
    default: ""
  },
  tableHeaderTitle: {
    type: String,
    default: ""
  },
  tableHeaderSubtitle: {
    type: String,
    default: ""
  },
  table: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  isTemplateSeedsTable: {
    type: Boolean,
    default: false
  },
  isProcessDefinitionsTable: {
    type: Boolean,
    default: false
  },
  canCreate: {
    type: Boolean,
    default: true
  },
  canUpdate: {
    type: Boolean,
    default: true
  }
});

defineEmits([
  "go-back",
  "sync-template-seeds",
  "create"
]);
</script>
