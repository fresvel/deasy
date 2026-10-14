<template>
  <div class="flex flex-col gap-4">
    <div v-if="!embedded && context">
      <strong>{{ context.name || `Configuracion #${context.id}` }}</strong>
      <span class="ml-2 text-success/80">
        Variación {{ context.linea_nombre || "—" }} | Version {{ context.definition_version || "—" }} | Estado {{ context.status || "—" }}
      </span>
    </div>

    <AppAlert v-if="error">{{ error }}</AppAlert>
    <AppAlert v-if="context && !canManage" variant="info">
      Esta configuracion no esta en draft. Solo puedes gestionar reglas cuando la configuracion este en draft.
    </AppAlert>
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
      :open="canManage && formOpen"
      :title="editId ? 'Editar regla de alcance' : 'Nueva regla de alcance'"
      @close="cancelForm"
    >
      <div class="flex flex-col gap-6">
      <!-- Era un aviso escrito a mano con `border-amber-200 bg-amber-50` —y `amber` no es una
           familia de la paleta—. Es `AppAlert` en su variante de fila, que existe desde F4. -->
      <AppAlert :variant="canSubmit ? 'info' : 'warning'" class="deasy-alert--row items-start">
        <font-awesome-icon :icon="canSubmit ? 'info-circle' : 'triangle-exclamation'" class="mt-0.5 shrink-0" />
        <span>{{ canSubmit ? ruleContextHint : (requirementMessage || "Completa el alcance requerido para habilitar el boton de guardar.") }}</span>
      </AppAlert>

      <!-- Lo que fija la OBLIGACION se muestra como contexto. Decia «Fijado por la serie», y la
           serie se retiro con P9; y hasta P10 esto convivia con campos editables que decian lo
           mismo, asi que la pantalla ofrecia cambiar un alcance que un guardia revertia despues. -->
      <div v-if="lineaFixedChips.length" class="flex flex-wrap items-center gap-2 text-xs">
        <span class="deasy-overline">Fijado por la obligación</span>
        <span
          v-for="chip in lineaFixedChips"
          :key="chip.label"
          class="inline-flex items-center gap-2 rounded-xl bg-surface px-2 py-0.5 font-medium text-icon ring-1 ring-line"
        >
          {{ chip.label }}: <strong class="font-bold text-body">{{ chip.value }}</strong>
        </span>
      </div>

      <!-- UN SOLO BLOQUE, Y ERAN DOS. El alcance, la unidad, el tipo y el cargo se editaban aqui y
           eran copia de la linea (P10): la pantalla daba a elegir algo que la obligacion ya decia.
           Y el bloque «Prioridad» se fue con su columna, que solo aparecia en un ORDER BY. -->
      <fieldset class="flex flex-col gap-3">
        <p class="deasy-overline">Destinatarios</p>
        <div class="grid items-start gap-3 md:grid-cols-12">
          <AdminFieldGroup label="Entrega" group-class="md:col-span-6">
            <AdminSelectField :model-value="form.recipient_policy" :disabled="!canManage" @update:model-value="updateRecipientPolicy">
              <option v-for="option in recipientPolicyOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </AdminSelectField>
          </AdminFieldGroup>
          <AdminFieldGroup v-if="showPositionField" label="Puesto exacto" group-class="md:col-span-6">
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
        {{ formatCell(row, field.name) }}
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
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
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
  lineaScope: { type: Object, default: null },
  // En el wizard el encabezado del proceso ya lo muestra el shell; evita el banner de contexto duplicado.
  embedded: { type: Boolean, default: false },
  // Mapa fieldName -> proveedor de recomendaciones (combobox). Vacío = lookup clásico.
  suggestProviders: { type: Object, default: () => ({}) },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits([
  "update:form",
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

const recipientPolicyOptions = [
  { value: "all_matches", label: "Todos los puestos coincidentes" },
  { value: "unit_head", label: "Jefatura de la unidad" },
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

// AQUI VIVIA `todayIso`, el atajo «Hoy» del campo de vigencia de la regla. Se fue con las fechas
// (frente 25, P18-d).

// AQUI VIVIA `scopeType`, y se fue con las cuatro columnas de ambito de la regla (frente 25, P10):
// eran copia de la linea. El alcance se lee de `lineaScope` y se ENSENA; no se edita aqui.
const recipientPolicy = computed(() => String(props.form.recipient_policy || "all_matches"));
const isExactPositionPolicy = computed(() => recipientPolicy.value === "exact_position");

// La LÍNEA del proceso («Informe de IF · Coordinadores de Carrera») fija el cargo y el alcance.
// Ya no es «cuando es así»: es SIEMPRE, desde que la regla dejó de tener copia (P10). Lo que la
// obligación dice se muestra como contexto, y los tres ámbitos se nombran aquí porque es la única
// pantalla donde alguien ve el reparto sin abrir la línea.
const lineaFixedCargoId = computed(() => {
  const id = props.lineaScope?.cargo_id;
  return id ? Number(id) : null;
});
const lineaFixedCargoName = computed(() => props.lineaScope?.cargo_name || "");
const cargoLockedByLinea = computed(() => Boolean(lineaFixedCargoId.value));
// Alcance por tipo de unidad: lo fija la línea; la regla solo decide la entrega.
const lineaFixedUnitTypeName = computed(() => props.lineaScope?.unit_type_name || "");
const lineaScopeType = computed(() => String(props.lineaScope?.unit_scope_type || ""));
// Resumen de lo que la obligación fija. Son los tres ámbitos, no sólo el del tipo: antes los otros
// dos se veían como campos editables, así que aquí sólo hacía falta el que estaba bloqueado.
const lineaFixedChips = computed(() => {
  const chips = [];
  if (lineaScopeType.value === "unit_type" && lineaFixedUnitTypeName.value) {
    chips.push({ label: "Alcance", value: `Tipo de unidad · ${lineaFixedUnitTypeName.value}` });
  } else if (lineaScopeType.value === "unit_exact") {
    chips.push({ label: "Alcance", value: "Una unidad concreta" });
  } else if (lineaScopeType.value === "all_units") {
    chips.push({ label: "Alcance", value: "Todas las unidades" });
  }
  if (cargoLockedByLinea.value) {
    chips.push({ label: "Cargo", value: lineaFixedCargoName.value });
  }
  return chips;
});
// "Puesto exacto" es el único modo que pide un dato: el puesto. Los otros dos no piden nada, porque
// el alcance ya no se declara aquí.
const showPositionField = computed(() => isExactPositionPolicy.value);

const requirementMessage = computed(() => {
  if (!props.canManage || props.canSubmit) {
    return "";
  }
  if (isExactPositionPolicy.value) {
    return "Selecciona un puesto exacto para guardar la regla.";
  }
  return "Completa los datos requeridos para habilitar el boton de guardar.";
});

// EL AVISO EXPLICA EL AFINADO, no el alcance: el alcance lo dice la obligacion y se ve en los chips.
const ruleContextHint = computed(() => {
  if (isExactPositionPolicy.value) {
    return "Solo ese puesto, dentro del alcance de la obligacion.";
  }
  if (recipientPolicy.value === "unit_head") {
    return "Solo la jefatura de cada unidad del alcance, sea cual sea su cargo.";
  }
  return "Todos los puestos que coincidan con el alcance de la obligacion.";
});

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.form,
    [fieldName]: value
  });
};

const updateRecipientPolicy = (value) => {
  updateField("recipient_policy", value);
  emit("recipient-policy-change", value);
};
</script>
