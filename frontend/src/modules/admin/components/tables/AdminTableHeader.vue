<template>
  <!-- ⚠️ ESTE COMPONENTE SON SOLO SUS BOTONES: no pinta caja, ni barra, ni titulo.
       La barra (`AppTableToolbar`) la monta `AdminMainTableSection`, porque el dueño pidio **todos
       los botones de accion en UNA fila** y los del filtro —Limpiar, Buscar, Mostrar filtros y
       Actualizar— viven alli con estado local. Estos entran por su slot `actions`. Si esto
       volviera a envolver, habria DOS barras anidadas.

       ⚠️ Y LAS TRES PROPS DE CABECERA SIGUEN DECLARADAS PERO YA NO SE LEEN AQUI. `tableHeaderTitle`
       lo consume ahora la barra —`AdminTableManager` se lo pasa a la seccion—; `tableHeaderIcon` y
       `-Subtitle` **no las lee nadie desde que existe este fichero**, y eso es deuda anotada, no un
       descuido de hoy: es el mismo hallazgo que F13.1b hizo con `SBody`. Se retiran cuando se
       decida si el icono y el subtitulo entran en la barra. -->
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

<script setup>
import AdminButton from "@/shared/components/buttons/AppButton.vue";

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
