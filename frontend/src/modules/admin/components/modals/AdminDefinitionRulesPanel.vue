<template>
  <div>
    <div v-if="context" class="person-assignment-context mb-3">
      <strong>{{ context.name || `Configuracion #${context.id}` }}</strong>
      <span class="ml-2 text-emerald-700/80">
        Serie {{ context.variation_key || "—" }} | Version {{ context.definition_version || "—" }} | Estado {{ context.status || "—" }}
      </span>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="context && !canManage" class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Esta configuracion no esta en draft. Solo puedes gestionar reglas cuando la configuracion este en draft.
    </div>
    <div v-else-if="canManage && !canSubmit" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      {{ requirementMessage || "Completa el alcance requerido para habilitar el boton de guardar." }}
    </div>
    <div v-if="canManage" class="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      {{ ruleContextHint }}
    </div>

    <div class="person-assignment-form">
      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Alcance" group-class="md:col-span-3">
          <AdminSelectField
            :model-value="form.unit_scope_type"
            :disabled="!canManage"
            @update:model-value="updateScopeType"
          >
            <option v-for="option in scopeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Entrega" group-class="md:col-span-4">
          <AdminSelectField :model-value="form.recipient_policy" :disabled="!canManage" @update:model-value="updateRecipientPolicy">
            <option v-for="option in recipientPolicyOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
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
        <div v-if="showUnitField" class="md:col-span-4">
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
        <div v-if="showUnitTypeField" class="md:col-span-4">
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
        <div v-if="showCargoField" class="md:col-span-4">
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
        <div v-if="showPositionField" class="md:col-span-4">
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
        <AdminFieldGroup v-if="showDescendantsField" label="Incluye descendientes" group-class="md:col-span-4">
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
          :show-edit="canManage"
          :show-delete="canManage"
          @view="$emit('view-row', row)"
          @edit="$emit('edit-row', row)"
          @delete="$emit('delete-row', row)"
        />
      </template>
    </AdminDataTable>
  </div>
</template>

<script setup>
import { computed } from "vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/modules/admin/components/forms/AdminFormActions.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

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

const emit = defineEmits([
  "update:form",
  "scope-change",
  "recipient-policy-change",
  "clear-field",
  "open-fk-search",
  "submit",
  "reset",
  "view-row",
  "edit-row",
  "delete-row"
]);

const scopeOptions = [
  { value: "unit_exact", label: "Unidad exacta" },
  { value: "unit_subtree", label: "Unidad y descendientes" },
  { value: "unit_type", label: "Tipo de unidad" },
  { value: "all_units", label: "Todas las unidades" }
];

const recipientPolicyOptions = [
  { value: "all_matches", label: "Todos los puestos coincidentes" },
  { value: "one_per_unit", label: "Un puesto por unidad" },
  { value: "one_match_only", label: "Solo el primer puesto" },
  { value: "exact_position", label: "Puesto exacto" }
];

const scopeType = computed(() => String(props.form.unit_scope_type || "unit_exact"));
const recipientPolicy = computed(() => String(props.form.recipient_policy || "all_matches"));
const isExactPositionPolicy = computed(() => recipientPolicy.value === "exact_position");
const showUnitField = computed(() =>
  isExactPositionPolicy.value || scopeType.value === "unit_exact" || scopeType.value === "unit_subtree"
);
const showUnitTypeField = computed(() => !isExactPositionPolicy.value && scopeType.value === "unit_type");
const showCargoField = computed(() => !isExactPositionPolicy.value);
const showPositionField = computed(() => isExactPositionPolicy.value);
const showDescendantsField = computed(() => !isExactPositionPolicy.value && scopeType.value === "unit_exact");

const requirementMessage = computed(() => {
  if (!props.canManage || props.canSubmit) {
    return "";
  }
  if (isExactPositionPolicy.value) {
    return "Selecciona un puesto exacto para guardar la regla.";
  }
  if (scopeType.value === "unit_type") {
    return "Selecciona el tipo de unidad para guardar la regla.";
  }
  if (scopeType.value === "unit_exact" || scopeType.value === "unit_subtree") {
    return "Selecciona la unidad base para guardar la regla.";
  }
  return "Completa el alcance requerido para habilitar el boton de guardar.";
});

const ruleContextHint = computed(() => {
  if (isExactPositionPolicy.value) {
    return "La regla se limitara a un unico puesto; el alcance se fija como unidad exacta.";
  }
  if (scopeType.value === "unit_subtree") {
    return "El alcance incluye la unidad base y sus descendientes organizacionales.";
  }
  if (scopeType.value === "unit_type") {
    return "El alcance se resolvera por todas las unidades del tipo seleccionado.";
  }
  if (scopeType.value === "all_units") {
    return "El alcance cubre todas las unidades activas y puede acotarse por cargo.";
  }
  return "El alcance se aplica a la unidad seleccionada; puedes incluir sus descendientes si corresponde.";
});

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.form,
    [fieldName]: value
  });
};

const updateScopeType = (value) => {
  updateField("unit_scope_type", value);
  emit("scope-change", value);
};

const updateRecipientPolicy = (value) => {
  updateField("recipient_policy", value);
  emit("recipient-policy-change", value);
};
</script>
