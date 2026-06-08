<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlEditorModalLabel"
    :title="editorMode === 'create' ? `Añadir ${table?.label || 'registro'}` : 'Editar registro'"
    size="xl"
    :content-class="isProcessTable ? 'process-dialog-content' : ''"
  >
    <div v-if="modalError" class="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ modalError }}
    </div>
    <form class="grid gap-3 md:grid-cols-12">
      <div v-for="field in visibleFormFields" :key="field.name" class="md:col-span-6">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
          {{ field.label || field.name }}
          <span v-if="field.required" class="text-red-600">*</span>
        </label>
        <div v-if="isInputField(field) && isForeignKeyField(field)" class="relative">
          <AdminLookupField
            :model-value="fkDisplay[field.name]"
            :placeholder="field.placeholder || ''"
            :disabled="isFieldLocked(field)"
            prevent-button-mouse-down
            @update:model-value="$emit('update-inline-fk-display', field.name, $event)"
            @focus="$emit('open-inline-fk-suggestions', field)"
            @blur="$emit('schedule-inline-fk-close', field.name)"
            @clear="$emit('clear-inline-fk-selection', field.name)"
            @search="$emit('open-fk-search', field)"
          />
          <div
            v-if="shouldShowInlineFkSuggestions(field.name)"
            class="fk-inline-suggestions overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            @mousedown.prevent
          >
            <div v-if="inlineFkLoading[field.name]" class="px-4 py-3 text-sm text-slate-500">
              Buscando...
            </div>
            <template v-else-if="(inlineFkSuggestions[field.name] || []).length">
              <AdminButton
                v-for="option in inlineFkSuggestions[field.name]"
                :key="`${field.name}-${option.id}`"
                variant="plain"
                class-name="w-full justify-start rounded-none border-0 border-b border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 last:border-b-0 hover:bg-slate-50"
                @mousedown.prevent="$emit('select-inline-fk-suggestion', field, option)"
              >
                {{ formatInlineFkOption(field, option) }}
              </AdminButton>
            </template>
            <div v-else class="px-4 py-3 text-sm text-slate-500">
              Sin coincidencias. Usa Buscar.
            </div>
          </div>
        </div>
        <AdminInputField
          v-else-if="isInputField(field)"
          :model-value="formData[field.name]"
          :type="inputType(field)"
          :placeholder="field.placeholder || ''"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        />
        <AdminInputField
          v-else-if="field.type === 'textarea'"
          :model-value="formData[field.name]"
          as="textarea"
          :rows="3"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        />
        <AdminSelectField
          v-else-if="field.type === 'select'"
          :model-value="formData[field.name]"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
          @change="$emit('handle-select-change', field)"
        >
          <option value="">Seleccionar</option>
          <option v-for="option in field.options || []" :key="option" :value="option">
            {{ formatSelectOptionLabel(field, option) }}
          </option>
        </AdminSelectField>
        <AdminSelectField
          v-else-if="field.type === 'boolean'"
          :model-value="formData[field.name]"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        >
          <option value="1">Si</option>
          <option value="0">No</option>
        </AdminSelectField>
        <AdminInputField
          v-else
          :model-value="formData[field.name]"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        />
      </div>
    </form>
    <section v-if="showProcessConfigurations" class="mt-5 border-t border-slate-200 pt-5">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Configuraciones</p>
          <h6 class="m-0 mt-1 flex items-center gap-2 text-base font-extrabold text-slate-800">
            <span>Configuraciones del proceso</span>
            <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-100 px-1.5 text-xs font-bold text-slate-600">
              {{ processConfigurationRows.length }}
            </span>
          </h6>
          <p class="m-0 mt-1 text-xs font-medium leading-5 text-slate-500">
            Agrega nuevas configuraciones y elimina borradores que aun no deben usarse en el proceso.
          </p>
        </div>
        <AdminButton
          v-if="canCreateProcessConfiguration"
          variant="outlinePrimary"
          @click="$emit('add-process-configuration')"
        >
          <font-awesome-icon icon="plus" />
          <span>Agregar configuracion</span>
        </AdminButton>
      </div>
      <div
        v-if="processConfigurationError"
        class="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
      >
        {{ processConfigurationError }}
      </div>
      <div v-if="processConfigurationLoading" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
        Cargando configuraciones vinculadas...
      </div>
      <AdminDataTable
        v-else
        :fields="processConfigurationTableFields"
        :rows="processConfigurationRows"
        :row-key="(row) => row.id"
        empty-text="Este proceso aun no tiene configuraciones."
        table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
        responsive-class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
        scroll-class=""
      >
        <template #cell="{ row, field }">
          <span
            v-if="field.name === 'status'"
            class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold"
            :class="processConfigurationStatusClass(row[field.name])"
          >
            {{ processConfigurationStatusLabel(row[field.name]) }}
          </span>
          <template v-else>
            {{ formatProcessConfigurationCell(row, field) }}
          </template>
        </template>
        <template #actions="{ row }">
          <AdminTableActions
            :show-view="false"
            :show-edit="false"
            :show-delete="canDeleteProcessConfigurationRow(row)"
            delete-message="Eliminar configuracion"
            @delete="$emit('delete-process-configuration', row)"
          />
        </template>
      </AdminDataTable>
      <p
        v-if="canDeleteProcessConfiguration && processConfigurationRows.some((row) => !canDeleteProcessConfigurationRow(row))"
        class="m-0 mt-2 text-xs font-medium text-slate-500"
      >
        Las configuraciones activas o retiradas no se eliminan desde este bloque; gestionalas con versionado o cambio de estado.
      </p>
    </section>
    <div v-if="table?.table === 'process_definition_versions'" class="definition-checklist mt-4">
      <div class="definition-checklist-head">
        <strong>Checklist de activacion</strong>
        <span v-if="processDefinitionChecklistLoading" class="text-sm text-slate-500">Validando...</span>
        <span v-else-if="!selectedRow?.id || editorMode === 'create'" class="text-sm text-slate-500">
          Disponible despues de guardar la configuracion.
        </span>
      </div>
      <div class="definition-checklist-items">
        <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.rules }">
          <font-awesome-icon :icon="processDefinitionChecklist.rules ? 'check' : 'times'" />
          <span>Al menos una regla activa</span>
        </div>
        <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.triggers }">
          <font-awesome-icon :icon="processDefinitionChecklist.triggers ? 'check' : 'times'" />
          <span>Al menos un disparador activo</span>
        </div>
        <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.artifacts || !requiresDefinitionArtifacts }">
          <font-awesome-icon :icon="(processDefinitionChecklist.artifacts || !requiresDefinitionArtifacts) ? 'check' : 'times'" />
          <span>{{ requiresDefinitionArtifacts ? "Al menos un paquete vinculado" : "No requiere paquetes" }}</span>
        </div>
      </div>
    </div>
    <template #footer>
      <AdminButton
        v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
        variant="outlinePrimary"
        @click="$emit('open-definition-rules')"
      >
        <font-awesome-icon icon="sitemap" />
        Reglas
      </AdminButton>
      <AdminButton
        v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
        variant="outlinePrimary"
        @click="$emit('open-definition-triggers')"
      >
        <font-awesome-icon icon="sitemap" />
        Disparadores
      </AdminButton>
      <AdminButton
        v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
        variant="outlinePrimary"
        @click="$emit('open-definition-artifacts')"
      >
        <font-awesome-icon icon="link" />
        Paquetes
      </AdminButton>
      <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
      <AdminButton
        :variant="table?.table === 'processes' && editorMode === 'create' ? 'secondary' : 'primary'"
        @click="$emit('submit')"
      >
        Guardar
      </AdminButton>
      <AdminButton
        v-if="table?.table === 'processes' && editorMode === 'create'"
        variant="primary"
        @click="$emit('submit-and-configure')"
      >
        <font-awesome-icon icon="plus" />
        Guardar y agregar configuracion
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

