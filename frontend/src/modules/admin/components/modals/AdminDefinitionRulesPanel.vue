<template>
  <div class="flex flex-col gap-4">
    <div v-if="!embedded && context">
      <strong>{{ context.name || `Configuracion #${context.id}` }}</strong>
      <span class="ml-2 text-success/80">
        Variación {{ context.variation_key || "—" }} | Version {{ context.definition_version || "—" }} | Estado {{ context.status || "—" }}
      </span>
    </div>

    <AppAlert v-if="error">{{ error }}</AppAlert>
    <div v-if="context && !canManage" class="rounded-2xl border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-info">
      Esta configuracion no esta en draft. Solo puedes gestionar reglas cuando la configuracion este en draft.
    </div>
    <!-- Por defecto solo se ve la lista; el formulario se abre con este botón -->
    <div v-if="canManage && !formOpen" class="flex justify-end">
      <AdminButton variant="primary-outline" @click="openForm">
        <font-awesome-icon icon="plus" class="mr-2" />
        Agregar regla
      </AdminButton>
    </div>

    <!-- Alta/edición de una regla en un modal enfocado (mismo patrón que Paquetes). -->
    <AppModalShell
      v-if="canManage && formOpen"
      controlled
      nested
      :open="canManage && formOpen"
      :title="editId ? 'Editar regla de alcance' : 'Nueva regla de alcance'"
      @close="cancelForm"
    >
      <div class="flex flex-col gap-5">
      <div
        class="flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm"
        :class="canSubmit
          ? 'border-line bg-white text-icon'
          : 'border-amber-200 bg-amber-50 text-warning'"
      >
        <font-awesome-icon :icon="canSubmit ? 'info-circle' : 'triangle-exclamation'" class="mt-0.5 shrink-0" />
        <span>{{ canSubmit ? ruleContextHint : (requirementMessage || "Completa el alcance requerido para habilitar el boton de guardar.") }}</span>
      </div>

      <!-- Lo que ya fija la serie se muestra como contexto, no como campos editables. -->
      <div v-if="seriesFixedChips.length" class="flex flex-wrap items-center gap-2 text-xs">
        <span class="font-semibold uppercase tracking-wide text-muted">Fijado por la serie</span>
        <span
          v-for="chip in seriesFixedChips"
          :key="chip.label"
          class="inline-flex items-center gap-1 rounded-xl bg-surface px-2 py-0.5 font-medium text-icon ring-1 ring-line"
        >
          {{ chip.label }}: <strong class="font-bold text-body">{{ chip.value }}</strong>
        </span>
      </div>

      <!-- Bloque 1: a quién va dirigida la regla -->
      <fieldset class="flex flex-col gap-2.5">
        <p class="m-0 text-theme-xs font-bold uppercase tracking-wide text-muted">Alcance y destinatarios</p>
        <div class="grid items-start gap-3 md:grid-cols-12">
          <AdminFieldGroup v-if="showScopeField" label="Alcance" group-class="md:col-span-4">
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
          <AdminFieldGroup v-if="showUnitField" label="Unidad" group-class="md:col-span-4">
            <AdminLookupField
              :model-value="labels.unit_id"
              placeholder="Selecciona una unidad"
              :suggest-provider="suggestProviders.unit_id"
              :disabled="!canManage"
              :clear-disabled="!canManage || !form.unit_id"
              :search-disabled="!canManage"
              @clear="$emit('clear-field', 'unit_id')"
              @select="$emit('select-field', 'unit_id', $event)"
              @search="$emit('open-fk-search', 'unit_id')"
            />
          </AdminFieldGroup>
          <AdminFieldGroup v-if="showUnitTypeField" label="Tipo de unidad" group-class="md:col-span-4">
            <AdminLookupField
              :model-value="labels.unit_type_id"
              placeholder="Selecciona un tipo"
              :suggest-provider="suggestProviders.unit_type_id"
              :disabled="!canManage"
              :clear-disabled="!canManage || !form.unit_type_id"
              :search-disabled="!canManage"
              @clear="$emit('clear-field', 'unit_type_id')"
              @select="$emit('select-field', 'unit_type_id', $event)"
              @search="$emit('open-fk-search', 'unit_type_id')"
            />
          </AdminFieldGroup>
          <AdminFieldGroup v-if="showCargoField" label="Cargo" group-class="md:col-span-4">
            <AdminLookupField
              :model-value="labels.cargo_id"
              placeholder="Selecciona un cargo"
              :suggest-provider="suggestProviders.cargo_id"
              :disabled="!canManage"
              :clear-disabled="!canManage || !form.cargo_id"
              :search-disabled="!canManage"
              @clear="$emit('clear-field', 'cargo_id')"
              @select="$emit('select-field', 'cargo_id', $event)"
              @search="$emit('open-fk-search', 'cargo_id')"
            />
          </AdminFieldGroup>
          <AdminFieldGroup v-if="showPositionField" label="Puesto exacto" group-class="md:col-span-4">
            <AdminLookupField
              :model-value="labels.position_id"
              placeholder="Selecciona un puesto"
              :suggest-provider="suggestProviders.position_id"
              :disabled="!canManage"
              :clear-disabled="!canManage || !form.position_id"
              :search-disabled="!canManage"
              @clear="$emit('clear-field', 'position_id')"
              @select="$emit('select-field', 'position_id', $event)"
              @search="$emit('open-fk-search', 'position_id')"
            />
          </AdminFieldGroup>
        </div>
      </fieldset>

      <!-- Bloque 2: prioridad, estado y vigencia -->
      <fieldset class="flex flex-col gap-2.5 border-t border-dashed border-line pt-4">
        <p class="m-0 text-theme-xs font-bold uppercase tracking-wide text-muted">Prioridad y vigencia</p>
        <div class="grid items-start gap-3 md:grid-cols-12">
          <AdminFieldGroup label="Prioridad" group-class="md:col-span-2">
            <AdminInputField :model-value="form.priority" type="number" min="1" :disabled="!canManage" @update:model-value="updateField('priority', $event)" />
          </AdminFieldGroup>
          <AdminFieldGroup label="Activo" group-class="md:col-span-2">
            <SToggle :model-value="Number(form.is_active) === 1" :disabled="!canManage" label-position="end" field-aligned @change="(value) => updateField('is_active', value ? '1' : '0')" />
          </AdminFieldGroup>
          <AdminFieldGroup label="Vigencia desde" group-class="md:col-span-5">
            <div class="flex items-stretch gap-2">
              <AdminInputField class="flex-1" :model-value="form.effective_from" type="date" :disabled="!canManage" @update:model-value="updateField('effective_from', $event)" />
              <AdminButton variant="neutral-outline" :disabled="!canManage" title="Usar la fecha de hoy" @click="updateField('effective_from', todayIso)">Hoy</AdminButton>
              <AdminButton variant="neutral-outline" icon-only :disabled="!canManage || !form.effective_from" title="Quitar fecha" aria-label="Quitar fecha" @click="updateField('effective_from', '')">
                <font-awesome-icon icon="times" />
              </AdminButton>
            </div>
          </AdminFieldGroup>
          <AdminFieldGroup label="Vigencia hasta" group-class="md:col-span-3">
            <AdminInputField :model-value="form.effective_to" type="date" :disabled="!canManage" @update:model-value="updateField('effective_to', $event)" />
          </AdminFieldGroup>
        </div>
      </fieldset>

      </div>
      <template #footer>
        <AdminFormActions
          :primary-label="editId ? 'Guardar regla' : 'Agregar regla'"
          :primary-disabled="!canSubmit"
          show-cancel
          cancel-label="Cancelar"
          @primary="handleSubmit"
          @cancel="cancelForm"
        />
      </template>
    </AppModalShell>

    <div v-if="loading" class="text-sm text-muted">Cargando reglas vinculadas...</div>
    <AppDataTable
      v-else
      :fields="tableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin reglas vinculadas."
      table-class="min-w-full border-separate border-spacing-0 text-sm"
      responsive-class="overflow-x-auto deasy-card"
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
    </AppDataTable>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/modules/admin/components/forms/AdminFormActions.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

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
  seriesScope: { type: Object, default: null },
  // En el wizard el encabezado del proceso ya lo muestra el shell; evita el banner de contexto duplicado.
  embedded: { type: Boolean, default: false },
  // Mapa fieldName -> proveedor de recomendaciones (combobox). Vacío = lookup clásico.
  suggestProviders: { type: Object, default: () => ({}) },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits([
  "update:form",
  "scope-change",
  "recipient-policy-change",
  "clear-field",
  "select-field",
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
  { value: "exact_position", label: "Puesto exacto" }
];

// Formulario colapsable: por defecto solo se ve la lista. Se abre con "Agregar regla" o al editar una fila,
// y se colapsa al cancelar o cuando el guardado tiene éxito (alta = la lista crece; edición = editId se limpia).
const formOpen = ref(false);
const submitting = ref(false);

const openForm = () => {
  emit("reset");
  formOpen.value = true;
};
const cancelForm = () => {
  submitting.value = false;
  formOpen.value = false;
  emit("reset");
};
const handleSubmit = () => {
  submitting.value = true;
  emit("submit");
};

watch(() => props.editId, (val, old) => {
  if (val) {
    formOpen.value = true;
    return;
  }
  if (old && submitting.value) {
    formOpen.value = false;
    submitting.value = false;
  }
});
watch(() => props.rows.length, (len, old) => {
  if (submitting.value && len > old) {
    formOpen.value = false;
    submitting.value = false;
  }
});
watch(() => props.error, (val) => {
  if (val) {
    submitting.value = false;
  }
});

// Fecha de hoy en formato YYYY-MM-DD respetando la zona horaria local (no UTC).
const todayIso = computed(() => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
});

