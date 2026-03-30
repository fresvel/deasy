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
      <div class="d-flex gap-2">
        <button
          class="btn btn-outline-secondary btn-lg"
          type="button"
          :disabled="!table"
          title="Regresar"
          aria-label="Regresar"
          @click="$emit('go-back')"
        >
          <font-awesome-icon icon="backward" />
        </button>
        <button
          class="btn btn-outline-secondary btn-lg"
          type="button"
          :disabled="!table"
          @click="$emit('search')"
        >
          Buscar
        </button>
        <button
          v-if="isTemplateSeedsTable"
          class="btn btn-outline-secondary btn-lg"
          type="button"
          :disabled="!table || loading"
          @click="$emit('sync-template-seeds')"
        >
          <font-awesome-icon icon="rotate-right" class="me-2" />
          Sincronizar seeds
        </button>
        <button
          v-if="isTemplateArtifactsTable"
          class="btn btn-outline-secondary btn-lg"
          type="button"
          :disabled="!table || loading"
          @click="$emit('sync-template-artifacts')"
        >
          <font-awesome-icon icon="rotate-right" class="me-2" />
          Sincronizar dist
        </button>
        <button
          class="btn btn-primary btn-lg profile-add-btn"
          type="button"
          :disabled="!table"
          @click="$emit('create')"
        >
          <font-awesome-icon icon="plus" class="me-2" />
          Agregar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
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
