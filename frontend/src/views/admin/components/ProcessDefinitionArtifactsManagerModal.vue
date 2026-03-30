<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="definitionArtifactsModalLabel"
    title="Artifacts de la definicion"
    size="xl"
    close-action
    @close="$emit('close')"
  >
    <div v-if="context" class="person-assignment-context mb-3">
      <strong>{{ context.name || `Definicion #${context.id}` }}</strong>
      <span class="text-muted ms-2">
        Serie {{ context.variation_key || "—" }} | Version {{ context.definition_version || "—" }} | Estado {{ context.status || "—" }}
      </span>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="context && !canManage" class="alert alert-info">
      Esta definicion no esta en draft. Solo puedes gestionar artifacts cuando la definicion este en draft.
    </div>
    <div v-else-if="canManage && !canSubmit" class="alert alert-secondary">
      Selecciona un artifact para habilitar el boton de agregar.
    </div>

    <div class="person-assignment-form">
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <label class="form-label text-dark">Artifact</label>
          <AdminLookupField
            :model-value="labels.template_artifact_id"
            placeholder="Selecciona un artifact"
            readonly
            prevent-input-interaction
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.template_artifact_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-artifact')"
            @search="$emit('search-artifact')"
          />
        </div>
        <AdminFieldGroup label="Uso" label-class="text-dark" group-class="col-12 col-md-3">
          <AdminSelectField :model-value="form.usage_role" :disabled="!canManage" @update:model-value="updateField('usage_role', $event)">
            <option value="manual_fill">manual_fill</option>
            <option value="system_render">system_render</option>
            <option value="attachment">attachment</option>
            <option value="support">support</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Orden" label-class="text-dark" group-class="col-12 col-md-3">
          <AdminInputField :model-value="form.sort_order" type="number" min="1" :disabled="!canManage" @update:model-value="updateField('sort_order', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Genera tarea" label-class="text-dark" group-class="col-12 col-md-3">
          <AdminSelectField :model-value="form.creates_task" :disabled="!canManage" @update:model-value="updateField('creates_task', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Requerido" label-class="text-dark" group-class="col-12 col-md-3">
          <AdminSelectField :model-value="form.is_required" :disabled="!canManage" @update:model-value="updateField('is_required', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
      </div>
      <AdminFormActions
        :primary-label="editId ? 'Guardar artifact' : 'Agregar artifact'"
        :primary-disabled="!canSubmit"
        :show-cancel="Boolean(editId)"
        cancel-label="Cancelar edicion"
        @primary="$emit('submit')"
        @cancel="$emit('reset')"
      />
    </div>

    <div v-if="loading" class="text-muted mt-3">Cargando artifacts vinculados...</div>
    <AdminDataTable
      v-else
      class="mt-3 person-assignment-table"
      :fields="tableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin artifacts vinculados."
      table-class="table table-sm table-striped align-middle"
      responsive-class="table-responsive mt-3 person-assignment-table"
      scroll-class=""
    >
      <template #cell="{ row, field }">
        <template v-if="field.name === 'template_artifact_id'">
          {{ formatCell(row.template_artifact_id, { name: "template_artifact_id" }) }}
        </template>
        <template v-else-if="['creates_task', 'is_required'].includes(field.name)">
          {{ Number(row[field.name]) === 1 ? "Si" : "No" }}
        </template>
        <template v-else>
          {{ row[field.name] ?? "—" }}
        </template>
      </template>
      <template #actions="{ row }">
        <AdminTableActions
          edit-tooltip="Editar artifact"
          delete-message="Eliminar artifact"
          @view="$emit('view-row', row)"
          @edit="$emit('edit-row', row)"
          @delete="$emit('delete-row', row)"
        />
      </template>
    </AdminDataTable>
    <template #footer>
      <AdminButton variant="outlineDanger" @click="$emit('close')">Cerrar</AdminButton>
      <AdminButton variant="outlinePrimary" @click="$emit('accept')">Aceptar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminDataTable from "@/views/admin/components/AdminDataTable.vue";
import AdminFieldGroup from "@/views/admin/components/AdminFieldGroup.vue";
import AdminFormActions from "@/views/admin/components/AdminFormActions.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminLookupField from "@/views/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";
import AdminTableActions from "@/views/admin/components/AdminTableActions.vue";

const props = defineProps({
  context: { type: Object, default: null },
  error: { type: String, default: "" },
  canManage: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  form: { type: Object, default: () => ({}) },
  labels: { type: Object, default: () => ({}) },
  editId: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits([
  "update:form",
  "clear-artifact",
  "search-artifact",
  "submit",
  "reset",
  "view-row",
  "edit-row",
  "delete-row",
  "close",
  "accept"
]);
const modalRef = ref(null);

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.form,
    [fieldName]: value
  });
};

defineExpose({
  el: modalRef
});
</script>
