<template>
  <AdminModalShell
    ref="shellRef"
    :labelled-by="labelledBy"
    :title="title"
    :size="size"
    :dialog-class="dialogClass"
    :content-class="contentClass"
    :body-class="bodyClass"
    :footer-class="footerClass"
  >
    <slot />
    <template #footer>
      <AdminButton variant="cancel" data-modal-dismiss>
        Cancelar
      </AdminButton>
      <AdminButton variant="outlinePrimary" :disabled="clearDisabled" @click="$emit('clear')">
        Limpiar
      </AdminButton>
      <AdminButton
        variant="primary"
        :title="searchTitle"
        :aria-label="searchAriaLabel"
        :disabled="searchDisabled"
        @click="$emit('search')"
      >
        <font-awesome-icon icon="search" />
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/ui/AppButton.vue";
import AdminModalShell from "@/shared/components/ui/AppModalShell.vue";

defineProps({
  title: {
    type: String,
    required: true
  },
  labelledBy: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: "md"
  },
  dialogClass: {
    type: [String, Array, Object],
    default: ""
  },
  contentClass: {
    type: [String, Array, Object],
    default: ""
  },
  bodyClass: {
    type: [String, Array, Object],
    default: ""
  },
  footerClass: {
    type: [String, Array, Object],
    default: ""
  },
  clearDisabled: {
    type: Boolean,
    default: false
  },
  searchDisabled: {
    type: Boolean,
    default: false
  },
  searchTitle: {
    type: String,
    default: "Buscar"
  },
  searchAriaLabel: {
    type: String,
    default: "Buscar"
  }
});

defineEmits(["clear", "search"]);

const shellRef = ref(null);
const exposedElement = computed(() => shellRef.value?.el || shellRef.value);

defineExpose({
  el: exposedElement
});
</script>
