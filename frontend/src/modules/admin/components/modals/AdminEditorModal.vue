<template>
  <AppModalShell
    ref="modalRef"
    labelled-by="sqlEditorModalLabel"
    :title="editorMode === 'create' ? `Añadir ${table?.label || 'registro'}` : 'Editar registro'"
    size="xl"
    :content-class="isProcessTable ? 'process-dialog-content' : ''"
  >
    <AppAlert v-if="modalError">
      {{ modalError }}
    </AppAlert>
    <form class="grid gap-3 md:grid-cols-12">
      <div v-for="field in visibleFormFields" :key="field.name" class="md:col-span-6">
        <label :for="fieldId(field.name)" class="deasy-form-label deasy-form-label--inline">
          {{ field.label || field.name }}
          <span v-if="field.required" class="text-red-600">*</span>
        </label>
        <div v-if="isInputField(field) && isForeignKeyField(field)" class="relative">
          <AdminLookupField
            :id="fieldId(field.name)"
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
            class="fk-inline-suggestions overflow-hidden rounded-xl border border-line bg-white shadow-lg"
            @mousedown.prevent
          >
            <div v-if="inlineFkLoading[field.name]" class="px-4 py-3 text-sm text-muted">
              Buscando...
            </div>
            <template v-else-if="(inlineFkSuggestions[field.name] || []).length">
              <AdminButton
                v-for="option in inlineFkSuggestions[field.name]"
                :key="`${field.name}-${option.id}`"
                variant="plain"
                class-name="w-full justify-start rounded-none border-0 border-b border-line px-4 py-3 text-left text-sm font-medium text-body last:border-b-0 hover:bg-surface"
                @mousedown.prevent="$emit('select-inline-fk-suggestion', field, option)"
              >
                {{ formatInlineFkOption(field, option) }}
              </AdminButton>
            </template>
            <div v-else class="px-4 py-3 text-sm text-muted">
              Sin coincidencias. Usa Buscar.
            </div>
          </div>
        </div>
        <AdminInputField
          v-else-if="isInputField(field)"
          :id="fieldId(field.name)"
          :model-value="formData[field.name]"
          :type="inputType(field)"
          :placeholder="field.placeholder || ''"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        />
        <AdminInputField
          v-else-if="field.type === 'textarea'"
          :id="fieldId(field.name)"
          :model-value="formData[field.name]"
          as="textarea"
          :rows="3"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        />
        <AdminSelectField
          v-else-if="field.type === 'select'"
          :id="fieldId(field.name)"
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
        <SToggle
          v-else-if="field.type === 'boolean'"
          :id="fieldId(field.name)"
          :model-value="Number(formData[field.name]) === 1"
          :disabled="isFieldLocked(field)"
          label-position="end"
          @change="(value) => updateFormField(field.name, value ? '1' : '0')"
        />
        <AdminInputField
          v-else
          :id="fieldId(field.name)"
          :model-value="formData[field.name]"
          :disabled="isFieldLocked(field)"
          @update:model-value="updateFormField(field.name, $event)"
        />
      </div>
    </form>
    <section v-if="showProcessConfigurations" class="mt-5 border-t border-line pt-5">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="m-0 text-xs font-bold uppercase tracking-wide text-muted">Configuraciones</p>
          <h6 class="m-0 mt-1 flex items-center gap-2 text-base font-extrabold text-strong">
            <span>Configuraciones del proceso</span>
            <span class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-surface px-1.5 text-xs font-bold text-icon">
              {{ processConfigurationRows.length }}
            </span>
          </h6>
          <p class="m-0 mt-1 text-xs font-medium leading-5 text-muted">
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
      <AppAlert
        v-if="processConfigurationError">
        {{ processConfigurationError }}
      </AppAlert>
      <div v-if="processConfigurationLoading" class="rounded-2xl border border-line bg-surface px-4 py-6 text-center text-sm font-medium text-muted">
        Cargando configuraciones vinculadas...
      </div>
      <AppDataTable
        v-else
        :fields="processConfigurationTableFields"
        :rows="processConfigurationRows"
        :row-key="(row) => row.id"
        empty-text="Este proceso aun no tiene configuraciones."
        table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
        responsive-class="overflow-x-auto rounded-2xl border border-line bg-white shadow-elev-1"
        scroll-class=""
      >
        <template #cell="{ row, field }">
          <span
            v-if="field.name === 'status'"
            class="inline-flex items-center rounded-xl px-2 py-0.5 text-xs font-bold"
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
      </AppDataTable>
      <p
        v-if="canDeleteProcessConfiguration && processConfigurationRows.some((row) => !canDeleteProcessConfigurationRow(row))"
        class="m-0 mt-2 text-xs font-medium text-muted"
      >
        Las configuraciones activas o retiradas no se eliminan desde este bloque; gestionalas con versionado o cambio de estado.
      </p>
    </section>
    <div v-if="table?.table === 'process_definition_versions'" class="definition-checklist mt-4">
      <div class="definition-checklist-head">
        <strong>Checklist de activacion</strong>
        <span v-if="processDefinitionChecklistLoading" class="text-sm text-muted">Validando...</span>
        <span v-else-if="!selectedRow?.id || editorMode === 'create'" class="text-sm text-muted">
          Disponible despues de guardar la configuracion.
        </span>
      </div>
      <div class="definition-checklist-items">
        <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.rules }">
          <font-awesome-icon :icon="processDefinitionChecklist.rules ? 'check' : 'times'" />
          <span>Al menos una regla de alcance activa</span>
        </div>
        <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.triggers }">
          <font-awesome-icon :icon="processDefinitionChecklist.triggers ? 'check' : 'times'" />
          <span>Al menos un tipo de periodo activo</span>
        </div>
        <div class="definition-checklist-item" :class="{ 'is-complete': processDefinitionChecklist.artifacts }">
          <font-awesome-icon :icon="processDefinitionChecklist.artifacts ? 'check' : 'times'" />
          <span>Al menos un paquete (plantilla) vinculado</span>
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
        Alcance
      </AdminButton>
      <AdminButton
        v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
        variant="outlinePrimary"
        @click="$emit('open-definition-triggers')"
      >
        <font-awesome-icon icon="sitemap" />
        Periodos
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
  </AppModalShell>
</template>

<script setup>
import { computed, ref, useId } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import SToggle from "@/shared/components/forms/SToggle.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;

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
  draft: "bg-surface text-body",
  active: "bg-emerald-50 text-success",
  retired: "bg-amber-50 text-warning"
}[String(value || "").trim().toLowerCase()] || "bg-surface text-icon");

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
