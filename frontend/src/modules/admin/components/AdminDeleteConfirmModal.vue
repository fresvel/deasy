<template>
  <AdminModalShell ref="modalRef" labelled-by="sqlDeleteModalLabel" title="Eliminar registro">
    <p>Confirma la eliminacion del registro seleccionado.</p>
    <template #footer>
      <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
      <AdminButton variant="outlineDanger" @click="$emit('confirm')">Eliminar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/ui/AppButton.vue";
import AdminModalShell from "@/shared/components/ui/AppModalShell.vue";
defineEmits(["confirm"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