const scopeType = computed(() => String(props.form.unit_scope_type || "unit_exact"));
const recipientPolicy = computed(() => String(props.form.recipient_policy || "all_matches"));
const isExactPositionPolicy = computed(() => recipientPolicy.value === "exact_position");

// La serie del proceso ("por Docente", "por Carrera"...) ya fija el cargo y/o el tipo de unidad. Cuando
// es así, la regla no vuelve a decidirlos: el cargo queda bloqueado y se muestra el de la serie.
const seriesFixedCargoId = computed(() => {
  const id = props.seriesScope?.cargo_id;
  return id ? Number(id) : null;
});
const seriesFixedCargoName = computed(() => props.seriesScope?.cargo_name || "");
const cargoLockedBySeries = computed(() => Boolean(seriesFixedCargoId.value));
// Variación por tipo de unidad: la serie fija el alcance (tipo); la regla solo decide el cargo.
const seriesFixedUnitTypeName = computed(() => props.seriesScope?.unit_type_name || "");
const unitTypeLockedBySeries = computed(() =>
  String(props.seriesScope?.source_type || "") === "unit_type"
  && Boolean(props.seriesScope?.unit_type_id)
);
// Resumen compacto de lo que la serie ya fija: se muestra como contexto en vez de campos bloqueados.
const seriesFixedChips = computed(() => {
  const chips = [];
  if (unitTypeLockedBySeries.value) {
    chips.push({ label: "Alcance", value: `Tipo de unidad · ${seriesFixedUnitTypeName.value}` });
  }
  if (cargoLockedBySeries.value) {
    chips.push({ label: "Cargo", value: seriesFixedCargoName.value });
  }
  return chips;
});
// "Puesto exacto" es un modo cerrado: el puesto define unidad y cargo, así que el formulario se reduce a
// elegir el puesto (alcance, unidad, tipo y cargo se ocultan). El resto de entregas usa el alcance.
const showScopeField = computed(() => !isExactPositionPolicy.value && !unitTypeLockedBySeries.value);
const showUnitField = computed(() =>
  !isExactPositionPolicy.value && (scopeType.value === "unit_exact" || scopeType.value === "unit_subtree")
);
const showUnitTypeField = computed(() =>
  !isExactPositionPolicy.value && scopeType.value === "unit_type" && !unitTypeLockedBySeries.value
);
const showCargoField = computed(() => !isExactPositionPolicy.value && !cargoLockedBySeries.value);
const showPositionField = computed(() => isExactPositionPolicy.value);

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
