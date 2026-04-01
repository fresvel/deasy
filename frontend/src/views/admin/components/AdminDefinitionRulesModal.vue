<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="definitionRulesModalLabel"
    title="Reglas de la definicion"
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
      Esta definicion no esta en draft. Solo puedes gestionar reglas cuando la definicion este en draft.
    </div>
    <div v-else-if="canManage && !canSubmit" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      Completa el alcance requerido para habilitar el boton de guardar.
    </div>

    <div class="person-assignment-form">
      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Alcance" group-class="md:col-span-3">
          <AdminSelectField
            :model-value="form.unit_scope_type"
            :disabled="!canManage"
            @update:model-value="updateField('unit_scope_type', $event)"
            @change="$emit('scope-change')"
          >
            <option value="unit_exact">unit_exact</option>
            <option value="unit_subtree">unit_subtree</option>
            <option value="unit_type">unit_type</option>
            <option value="all_units">all_units</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <div class="md:col-span-3">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Unidad</label>
          <AdminLookupField
            :model-value="labels.unit_id"
            placeholder="Selecciona una unidad"
            readonly
            prevent-input-interaction
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.unit_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-field', 'unit_id')"
            @search="$emit('open-fk-search', 'unit_id')"
          />
        </div>
        <div class="md:col-span-3">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Tipo de unidad</label>
          <AdminLookupField
            :model-value="labels.unit_type_id"
            placeholder="Selecciona un tipo"
            readonly
            prevent-input-interaction
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.unit_type_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-field', 'unit_type_id')"
            @search="$emit('open-fk-search', 'unit_type_id')"
          />
        </div>
        <div class="md:col-span-3">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Cargo</label>
          <AdminLookupField
            :model-value="labels.cargo_id"
            placeholder="Selecciona un cargo"
            readonly
            prevent-input-interaction
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.cargo_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-field', 'cargo_id')"
            @search="$emit('open-fk-search', 'cargo_id')"
          />
        </div>
        <div class="md:col-span-4">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Puesto exacto</label>
          <AdminLookupField
            :model-value="labels.position_id"
            placeholder="Selecciona un puesto"
            readonly
            prevent-input-interaction
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.position_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-field', 'position_id')"
            @search="$emit('open-fk-search', 'position_id')"
          />
        </div>
        <AdminFieldGroup label="Entrega" group-class="md:col-span-3">
          <AdminSelectField :model-value="form.recipient_policy" :disabled="!canManage" @update:model-value="updateField('recipient_policy', $event)">
            <option value="all_matches">all_matches</option>
            <option value="one_per_unit">one_per_unit</option>
            <option value="one_match_only">one_match_only</option>
            <option value="exact_position">exact_position</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Prioridad" group-class="md:col-span-2">
          <AdminInputField :model-value="form.priority" type="number" min="1" :disabled="!canManage" @update:model-value="updateField('priority', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Activo" group-class="md:col-span-3">
          <AdminSelectField :model-value="form.is_active" :disabled="!canManage" @update:model-value="updateField('is_active', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Incluye descendientes" group-class="md:col-span-3">
          <AdminSelectField :model-value="form.include_descendants" :disabled="!canManage" @update:model-value="updateField('include_descendants', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Vigencia desde" group-class="md:col-span-3">
          <AdminInputField :model-value="form.effective_from" type="date" :disabled="!canManage" @update:model-value="updateField('effective_from', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Vigencia hasta" group-class="md:col-span-3">
          <AdminInputField :model-value="form.effective_to" type="date" :disabled="!canManage" @update:model-value="updateField('effective_to', $event)" />
        </AdminFieldGroup>
      </div>
      <AdminFormActions
        :primary-label="editId ? 'Guardar regla' : 'Agregar regla'"
        :primary-disabled="!canSubmit"
        :show-cancel="Boolean(editId)"
        cancel-label="Cancelar edicion"
        @primary="$emit('submit')"
        @cancel="$emit('reset')"
      />
    </div>

    <div v-if="loading" class="mt-3 text-sm text-slate-500">Cargando reglas vinculadas...</div>
    <AdminDataTable
      v-else
      :fields="tableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin reglas vinculadas."
      table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
      responsive-class="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm person-assignment-table"
      scroll-class=""
    >
      <template #cell="{ row, field }">
        <template v-if="field.name === 'is_active'">
          {{ Number(row.is_active) === 1 ? "Si" : "No" }}
        </template>
        <template v-else>
          {{ formatCell(row, field.name) }}
        </template>
      </template>
      <template #actions="{ row }">
        <AdminTableActions
          edit-tooltip="Editar regla"
          delete-message="Eliminar regla"
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
import AdminButton from "@/components/AppButton.vue";
import AdminDataTable from "@/components/AppDataTable.vue";
import AdminFieldGroup from "@/views/admin/components/AdminFieldGroup.vue";
import AdminFormActions from "@/views/admin/components/AdminFormActions.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminLookupField from "@/views/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/components/AppModalShell.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";
import AdminTableActions from "@/views/admin/components/AdminTableActions.vue";

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

const emit = defineEmits(["update:form", "scope-change", "clear-field", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row", "close", "accept"]);
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
