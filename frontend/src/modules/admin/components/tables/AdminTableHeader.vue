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
          v-if="isGeneradoresTable && canUpdate"
          variant="neutral-outline"
          :disabled="!table || loading"
          @click="$emit('sync-template-seeds')"
        >
          <font-awesome-icon icon="rotate-right" class="mr-2" />
          Sincronizar generadores
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
        <!-- EN LA PANTALLA DE ACTOS: cuántos siguen sin documento, y la lista general para adjuntarlo
             (frente 27, F27.P4.T11). La de cada nodo está en la pestaña «Actos» de su modal; ésta es
             donde se ve también el acto que todavía no ordena nada. Vive aquí y no en
             `AdminTableManager` porque la cabecera se monta en cuatro ramas de aquél. -->
        <AdminButton
          v-if="esLaTablaDeActos"
          :variant="actosSinDocumento ? 'warning-soft' : 'neutral-outline'"
          title="Los actos y su documento"
          @click="actosAbierto = true"
        >
          Documentos<span v-if="actosSinDocumento" class="ml-1 font-semibold">· {{ actosSinDocumento }} sin documento</span>
        </AdminButton>
        <ActosDocumentosModal
          v-if="actosAbierto"
          :open="actosAbierto"
          :editable="canUpdate"
          @close="actosAbierto = false"
          @cambio="contarActosSinDocumento"
        />
</template>

<script setup>
import { computed, ref, watch } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import ActosDocumentosModal from "@/modules/admin/components/units/ActosDocumentosModal.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
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
  isGeneradoresTable: {
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

const esLaTablaDeActos = computed(() => props.table?.table === "actos");
const actosAbierto = ref(false);
const actosSinDocumento = ref(0);
// Si falla no se enseña cifra: es un aviso, no un bloqueo.
const contarActosSinDocumento = async () => {
  try {
    const { data } = await adminSqlService.getActosYSuDocumento({ soloSinDocumento: true });
    actosSinDocumento.value = Array.isArray(data) ? data.length : 0;
  } catch {
    actosSinDocumento.value = 0;
  }
};
watch(esLaTablaDeActos, (es) => { if (es) contarActosSinDocumento(); }, { immediate: true });
</script>
