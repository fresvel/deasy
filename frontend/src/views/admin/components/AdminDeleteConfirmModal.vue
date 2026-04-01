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
import AdminButton from "@/components/AppButton.vue";
import AdminModalShell from "@/components/AppModalShell.vue";
defineEmits(["confirm"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
