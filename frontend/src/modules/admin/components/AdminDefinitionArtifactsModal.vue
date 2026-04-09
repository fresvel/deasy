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
      <span class="ml-2 text-emerald-700/80">
        Serie {{ context.variation_key || "—" }} | Version {{ context.definition_version || "—" }} | Estado {{ context.status || "—" }}
      </span>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="context && !canManage" class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Esta definicion no esta en draft. Solo puedes gestionar artifacts cuando la definicion este en draft.
    </div>
    <div v-else-if="canManage && !form.template_artifact_id" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Selecciona un artifact para habilitar el boton de agregar.
    </div>

    <div class="person-assignment-form">
      <div class="grid gap-3 md:grid-cols-12">
        <div class="md:col-span-6">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Artifact</label>
          <AdminLookupField
            :model-value="labels.template_artifact_id"
            placeholder="Selecciona un artifact"
            readonly
            prevent-input-interaction
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.template_artifact_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-selection')"
            @search="$emit('open-fk-search')"
          />
        </div>
        <AdminFieldGroup label="Rol" group-class="md:col-span-3">
          <AdminSelectField :model-value="form.usage_role" :disabled="!canManage" @update:model-value="updateField('usage_role', $event)">
            <option value="primary">primary</option>
            <option value="attachment">attachment</option>
            <option value="support">support</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Orden" group-class="md:col-span-3">
          <AdminInputField :model-value="form.sort_order" type="number" min="1" :disabled="!canManage" @update:model-value="updateField('sort_order', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Genera tarea" group-class="md:col-span-3">
          <AdminSelectField :model-value="form.creates_task" :disabled="!canManage" @update:model-value="updateField('creates_task', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Requerido" group-class="md:col-span-3">
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

    <div v-if="loading" class="mt-3 text-sm text-slate-500">Cargando artifacts vinculados...</div>
    <AdminDataTable
      v-else
      class="mt-3 person-assignment-table"
      :fields="tableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin artifacts vinculados."
      table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
      responsive-class="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm person-assignment-table"
      scroll-class=""
    >
      <template #cell="{ row, field }">
        <template v-if="field.name === 'template_artifact_id'">
          {{ formatCell(row.template_artifact_id, { name: 'template_artifact_id' }) }}
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
import AdminButton from "@/shared/components/ui/AppButton.vue";
import AdminDataTable from "@/shared/components/ui/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/AdminFieldGroup.vue";
import AdminFormActions from "@/modules/admin/components/AdminFormActions.vue";
import AdminInputField from "@/modules/admin/components/AdminInputField.vue";
import AdminLookupField from "@/modules/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/shared/components/ui/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/AdminTableActions.vue";

const props = defineProps({
  context: { type: Object, default: null },
  error: { type: String, default: "" },
  canManage: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  labels: { type: Object, default: () => ({}) },
  form: { type: Object, default: () => ({}) },
  editId: { type: [String, Number], default: "" },
  loading: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits(["update:form", "clear-selection", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row", "close", "accept"]);
const modalRef = ref(null);

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.form,
    [fieldName]: value
  });
};

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
