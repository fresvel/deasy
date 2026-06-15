<template>
  <AdminWizardSection
    title="Paquetes (plantillas)"
    subtitle="Documentos que se generan al ejecutar el proceso y cómo se instancian."
  >
    <div v-if="!embedded && context" class="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <strong class="text-sm text-emerald-950">{{ context.name || `Configuracion #${context.id}` }}</strong>
        <span class="inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {{ context.variation_key || "—" }}
        </span>
        <span class="inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {{ context.definition_version || "—" }}
        </span>
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="context && !canManage" class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Esta configuracion no esta en draft. Solo puedes gestionar plantillas cuando la configuracion este en draft.
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Plantilla</p>
          <h6 class="m-0 mt-1 text-base font-extrabold text-slate-800">
            {{ hasTemplateSelection ? selectedTemplateLabel : "Sin plantilla seleccionada" }}
          </h6>
        </div>
        <div v-if="canManage" class="flex flex-wrap gap-2">
          <AdminButton
            variant="outlinePrimary"
            :disabled="!canManage"
            @click="$emit('open-fk-search')"
          >
            <font-awesome-icon icon="search" class="mr-2" />
            {{ hasTemplateSelection ? "Cambiar plantilla" : "Agregar plantilla" }}
          </AdminButton>
          <AdminButton
            v-if="hasTemplateSelection"
            variant="secondary"
            :disabled="!canManage"
            @click="$emit('clear-selection')"
          >
            <font-awesome-icon icon="times" class="mr-2" />
            Quitar
          </AdminButton>
        </div>
      </div>
      <div v-if="canManage && !hasTemplateSelection" class="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600">
        Selecciona una plantilla para configurar como parte de este paquete.
      </div>
      <div v-if="hasTemplateSelection" class="mt-4 grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Orden" group-class="md:col-span-3">
          <AdminInputField :model-value="form.sort_order" type="number" min="1" :disabled="!canManage" @update:model-value="updateField('sort_order', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Modo de instancia" group-class="md:col-span-5">
          <AdminSelectField :model-value="form.instance_mode" :disabled="!canManage" @update:model-value="updateField('instance_mode', $event)">
            <option value="single_document">Un documento por responsable</option>
            <option value="owner_many_documents">Varios documentos por responsable</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Genera tarea" group-class="md:col-span-2">
          <AdminSelectField :model-value="form.creates_task" :disabled="!canManage" @update:model-value="updateField('creates_task', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Requerido" group-class="md:col-span-2">
          <AdminSelectField :model-value="form.is_required" :disabled="!canManage" @update:model-value="updateField('is_required', $event)">
            <option value="1">Si</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
      </div>
      <AdminFormActions
        v-if="hasTemplateSelection"
        class="mt-4"
        :primary-label="editId ? 'Guardar plantilla' : 'Agregar plantilla'"
        :primary-disabled="!canSubmit"
        :show-cancel="Boolean(editId)"
        cancel-label="Cancelar edicion"
        @primary="$emit('submit')"
        @cancel="$emit('reset')"
      />
    </div>

    <div v-if="loading" class="text-sm text-slate-500">Cargando plantillas vinculadas...</div>
    <AdminDataTable
      v-else
      class="person-assignment-table"
      :fields="displayTableFields"
      :rows="rows"
      :row-key="(row) => row.id"
      empty-text="Sin plantillas vinculadas."
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
          edit-tooltip="Editar plantilla"
          delete-message="Eliminar plantilla"
          :show-edit="canManage"
          :show-delete="canManage"
          @view="$emit('view-row', row)"
          @edit="$emit('edit-row', row)"
          @delete="$emit('delete-row', row)"
        />
      </template>
    </AdminDataTable>
  </AdminWizardSection>
</template>

<script setup>
import { computed } from "vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminFormActions from "@/modules/admin/components/forms/AdminFormActions.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminWizardSection from "@/modules/admin/components/modals/AdminWizardSection.vue";

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
  embedded: { type: Boolean, default: false },
  formatCell: { type: Function, required: true }
});

const emit = defineEmits(["update:form", "clear-selection", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row"]);

const selectedTemplateLabel = computed(() =>
  String(props.labels.template_artifact_id || props.form.template_artifact_id || "").trim()
);
const hasTemplateSelection = computed(() => Boolean(String(props.form.template_artifact_id || "").trim()));
const displayTableFields = computed(() =>
  props.tableFields.map((field) =>
    field.name === "template_artifact_id"
      ? { ...field, label: "Plantilla" }
      : field
  )
);

const updateField = (fieldName, value) => {
  emit("update:form", {
    ...props.form,
    [fieldName]: value
  });
};
</script>
