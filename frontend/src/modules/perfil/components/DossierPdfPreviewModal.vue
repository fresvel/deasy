<template>
  <AppModalShell
    ref="modalRef"
    title="Vista previa del PDF"
    labelled-by="dossier-pdf-preview-modal-title"
    size="xl"
    dialog-class="items-center"
    content-class="deasy-dialog-panel--plain"
    body-class="p-0"
  >
    <div class="pdf-preview-shell">
      <div v-if="pdfUrl" class="pdf-preview-frame">
        <iframe :src="pdfUrl" title="Vista previa del PDF" class="pdf-preview-iframe"></iframe>
      </div>
      <div v-else class="pdf-preview-empty">
        No hay PDF disponible para visualizar.
      </div>
    </div>
  </AppModalShell>
</template>

<script setup>
import { onBeforeUnmount, ref } from "vue";
import { Modal } from "@/shared/utils/modalController";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

const modalRef = ref(null);
const pdfUrl = ref("");
let modalInstance = null;

const revokePdfUrl = () => {
  if (pdfUrl.value) {
    window.URL.revokeObjectURL(pdfUrl.value);
    pdfUrl.value = "";
  }
};

const ensureModalInstance = () => {
  const element = modalRef.value?.el;
  if (!element) return null;
  if (!modalInstance) {
    modalInstance = Modal.getOrCreateInstance(element);
    element.addEventListener("hidden.bs.modal", revokePdfUrl);
  }
  return modalInstance;
};

const openFromBlob = (blob) => {
  revokePdfUrl();
  pdfUrl.value = window.URL.createObjectURL(blob);
  ensureModalInstance()?.show();
};

onBeforeUnmount(() => {
  revokePdfUrl();
  if (modalInstance) {
    modalInstance.hide();
    modalInstance.dispose();
    modalInstance = null;
  }
});

defineExpose({
  openFromBlob
});
</script>
