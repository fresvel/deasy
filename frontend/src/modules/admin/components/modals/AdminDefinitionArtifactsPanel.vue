<template>
  <div class="flex flex-col gap-4">
    <div v-if="!embedded && context" class="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <strong class="text-sm text-emerald-950">{{ context.name || `Configuracion #${context.id}` }}</strong>
        <span class="inline-flex items-center rounded-xl bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {{ context.variation_key || "—" }}
        </span>
        <span class="inline-flex items-center rounded-xl bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {{ context.definition_version || "—" }}
        </span>
      </div>
    </div>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="context && !canManage" class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Esta configuracion no esta en draft. Solo puedes gestionar plantillas cuando la configuracion este en draft.
    </div>

    <div class="flex items-center justify-between gap-3">
      <h6 class="m-0 text-sm font-bold text-slate-800">Plantillas del proceso</h6>
      <AdminButton
        v-if="canManage"
        variant="outlinePrimary"
        @click="$emit('open-fk-search')"
      >
        <font-awesome-icon icon="search" class="mr-2" />
        Agregar plantilla
      </AdminButton>
    </div>

    <div v-if="loading" class="text-sm text-slate-500">Cargando plantillas vinculadas...</div>
    <AppDataTable
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
        <template v-else-if="field.name === 'item_mode'">
          <select
            v-if="canManage"
            aria-label="Modo de emisión de la plantilla"
            :value="row.item_mode || 'single'"
            class="rounded-2xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
            @change="$emit('set-item-mode', { row, itemMode: $event.target.value })"
          >
            <option value="single">Simple (1 entregable)</option>
            <option value="replicated">Replicado (N con etiqueta)</option>
            <option value="routed">Ruteado (endosar a alguien)</option>
          </select>
          <span v-else class="text-xs font-semibold text-slate-600">{{ itemModeLabel(row.item_mode) }}</span>
          <p v-if="row.item_mode === 'routed'" class="mt-1 m-0 text-[0.65rem] leading-tight text-amber-600">
            El flujo (entrega/firma) se define AL ENVIAR, no aquí.
          </p>
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
    </AppDataTable>
  </div>
</template>

<script setup>
import { computed } from "vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  context: { type: Object, default: null },
  error: { type: String, default: "" },
  canManage: { type: Boolean, default: false },
  // Props heredadas del wrapper (ya no se usan tras quitar la tarjeta de selección); se declaran para
  // evitar que caigan como atributos sueltos en el div raíz.
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

defineEmits(["update:form", "clear-selection", "open-fk-search", "submit", "reset", "view-row", "edit-row", "delete-row", "set-item-mode"]);

const itemModeLabel = (mode) => ({
  single: "Simple",
  replicated: "Replicado",
  routed: "Ruteado"
}[String(mode || "single")] || "Simple");

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