const props = defineProps({
  editorMode: { type: String, default: "create" },
  table: { type: Object, default: null },
  isProcessTable: { type: Boolean, default: false },
  modalError: { type: String, default: "" },
  visibleFormFields: { type: Array, default: () => [] },
  fkDisplay: { type: Object, default: () => ({}) },
  inlineFkLoading: { type: Object, default: () => ({}) },
  inlineFkSuggestions: { type: Object, default: () => ({}) },
  formData: { type: Object, default: () => ({}) },
  processDefinitionChecklistLoading: { type: Boolean, default: false },
  processDefinitionChecklist: { type: Object, default: () => ({}) },
  requiresDefinitionArtifacts: { type: Boolean, default: false },
  processConfigurationLoading: { type: Boolean, default: false },
  processConfigurationError: { type: String, default: "" },
  processConfigurationRows: { type: Array, default: () => [] },
  processConfigurationTableFields: { type: Array, default: () => [] },
  canCreateProcessConfiguration: { type: Boolean, default: false },
  canDeleteProcessConfiguration: { type: Boolean, default: false },
  selectedRow: { type: Object, default: null },
  isInputField: { type: Function, required: true },
  isForeignKeyField: { type: Function, required: true },
  isFieldLocked: { type: Function, required: true },
  inputType: { type: Function, required: true },
  shouldShowInlineFkSuggestions: { type: Function, required: true },
  formatInlineFkOption: { type: Function, required: true },
  formatSelectOptionLabel: { type: Function, required: true },
  formatProcessConfigurationCell: { type: Function, required: true },
  canDeleteProcessConfigurationRow: { type: Function, required: true }
});

const emit = defineEmits([
  "update:form-data",
  "update-inline-fk-display",
  "open-inline-fk-suggestions",
  "schedule-inline-fk-close",
  "clear-inline-fk-selection",
  "open-fk-search",
  "select-inline-fk-suggestion",
  "handle-select-change",
  "add-process-configuration",
  "delete-process-configuration",
  "open-definition-rules",
  "open-definition-triggers",
  "open-definition-artifacts",
  "submit-and-configure",
  "submit"
]);

const modalRef = ref(null);

const showProcessConfigurations = computed(() =>
  props.table?.table === "processes"
  && props.editorMode === "edit"
  && Boolean(props.selectedRow?.id)
);

const processConfigurationStatusLabel = (value) => ({
  draft: "Borrador",
  active: "Activa",
  retired: "Retirada"
}[String(value || "").trim().toLowerCase()] || (value || "—"));

const processConfigurationStatusClass = (value) => ({
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-50 text-emerald-700",
  retired: "bg-amber-50 text-amber-700"
}[String(value || "").trim().toLowerCase()] || "bg-slate-100 text-slate-600");

const updateFormField = (fieldName, value) => {
  emit("update:form-data", {
    ...props.formData,
    [fieldName]: value
  });
};

defineExpose({
  get el() {
    return modalRef.value?.el ?? null;
  }
});
</script>
