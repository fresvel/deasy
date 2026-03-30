<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="draftArtifactModalLabel"
    :title="draftArtifactEditId ? 'Editar paquete de usuario' : 'Crear paquete de usuario'"
    size="xl"
    dialog-class="modal-dialog-scrollable"
    content-class="border-0 shadow"
    close-action
    @close="$emit('close')"
  >
    <div v-if="draftArtifactError" class="alert alert-danger">{{ draftArtifactError }}</div>
    <div class="alert alert-info">
      Este flujo {{ draftArtifactEditId ? "actualiza" : "crea" }} el paquete de usuario y lo sube directamente a <strong>MinIO</strong>. Solo cuando la carga termine correctamente se guarda el registro en el sistema.
    </div>
    <div v-if="draftArtifactLoading" class="alert alert-warning">
      Subiendo archivos a <strong>MinIO</strong>. Espera a que termine la carga para continuar.
    </div>
    <div class="row g-3">
      <AdminFieldGroup label="Seed LaTeX" label-class="text-dark" group-class="col-12 col-md-6">
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
      <AdminFieldGroup label="Version fuente" label-class="text-dark" group-class="col-12 col-md-6">
        <AdminInputField
          :model-value="draftArtifactForm.source_version"
          placeholder="1.0.0"
          @update:model-value="updateField('source_version', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Nombre del artifact" label-class="text-dark" group-class="col-12 col-md-6">
        <AdminInputField
          :model-value="draftArtifactForm.display_name"
          placeholder="Nombre del artifact"
          @update:model-value="updateField('display_name', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Descripcion" label-class="text-dark" group-class="col-12 col-md-6">
        <AdminInputField
          :model-value="draftArtifactForm.description"
          placeholder="Descripcion breve"
          @update:model-value="updateField('description', $event)"
        />
      </AdminFieldGroup>
      <div class="col-12 col-md-3">
        <label class="form-label text-dark">PDF</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-pdf"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'pdf', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("pdf") }}</span>
        </label>
        <input id="draft-upload-pdf" class="d-none" type="file" accept=".pdf" @change="$emit('file-change', 'pdf', $event)" />
      </div>
      <div class="col-12 col-md-3">
        <label class="form-label text-dark">Word</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-docx"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'docx', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("docx") }}</span>
        </label>
        <input id="draft-upload-docx" class="d-none" type="file" accept=".doc,.docx" @change="$emit('file-change', 'docx', $event)" />
      </div>
      <div class="col-12 col-md-3">
        <label class="form-label text-dark">Excel</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-xlsx"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'xlsx', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("xlsx") }}</span>
        </label>
        <input id="draft-upload-xlsx" class="d-none" type="file" accept=".xls,.xlsx" @change="$emit('file-change', 'xlsx', $event)" />
      </div>
      <div class="col-12 col-md-3">
        <label class="form-label text-dark">PowerPoint</label>
        <label
          class="draft-upload-dropzone"
          for="draft-upload-pptx"
          @dragover.prevent
          @drop.prevent="$emit('drop', 'pptx', $event)"
        >
          <span class="draft-upload-dropzone-title">Arrastra o haz clic</span>
          <span class="draft-upload-dropzone-meta">{{ getDraftArtifactFileLabel("pptx") }}</span>
        </label>
        <input id="draft-upload-pptx" class="d-none" type="file" accept=".ppt,.pptx" @change="$emit('file-change', 'pptx', $event)" />
      </div>
      <div v-if="draftArtifactPreviewUrl" class="col-12">
        <label class="form-label text-dark">Preview del seed</label>
        <iframe
          :src="draftArtifactPreviewUrl"
          class="w-100 border rounded"
          style="min-height: 420px; background: #fff;"
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
import AdminButton from "@/views/admin/components/AdminButton.vue";
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
