<template>
  <div class="flex flex-col gap-4">
    <div v-if="!embedded && context" class="person-assignment-context">
      <strong>{{ context.name || `Configuracion #${context.id}` }}</strong>
      <span class="ml-2 text-emerald-700/80">
        Variación {{ context.variation_key || "—" }} | Version {{ context.definition_version || "—" }} | Estado {{ context.status || "—" }}
      </span>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="context && !canManage" class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Esta configuracion no esta en draft. Solo puedes gestionar los periodos del proceso cuando la configuracion este en draft.
    </div>

    <!-- Por defecto solo se ve la lista; el formulario se abre con este botón (mismo patrón que Paquetes). -->
    <div v-if="canManage && !formOpen" class="flex justify-end">
      <AdminButton variant="outlinePrimary" @click="openForm">
        <font-awesome-icon icon="plus" class="mr-2" />
        Agregar periodo
      </AdminButton>
    </div>

    <AppDialogOverlay
      :open="canManage && formOpen"
      :title="editId ? 'Editar periodo' : 'Nuevo periodo'"
      panel-class="max-w-2xl"
      @close="cancelForm"
    >
      <div class="grid gap-3 md:grid-cols-12">
        <div class="md:col-span-8">
          <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Tipo de periodo</label>
          <AdminLookupField
            :model-value="labels.term_type_id"
            placeholder="Selecciona el tipo de periodo en que corre el proceso"
            :suggest-provider="suggestProvider"
            :disabled="!canManage"
            :clear-disabled="!canManage || !form.term_type_id"
            :search-disabled="!canManage"
            @clear="$emit('clear-term-type')"
            @select="$emit('select-term-type', $event)"
            @search="$emit('open-fk-search')"
          />
        </div>
        <AdminFieldGroup label="Activo" group-class="md:col-span-4">
          <SToggle :model-value="Number(form.is_active) === 1" :disabled="!canManage" label-position="end" @change="(value) => updateField('is_active', value ? '1' : '0')" />
        </AdminFieldGroup>
      </div>
      <template #footer>
        <AdminFormActions
          :primary-label="editId ? 'Guardar periodo' : 'Agregar periodo'"
          :primary-disabled="!canSubmit"
          show-cancel
          cancel-label="Cancelar"
          @primary="handleSubmit"
          @cancel="cancelForm"
        />
      </template>
    </AppDialogOverlay>

    <div v-if="loading" class="text-sm text-slate-500">Cargando periodos del proceso...</div>
    <AdminDataTable
      v-else
      :fields="tableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin periodos vinculados."
      table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
      responsive-class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm person-assignment-table"
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
          edit-tooltip="Editar periodo"
          delete-message="Eliminar periodo"
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
import { ref, watch } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/modules/admin/components/forms/AdminFormActions.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";

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
  embedded: { type: Boolean, default: false },
  suggestProvider: { type: Function, default: null },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits(["update:form", "trigger-mode-change", "clear-term-type", "select-term-type", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row"]);

// Formulario en modal: por defecto solo se ve la lista. Se abre con "Agregar periodo" o al editar una fila,
// y se cierra al cancelar o cuando el guardado tiene éxito (alta = la lista crece; edición = editId se limpia).
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

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.form,
    [fieldName]: value
  });
};
</script>
