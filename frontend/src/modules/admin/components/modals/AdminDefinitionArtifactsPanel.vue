<template>
  <div class="flex flex-col gap-4">
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
        Selecciona una plantilla para añadirla a este proceso.
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
  </div>
</template>

<script setup>
import { computed } from "vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminFormActions from "@/modules/admin/components/forms/AdminFormActions.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";

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

defineEmits(["update:form", "clear-selection", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row"]);

const selectedTemplateLabel = computed(() =>
  String(props.labels.template_artifact_id || props.form.template_artifact_id || "").trim()
);
const hasTemplateSelection = computed(() => Boolean(String(props.form.template_artifact_id || "").trim()));
// El orden (sort_order) es interno y creates_task es siempre "sí"; no se muestran como columnas.
const HIDDEN_ARTIFACT_COLUMNS = new Set(["creates_task", "sort_order"]);
const displayTableFields = computed(() =>
  props.tableFields
    .filter((field) => !HIDDEN_ARTIFACT_COLUMNS.has(field.name))
    .map((field) =>
      field.name === "template_artifact_id"
        ? { ...field, label: "Plantilla" }
        : field
    )
);
</script>
