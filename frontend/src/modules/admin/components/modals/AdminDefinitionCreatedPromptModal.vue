<template>
  <AdminModalShell ref="modalRef" labelled-by="definitionArtifactsPromptModalLabel" title="Definicion creada">
    <p class="mb-0 text-sm text-slate-700">
      La definicion se creo correctamente.
      <span v-if="context?.name">
        <strong>{{ context.name }}</strong>.
      </span>
      ¿Deseas agregar reglas o paquetes ahora? Recuerda registrar disparadores antes de activarla.
    </p>
    <template #footer>
      <AdminButton variant="secondary" @click="$emit('close')">Ahora no</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('open-rules')">Agregar reglas</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('open-triggers')">Agregar disparadores</AdminButton>
      <AdminButton variant="primary" @click="$emit('open-artifacts')">Agregar paquetes</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
defineProps({
  context: { type: Object, default: null }
});
defineEmits(["close", "open-rules", "open-triggers", "open-artifacts"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
