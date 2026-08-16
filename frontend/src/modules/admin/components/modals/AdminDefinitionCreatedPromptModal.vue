<template>
  <AppModalShell ref="modalRef" labelled-by="definitionArtifactsPromptModalLabel" title="Configuracion creada">
    <p class="mb-0 text-sm text-body">
      La configuracion se creo correctamente.
      <span v-if="context?.name">
        <strong>{{ context.name }}</strong>.
      </span>
      ¿Deseas agregar reglas o paquetes ahora? Recuerda registrar periodos del proceso antes de activarla.
    </p>
    <template #footer>
      <AdminButton variant="neutral-outline" @click="$emit('close')">Ahora no</AdminButton>
      <AdminButton variant="primary-outline" @click="$emit('open-rules')">Alcance</AdminButton>
      <AdminButton variant="primary-outline" @click="$emit('open-triggers')">Periodos</AdminButton>
      <AdminButton variant="primary-outline" @click="$emit('open-artifacts')">Paquetes</AdminButton>
      <AdminButton variant="primary-outline" @click="$emit('open-wizard')">Continuar guiado →</AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
defineProps({
  context: { type: Object, default: null }
});
defineEmits(["close", "open-rules", "open-triggers", "open-artifacts", "open-wizard"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
