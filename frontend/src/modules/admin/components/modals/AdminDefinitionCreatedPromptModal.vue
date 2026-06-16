<template>
  <AdminModalShell ref="modalRef" labelled-by="definitionArtifactsPromptModalLabel" title="Configuracion creada">
    <p class="mb-0 text-sm text-slate-700">
      La configuracion se creo correctamente.
      <span v-if="context?.name">
        <strong>{{ context.name }}</strong>.
      </span>
      ¿Deseas agregar reglas o paquetes ahora? Recuerda registrar periodos del proceso antes de activarla.
    </p>
    <template #footer>
      <AdminButton variant="secondary" @click="$emit('close')">Ahora no</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('open-rules')">Reglas</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('open-triggers')">Periodos</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('open-artifacts')">Paquetes</AdminButton>
      <AdminButton variant="primary" @click="$emit('open-wizard')">Continuar guiado →</AdminButton>
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
defineEmits(["close", "open-rules", "open-triggers", "open-artifacts", "open-wizard"]);
const modalRef = ref(null);
defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
