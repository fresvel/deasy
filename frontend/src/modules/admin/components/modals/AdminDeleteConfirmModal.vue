<template>
  <AppModalShell ref="modalRef" labelled-by="sqlDeleteModalLabel" title="Eliminar registro">
    <p>Confirma la eliminacion del registro seleccionado.</p>
    <template #footer>
      <AdminButton variant="dangerOutline" data-modal-dismiss>Cancelar</AdminButton>
      <AdminButton variant="dangerOutline" @click="$emit('confirm')">Eliminar</AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
defineEmits(["confirm"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
