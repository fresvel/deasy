<template>
  <AppModalShell
    controlled
    :open="open"
    labelled-by="dossierDocumentUploadModalLabel"
    title="Subir documento de respaldo"
    size="md"
    content-class="profile-admin-skin"
    @close="$emit('close')"
  >
    <div class="space-y-4">
      <p class="text-sm font-medium text-slate-500">
        Selecciona un archivo PDF para asociarlo al registro.
      </p>
      <PdfDropField
        title="Documento PDF"
        action-text="Seleccionar o arrastrar PDF"
        help-text="Máximo 10 MB"
        :selected-file="selectedFile"
        @files-selected="$emit('files-selected', $event)"
        @clear="$emit('clear')"
      />
    </div>
    <template #footer>
      <AppButton variant="secondary" :disabled="isSubmitting" @click="$emit('close')">
        Cancelar
      </AppButton>
      <AppButton variant="primary" :disabled="!selectedFile || isSubmitting" @click="$emit('submit')">
        {{ isSubmitting ? "Subiendo..." : "Subir documento" }}
      </AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import AppButton from "@/components/AppButton.vue";
import AppModalShell from "@/components/AppModalShell.vue";
import PdfDropField from "@/components/firmas/PdfDropField.vue";

defineProps({
  open: {
    type: Boolean,
    default: false
  },
  selectedFile: {
    type: Object,
    default: null
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
});

defineEmits(["close", "files-selected", "clear", "submit"]);
</script>
