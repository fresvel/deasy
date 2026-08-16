<template>
  <AppModalShell
    ref="shellRef"
    labelled-by="deliverable-preview-modal-title"
    :title="name || 'Vista previa del archivo'"
    size="xl"
    content-class="shadow border-0"
    body-class="pt-4"
  >
    <div class="min-h-[60vh]">
      <iframe
        v-if="url && isPdf"
        :src="url"
        class="w-full min-h-[70vh] deasy-card"
        title="Vista previa del archivo"
      />
      <div v-else class="rounded-2xl border border-line bg-surface p-6 text-sm text-icon">
        El archivo no se puede previsualizar en línea. Usa la opción de descarga.
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <!-- Panel de acciones del entregable. Lo inyecta quien tenga el flujo de llenado a mano; el
             centro documental no lo pasa, y entonces el modal es solo vista previa + descarga. -->
        <slot name="actions" />

        <div class="flex flex-wrap items-center justify-end gap-3">
          <AppButton variant="neutral" data-modal-dismiss>
            Cerrar
          </AppButton>
          <AppButton variant="primary" @click="emit('download')">
            Descargar archivo
          </AppButton>
        </div>
      </div>
    </template>
  </AppModalShell>
</template>

<script setup>
/**
 * Vista previa de un fichero de entregable.
 *
 * Vivia dentro de HomeView. Su pie NO era solo "cerrar/descargar": traia el panel de acciones del flujo
 * de llenado (aprobar, devolver, rechazar, reemplazar), que depende de useDeliverableView. Por eso el
 * panel entra por el slot #actions en vez de estar aqui dentro: quien lo tenga lo pasa, y quien no
 * --el centro documental-- obtiene la vista previa a secas.
 *
 * Que ese slot es la costura correcta no es una suposicion: se comprobo en el navegador. Las filas del
 * centro documental no llevan `actions` ni `workflow`, los cuatro predicados dependen de esos campos, y
 * al abrir la vista previa desde ahi el panel ya NO se pintaba. Este componente conserva ese
 * comportamiento por construccion en vez de por casualidad.
 */
import { ref } from "vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";

defineProps({
  /** Nombre del fichero; encabeza el modal. */
  name: { type: String, default: "" },
  /** Object URL del blob ya descargado. */
  url: { type: String, default: "" },
  /** Si no es PDF se muestra el aviso de "descarga esto" en vez del visor. */
  isPdf: { type: Boolean, default: false }
});

const emit = defineEmits(["download"]);

// Se reenvia el mismo contrato que AppModalShell (`el` por getter): quien monte este componente gobierna
// el modal con Modal.getOrCreateInstance(ref.value.el), sin enterarse de que hay un wrapper en medio.
const shellRef = ref(null);
defineExpose({
  get el() {
    return shellRef.value?.el ?? null;
  }
});
</script>
