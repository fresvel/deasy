<template>
  <div class="inline-flex items-center gap-1">
    <slot name="prepend" />
    <AdminButton
      v-if="showView"
      variant="secondary"
      size="sm"
      icon-only
      class-name="hope-action-btn hope-action-view"
      :title="viewTitle"
      :aria-label="viewLabel"
      @click="$emit('view')"
    >
      <IconEye />
    </AdminButton>
    <slot name="between" />
    <slot name="edit">
      <AdminButton
        v-if="showEdit"
        variant="secondary"
        size="sm"
        icon-only
        class-name="hope-action-btn hope-action-edit"
        :title="editTooltip"
        :aria-label="editTooltip"
        @click="$emit('edit')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11.4925 2.78906H7.75349C4.67849 2.78906 2.75049 4.96606 2.75049 8.04806V16.3621C2.75049 19.4441 4.66949 21.6211 7.75349 21.6211H16.5775C19.6625 21.6211 21.5815 19.4441 21.5815 16.3621V12.3341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path fill-rule="evenodd" clip-rule="evenodd" d="M8.82812 10.921L16.3011 3.44799C17.2321 2.51799 18.7411 2.51799 19.6721 3.44799L20.8891 4.66499C21.8201 5.59599 21.8201 7.10599 20.8891 8.03599L13.3801 15.545C12.9731 15.952 12.4211 16.181 11.8451 16.181H8.09912L8.19312 12.401C8.20712 11.845 8.43412 11.315 8.82812 10.921Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M15.1655 4.60254L19.7315 9.16854" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </AdminButton>
    </slot>
    <slot name="append" />
    <AdminButton
      v-if="showDelete"
      variant="secondary"
      size="sm"
      icon-only
      class-name="hope-action-btn hope-action-delete"
      :title="deleteMessage"
      :aria-label="deleteMessage"
      @click="$emit('delete')"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19.3248 9.46826S18.7848 16.1853 18.4678 19.0473C18.3168 20.4113 17.4748 21.2113 16.0858 21.2373C13.4408 21.2843 10.7928 21.2873 8.1498 21.2323C6.8138 21.2053 5.9778 20.3953 5.8288 19.0473C5.5108 16.1603 4.9728 9.46826 4.9728 9.46826" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M20.708 6.23975H3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M17.4406 6.23975C16.6556 6.23975 15.9806 5.68475 15.8266 4.91675L15.5836 3.69975C15.4336 3.13775 14.9246 2.75 14.3466 2.75H10.1126C9.53457 2.75 9.02557 3.13775 8.87557 3.69975L8.63257 4.91675C8.47857 5.68475 7.80357 6.23975 7.01857 6.23975" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </AdminButton>
  </div>
</template>

<script setup>
import { IconEye } from '@tabler/icons-vue';

import AdminButton from "@/shared/components/buttons/AppButton.vue";

defineProps({
  showView: {
    type: Boolean,
    default: true
  },
  showEdit: {
    type: Boolean,
    default: true
  },
  showDelete: {
    type: Boolean,
    default: true
  },
  viewTitle: {
    type: String,
    default: "Visualizar"
  },
  viewLabel: {
    type: String,
    default: "Visualizar"
  },
  editTooltip: {
    type: String,
    default: "Editar"
  },
  deleteMessage: {
    type: String,
    default: "Eliminar"
  }
});

defineEmits(["view", "edit", "delete"]);
</script>
