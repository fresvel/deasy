<template>
  <div class="profile-section-header">
    <div>
      <h2 class="text-start profile-section-title table-title-with-icon">
        <span
          class="table-title-icon"
          :class="{ 'is-template-artifacts': isTemplateArtifactsTable }"
          aria-hidden="true"
        >
          <font-awesome-icon :icon="tableHeaderIcon" />
        </span>
        <span>{{ tableHeaderTitle }}</span>
      </h2>
      <p class="profile-section-subtitle">
        {{ tableHeaderSubtitle }}
      </p>
    </div>
    <div class="profile-section-actions">
      <div class="flex flex-wrap items-center gap-2">
        <AdminButton
          variant="secondary"
          size="lg"
          :disabled="!table"
          title="Regresar"
          aria-label="Regresar"
          @click="$emit('go-back')"
        >
          <font-awesome-icon icon="backward" />
        </AdminButton>
        <AdminButton
          variant="secondary"
          size="lg"
          :disabled="!table"
          @click="$emit('search')"
        >
          Buscar
        </AdminButton>
        <AdminButton
          v-if="isTemplateSeedsTable"
          variant="secondary"
          size="lg"
          :disabled="!table || loading"
          @click="$emit('sync-template-seeds')"
        >
          <font-awesome-icon icon="rotate-right" class="mr-2" />
          Sincronizar seeds
        </AdminButton>
        <AdminButton
          v-if="isTemplateArtifactsTable"
          variant="secondary"
          size="lg"
          :disabled="!table || loading"
          @click="$emit('sync-template-artifacts')"
        >
          <font-awesome-icon icon="rotate-right" class="mr-2" />
          Sincronizar dist
        </AdminButton>
        <AdminButton
          variant="primary"
          size="lg"
          class-name="profile-add-btn"
          :disabled="!table"
          @click="$emit('create')"
        >
          <font-awesome-icon icon="plus" class="mr-2" />
          Agregar
        </AdminButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import AdminButton from "@/components/AppButton.vue";

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
  isTemplateArtifactsTable: {
    type: Boolean,
    default: false
  }
});

defineEmits([
  "go-back",
  "search",
  "sync-template-seeds",
  "sync-template-artifacts",
  "create"
]);
</script>
