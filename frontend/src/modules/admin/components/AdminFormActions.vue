<template>
  <div class="person-assignment-form-actions">
    <AdminButton
      v-if="showPrimary"
      :variant="primaryVariant"
      :disabled="primaryDisabled"
      @click="$emit('primary')"
    >
      {{ primaryLabel }}
    </AdminButton>
    <AdminButton
      v-if="showCancel"
      variant="cancel"
      :disabled="cancelDisabled"
      @click="$emit('cancel')"
    >
      {{ cancelLabel }}
    </AdminButton>
    <slot />
  </div>
</template>

<script setup>
import AdminButton from "@/shared/components/ui/AppButton.vue";

defineProps({
  primaryLabel: {
    type: String,
    default: ""
  },
  primaryVariant: {
    type: String,
    default: "outlinePrimary"
  },
  primaryDisabled: {
    type: Boolean,
    default: false
  },
  showPrimary: {
    type: Boolean,
    default: true
  },
  cancelLabel: {
    type: String,
    default: "Cancelar"
  },
  cancelDisabled: {
    type: Boolean,
    default: false
  },
  showCancel: {
    type: Boolean,
    default: false
  }
});

defineEmits(["primary", "cancel"]);
</script>
