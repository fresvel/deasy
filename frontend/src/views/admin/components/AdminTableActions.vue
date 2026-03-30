<template>
  <div class="d-inline-flex align-items-center gap-1">
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
      <font-awesome-icon icon="eye" />
    </AdminButton>
    <slot name="between" />
    <slot name="edit">
      <BtnEdit
        v-if="showEdit"
        :tooltip="editTooltip"
        @onpress="$emit('edit')"
      />
    </slot>
    <slot name="append" />
    <BtnDelete
      v-if="showDelete"
      :message="deleteMessage"
      @onpress="$emit('delete')"
    />
  </div>
</template>

<script setup>
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";

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
