<template>
  <div class="profile-section-header">
    <div>
      <h2 class="text-start profile-section-title table-title-with-icon">
        <span
          class="table-title-icon"
          :class="{ 'is-template-artifacts': isTemplateArtifactsTable }"
          aria-hidden="true"
        >
          <component :is="tablerIconMap[tableHeaderIcon] || tablerIconMap['info-circle']" />
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
          <IconArrowLeft />
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
          <IconRefresh class="mr-2" />
          Sincronizar seeds
        </AdminButton>
        <AdminButton
          v-if="isTemplateArtifactsTable"
          variant="secondary"
          size="lg"
          :disabled="!table || loading"
          @click="$emit('sync-template-artifacts')"
        >
          <IconRefresh class="mr-2" />
          Sincronizar dist
        </AdminButton>
        <AdminButton
          variant="primary"
          size="lg"
          class-name="profile-add-btn"
          :disabled="!table"
          @click="$emit('create')"
        >
          <IconPlus class="mr-2" />
          Agregar
        </AdminButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { IconArrowLeft, IconRefresh, IconPlus, IconHome, IconUser, IconEdit, IconSettings, IconLogin, IconX, IconSearch, IconCheck, IconSitemap, IconLink, IconEye, IconId, IconLock, IconChecks, IconListCheck, IconStack, IconCircleX, IconUserPlus, IconDotsVertical, IconArrowUp, IconArrowDown, IconTrash, IconCertificate, IconInfoCircle } from '@tabler/icons-vue';

const tablerIconMap = {
  'home': IconHome, 'user': IconUser, 'edit': IconEdit, 'cog': IconSettings, 'sign-in-alt': IconLogin,
  'times': IconX, 'search': IconSearch, 'check': IconCheck, 'sitemap': IconSitemap, 'link': IconLink,
  'eye': IconEye, 'plus': IconPlus, 'id-card': IconId, 'lock': IconLock, 'check-double': IconChecks,
  'list-check': IconListCheck, 'rotate-right': IconRefresh, 'backward': IconArrowLeft, 'layer-group': IconStack,
  'times-circle': IconCircleX, 'user-plus': IconUserPlus, 'ellipsis-vertical': IconDotsVertical,
  'arrow-up': IconArrowUp, 'arrow-down': IconArrowDown, 'trash': IconTrash, 'certificate': IconCertificate,
  'info-circle': IconInfoCircle
};

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
