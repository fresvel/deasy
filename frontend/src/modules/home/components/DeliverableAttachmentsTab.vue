<template>
<div class="flex flex-col gap-4">
  <section class="deasy-card p-4">
    <div class="flex flex-col gap-2">
      <h3 class="deasy-title deasy-title--section">Anexos del entregable</h3>
      <p class="m-0 text-xs font-medium text-muted">Archivos auxiliares (evidencias, soportes) adicionales al documento principal.</p>
    </div>

    <div class="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4">
      <label class="flex flex-col gap-2">
        <span class="deasy-form-label">Tipo</span>
        <select v-model="attachmentUploadKind" class="deasy-control deasy-control--select">
          <option value="annex">Anexo</option>
          <option value="evidence">Evidencia</option>
          <option value="source">Fuente</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <!-- ⚠️ ES UN `<label>` CON LA RECETA DEL BOTON, Y ESA MEZCLA ES LO QUE LO ESCONDIO.
           Un `<label>` que envuelve un `<input type="file">` oculto es la unica forma de abrir
           el selector de ficheros sin JavaScript, asi que no puede ser un `<button>`… y por eso
           **ningun gate del frente lo vio**: los once de botones miran `<button>` y `AppButton`.
           Se pinto a mano con `rounded-2xl` (16 px, cuando el sistema usa 8) y `px-4 py-2` sin
           altura, que daba ~40 px contra los 44 del sistema. Lo vio el dueño. Ahora lleva las
           clases de la receta: la forma la decide `buttons.css` para este igual que para todos. -->
      <label class="deasy-btn deasy-btn--primary-outline deasy-btn--md cursor-pointer" :class="attachmentsState.uploading ? 'pointer-events-none opacity-60' : ''">
        <IconUpload class="h-4 w-4" />
        <span>{{ attachmentsState.uploading ? 'Subiendo...' : 'Agregar anexo' }}</span>
        <input type="file" class="hidden" :disabled="attachmentsState.uploading" @change="handleAttachmentUpload" />
      </label>
    </div>

    <AppAlert class="mt-3" v-if="attachmentsState.error">{{ attachmentsState.error }}</AppAlert>

    <AppEmpty v-if="attachmentsState.loading" :icon="false" class="mt-4 animate-pulse">Cargando anexos...</AppEmpty>
    <AppEmpty v-else-if="!attachmentsState.items.length" class="mt-4">
      Este entregable todavía no tiene anexos.
    </AppEmpty>
    <ul v-else class="mt-4 flex flex-col gap-2">
      <li
        v-for="attachment in attachmentsState.items"
        :key="`attachment-${attachment.id}`"
        class="deasy-card flex items-center gap-3 px-3 py-2.5"
      >
        <span class="deasy-icon-box deasy-icon-box--md deasy-icon-box--neutral"><IconFileDescription class="h-4.5 w-4.5" /></span>
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate text-sm font-semibold text-strong" :title="attachment.file_name">{{ attachment.file_name }}</p>
          <p class="m-0 mt-0.5 flex items-center gap-2 text-theme-xs font-medium text-muted">
            <span class="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-primary">{{ attachmentKindLabels[attachment.kind] || attachment.kind }}</span>
            <span v-if="formatAttachmentSize(attachment.size_bytes)">{{ formatAttachmentSize(attachment.size_bytes) }}</span>
            <span v-if="attachment.description" class="truncate">· {{ attachment.description }}</span>
          </p>
        </div>
        <AppButton variant="info-soft" icon-only title="Descargar anexo" aria-label="Descargar anexo" @click="handleAttachmentDownload(attachment)"><IconDownload class="h-5 w-5" /></AppButton>
        <AppDeleteButton label="Eliminar anexo" @click="handleAttachmentDelete(attachment)" />
      </li>
    </ul>
  </section>
</div>
</template>

<script setup>
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
// Pestaña ANEXOS del modal de detalle del entregable: subir, listar, descargar y borrar
// archivos auxiliares (evidencias, soportes) del documento principal.
// Extraída de HomeView.vue en la Fase C. Componente PRESENTACIONAL: la lógica sigue en HomeView.
//
// De las 4 pestañas del modal es la de frontera más limpia (7 deps). formatAttachmentSize se
// importa del módulo de helpers, no se recibe.
import AppDeleteButton from "@/shared/components/buttons/AppDeleteButton.vue";
import { IconUpload, IconDownload, IconFileDescription, IconX } from '@tabler/icons-vue';
import { formatAttachmentSize } from '@/modules/home/views/homeView.helpers.js';
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

const attachmentUploadKind = defineModel('attachmentUploadKind', { type: String, default: 'annex' });

defineProps({
  attachmentsState: { type: Object, required: true },
  attachmentKindLabels: { type: Object, required: true },
  handleAttachmentUpload: { type: Function, required: true },
  handleAttachmentDownload: { type: Function, required: true },
  handleAttachmentDelete: { type: Function, required: true },
});
</script>
