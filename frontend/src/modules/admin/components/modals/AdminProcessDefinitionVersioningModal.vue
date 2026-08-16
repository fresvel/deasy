<template>
  <AppModalShell
    ref="modalRef"
    labelled-by="processDefinitionVersioningModalLabel"
    title="Crear nueva version"
    size="xl"
    close-action
    @close="$emit('close')"
  >
    <p class="mb-2">La configuracion activa no puede modificarse directamente en sus campos funcionales.</p>
    <p class="mb-0 text-sm text-muted">Puedes cancelar esta edicion o convertir el formulario actual en una nueva version en borrador.</p>
    <template #footer>
      <AdminButton variant="dangerOutline" @click="$emit('cancel-edit')">Cancelar edicion</AdminButton>
      <AdminButton variant="primary" @click="$emit('promote')">Crear nueva version</AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
defineEmits(["close", "cancel-edit", "promote"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
