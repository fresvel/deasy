<template>
  <AppActionBar>
    <div class="flex flex-wrap items-center gap-2">
        <AdminButton
          variant="secondary"
          size="sm"
          :disabled="!table"
          title="Regresar"
          aria-label="Regresar"
          @click="$emit('go-back')" icon-only>
          <font-awesome-icon icon="backward" />
        </AdminButton>
        <AdminButton
          v-if="isTemplateSeedsTable && canUpdate"
          variant="secondary"
          size="sm"
          :disabled="!table || loading"
          @click="$emit('sync-template-seeds')"
        >
          <font-awesome-icon icon="rotate-right" class="mr-2" />
          Sincronizar seeds
        </AdminButton>
        <AdminButton
          v-if="canCreate"
          variant="primary"
          size="md"
          class-name="admin-page-header__create"
          :disabled="!table"
          :title="isProcessDefinitionsTable ? 'Configurar proceso' : 'Agregar'"
          :aria-label="isProcessDefinitionsTable ? 'Configurar proceso' : 'Agregar'"
          @click="$emit('create')"
        >
          <font-awesome-icon :icon="isProcessDefinitionsTable ? 'list-check' : 'plus'" class="mr-2" />
          {{ isProcessDefinitionsTable ? "Configurar proceso" : "Agregar" }}
        </AdminButton>
    </div>
  </AppActionBar>
</template>

<script setup>
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppActionBar from "@/shared/components/layout/AppActionBar.vue";

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
