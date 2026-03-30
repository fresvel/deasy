<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="processDefinitionVersioningModalLabel"
    title="Crear nueva version"
    size="xl"
    close-action
    @close="$emit('close')"
  >
    <p class="mb-2">La definicion activa no puede modificarse directamente en sus campos funcionales.</p>
    <p class="mb-0 text-muted">Puedes cancelar esta edicion o convertir el formulario actual en una nueva version en borrador.</p>
    <template #footer>
      <AdminButton variant="cancel" @click="$emit('cancel-edit')">Cancelar edicion</AdminButton>
      <AdminButton variant="primary" @click="$emit('promote')">Crear nueva version</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
defineEmits(["close", "cancel-edit", "promote"]);
const modalRef = ref(null);
defineExpose({ el: modalRef });
</script>
