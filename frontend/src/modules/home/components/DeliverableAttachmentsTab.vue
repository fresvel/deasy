<template>
<div class="flex flex-col gap-4">
  <section class="rounded-2xl border border-line bg-white p-4">
    <div class="flex flex-col gap-1">
      <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-body">Anexos del entregable</h3>
      <p class="m-0 text-xs font-medium text-muted">Archivos auxiliares (evidencias, soportes) adicionales al documento principal.</p>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4">
      <label class="flex flex-col gap-1">
        <span class="deasy-eyebrow">Tipo</span>
        <select v-model="attachmentUploadKind" class="rounded-2xl border border-line bg-white px-3 py-2 text-sm font-medium text-body outline-none">
          <option value="annex">Anexo</option>
          <option value="evidence">Evidencia</option>
          <option value="source">Fuente</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label class="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-brand-50" :class="attachmentsState.uploading ? 'pointer-events-none opacity-60' : ''">
        <IconUpload class="h-4 w-4" />
        <span>{{ attachmentsState.uploading ? 'Subiendo...' : 'Agregar anexo' }}</span>
        <input type="file" class="hidden" :disabled="attachmentsState.uploading" @change="handleAttachmentUpload" />
      </label>
    </div>

    <div v-if="attachmentsState.error" class="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">{{ attachmentsState.error }}</div>

    <div v-if="attachmentsState.loading" class="mt-4 rounded-2xl border border-dashed border-line bg-surface p-5 text-sm font-medium text-muted text-center animate-pulse">Cargando anexos...</div>
    <div v-else-if="!attachmentsState.items.length" class="mt-4 rounded-2xl border border-dashed border-line bg-surface p-5 text-sm font-medium text-muted text-center">
      Este entregable todavía no tiene anexos.
    </div>
    <ul v-else class="mt-4 flex flex-col gap-2">
      <li
        v-for="attachment in attachmentsState.items"
        :key="`attachment-${attachment.id}`"
        class="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5"
      >
        <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface text-muted"><IconFileDescription class="h-4.5 w-4.5" /></span>
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate text-sm font-semibold text-strong" :title="attachment.file_name">{{ attachment.file_name }}</p>
          <p class="m-0 mt-0.5 flex items-center gap-2 text-[0.7rem] font-medium text-muted">
            <span class="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-primary">{{ attachmentKindLabels[attachment.kind] || attachment.kind }}</span>
            <span v-if="formatAttachmentSize(attachment.size_bytes)">{{ formatAttachmentSize(attachment.size_bytes) }}</span>
            <span v-if="attachment.description" class="truncate">· {{ attachment.description }}</span>
          </p>
        </div>
        <AppButton variant="plain" class-name="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-white text-info transition hover:border-blue-light-300 hover:bg-blue-light-50" aria-label="Descargar anexo" @click="handleAttachmentDownload(attachment)"><IconDownload class="h-4.5 w-4.5" /></AppButton>
        <AppButton variant="plain" class-name="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar anexo" @click="handleAttachmentDelete(attachment)"><IconX class="h-4.5 w-4.5" /></AppButton>
      </li>
    </ul>
  </section>
</div>
</template>

<script setup>
// Pestaña ANEXOS del modal de detalle del entregable: subir, listar, descargar y borrar
// archivos auxiliares (evidencias, soportes) del documento principal.
// Extraída de HomeView.vue en la Fase C. Componente PRESENTACIONAL: la lógica sigue en HomeView.
//
// De las 4 pestañas del modal es la de frontera más limpia (7 deps). formatAttachmentSize se
// importa del módulo de helpers, no se recibe.
import { IconUpload, IconDownload, IconFileDescription, IconX } from '@tabler/icons-vue';
import { formatAttachmentSize } from '@/modules/home/views/homeView.helpers.js';

const attachmentUploadKind = defineModel('attachmentUploadKind', { type: String, default: 'annex' });

defineProps({
  attachmentsState: { type: Object, required: true },
  attachmentKindLabels: { type: Object, required: true },
  handleAttachmentUpload: { type: Function, required: true },
  handleAttachmentDownload: { type: Function, required: true },
  handleAttachmentDelete: { type: Function, required: true },
});
</script>
