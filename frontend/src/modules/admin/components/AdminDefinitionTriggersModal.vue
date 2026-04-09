<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="definitionTriggersModalLabel"
    title="Disparadores de la definicion"
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
      Esta definicion no esta en draft. Solo puedes gestionar disparadores cuando la definicion este en draft.
    </div>

    <div class="person-assignment-form">
      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Modo de disparo" group-class="md:col-span-4">
          <AdminSelectField
            :model-value="form.trigger_mode"
            :disabled="!canManage"
            @update:model-value="updateField('trigger_mode', $event)"
            @change="$emit('trigger-mode-change')"
          >
            <option value="automatic_by_term_type">automatic_by_term_type</option>
            <option value="manual_only">manual_only</option>
            <option value="manual_custom_term">manual_custom_term</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <div class="md:col-span-4">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Tipo de periodo</label>
          <AdminLookupField
            :model-value="labels.term_type_id"
            placeholder="Selecciona un tipo"
            readonly
            prevent-input-interaction
            :disabled="!canManage || !requiresTermType"
            :clear-disabled="!canManage || !form.term_type_id || !requiresTermType"
            :search-disabled="!canManage || !requiresTermType"
            @clear="$emit('clear-term-type')"
            @search="$emit('open-fk-search')"
          />
        </div>
        <AdminFieldGroup label="Activo" group-class="md:col-span-4">
          <AdminSelectField :model-value="form.is_active" :disabled="!canManage" @update:model-value="updateField('is_active', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
      </div>
      <AdminFormActions
        :primary-label="editId ? 'Guardar disparador' : 'Agregar disparador'"
        :primary-disabled="!canSubmit"
        :show-cancel="Boolean(editId)"
        cancel-label="Cancelar edicion"
        @primary="$emit('submit')"
        @cancel="$emit('reset')"
      />
    </div>

    <div v-if="loading" class="mt-3 text-sm text-slate-500">Cargando disparadores vinculados...</div>
    <AdminDataTable
      v-else
      :fields="tableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin disparadores vinculados."
      table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
      responsive-class="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm person-assignment-table"
      scroll-class=""
    >
      <template #cell="{ row, field }">
        <template v-if="field.name === 'term_type_id'">
          {{ formatCell(row.term_type_id, { name: 'term_type_id' }) }}
        </template>
        <template v-else-if="field.name === 'is_active'">
          {{ Number(row.is_active) === 1 ? "Si" : "No" }}
        </template>
        <template v-else>
          {{ row[field.name] ?? "—" }}
        </template>
      </template>
      <template #actions="{ row }">
        <AdminTableActions
          edit-tooltip="Editar disparador"
          delete-message="Eliminar disparador"
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
import AdminLookupField from "@/modules/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/shared/components/ui/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/AdminTableActions.vue";

const props = defineProps({
  context: { type: Object, default: null },
  error: { type: String, default: "" },
  canManage: { type: Boolean, default: false },
  canSubmit: { type: Boolean, default: false },
  requiresTermType: { type: Boolean, default: false },
  labels: { type: Object, default: () => ({}) },
  form: { type: Object, default: () => ({}) },
  editId: { type: [String, Number], default: "" },
  loading: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  tableFields: { type: Array, default: () => [] },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits(["update:form", "trigger-mode-change", "clear-term-type", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row", "close", "accept"]);
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
