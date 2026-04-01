<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="draftArtifactModalLabel"
    :title="draftArtifactEditId ? 'Editar paquete de usuario' : 'Crear paquete de usuario'"
    size="xl"
    dialog-class="max-w-7xl"
    content-class="border-0 shadow"
    close-action
    @close="$emit('close')"
  >
    <div v-if="draftArtifactError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ draftArtifactError }}</div>
    <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Este flujo {{ draftArtifactEditId ? "actualiza" : "crea" }} el paquete de usuario y lo sube directamente a <strong>MinIO</strong>. Solo cuando la carga termine correctamente se guarda el registro en el sistema.
    </div>
    <div v-if="draftArtifactLoading" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Subiendo archivos a <strong>MinIO</strong>. Espera a que termine la carga para continuar.
    </div>
    <div class="grid gap-3 md:grid-cols-12">
      <AdminFieldGroup label="Seed LaTeX" group-class="md:col-span-6">
        <AdminSelectField
          :model-value="draftArtifactForm.template_seed_id"
          @update:model-value="updateField('template_seed_id', $event)"
        >
          <option value="">Sin seed</option>
          <option
            v-for="row in draftArtifactSeedOptions"
            :key="row.id"
            :value="String(row.id)"
          >
            {{ row.display_name }}
          </option>
        </AdminSelectField>
      </AdminFieldGroup>
      <AdminFieldGroup label="Version fuente" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.source_version"
          placeholder="1.0.0"
          @update:model-value="updateField('source_version', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Nombre del artifact" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.display_name"
          placeholder="Nombre del artifact"
          @update:model-value="updateField('display_name', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Descripcion" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.description"
          placeholder="Descripcion breve"
          @update:model-value="updateField('description', $event)"
        />
      </AdminFieldGroup>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">PDF</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-pdf"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'pdf', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("pdf") }}</span>
        </label>
        <input id="draft-upload-pdf" class="hidden" type="file" accept=".pdf" @change="$emit('file-change', 'pdf', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Word</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-docx"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'docx', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("docx") }}</span>
        </label>
        <input id="draft-upload-docx" class="hidden" type="file" accept=".doc,.docx" @change="$emit('file-change', 'docx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Excel</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-xlsx"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'xlsx', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("xlsx") }}</span>
        </label>
        <input id="draft-upload-xlsx" class="hidden" type="file" accept=".xls,.xlsx" @change="$emit('file-change', 'xlsx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">PowerPoint</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-pptx"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'pptx', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("pptx") }}</span>
        </label>
        <input id="draft-upload-pptx" class="hidden" type="file" accept=".ppt,.pptx" @change="$emit('file-change', 'pptx', $event)" />
      </div>
      <div v-if="draftArtifactPreviewUrl" class="md:col-span-12">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Preview del seed</label>
        <iframe
          :src="draftArtifactPreviewUrl"
          class="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"
          title="Preview del seed"
        ></iframe>
      </div>
    </div>
    <template #footer>
      <AdminButton variant="cancel" @click="$emit('close')">
        Cancelar
      </AdminButton>
      <AdminButton
        variant="outlinePrimary"
        :disabled="draftArtifactLoading"
        @click="$emit('submit')"
      >
        {{ draftArtifactLoading ? "Subiendo a MinIO..." : (draftArtifactEditId ? "Guardar cambios" : "Crear artifact") }}
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/components/AppButton.vue";
import AdminFieldGroup from "@/views/admin/components/AdminFieldGroup.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";

const props = defineProps({
  draftArtifactEditId: {
    type: String,
    default: ""
  },
  draftArtifactError: {
    type: String,
    default: ""
  },
  draftArtifactLoading: {
    type: Boolean,
    default: false
  },
  draftArtifactForm: {
    type: Object,
    default: () => ({})
  },
  draftArtifactSeedOptions: {
    type: Array,
    default: () => []
  },
  draftArtifactPreviewUrl: {
    type: String,
    default: ""
  },
  getDraftArtifactFileLabel: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(["update:form", "file-change", "drop", "close", "submit"]);
const modalRef = ref(null);

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.draftArtifactForm,
    [fieldName]: value
  });
};

defineExpose({
  el: modalRef
});
</script>
