<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="sqlEditorModalLabel"
    :title="editorMode === 'create' ? `Añadir ${table?.label || 'registro'}` : 'Editar registro'"
    size="xl"
    :content-class="isProcessTable ? 'process-modal-content' : ''"
  >
    <div v-if="modalError" class="alert alert-danger mb-3">
      {{ modalError }}
    </div>
    <form class="row g-3">
      <div v-for="field in visibleFormFields" :key="field.name" class="col-12 col-md-6">
        <label class="form-label">
          {{ field.label || field.name }}
          <span v-if="field.required" class="text-danger">*</span>
        </label>
        <div v-if="isInputField(field) && isForeignKeyField(field)" class="position-relative">
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
            class="list-group fk-inline-suggestions shadow-sm"
            @mousedown.prevent
          >
            <div v-if="inlineFkLoading[field.name]" class="list-group-item text-muted small">
              Buscando...
            </div>
            <template v-else-if="(inlineFkSuggestions[field.name] || []).length">
              <AdminButton
                v-for="option in inlineFkSuggestions[field.name]"
                :key="`${field.name}-${option.id}`"
                variant="plain"
                class-name="list-group-item list-group-item-action"
                @mousedown.prevent="$emit('select-inline-fk-suggestion', field, option)"
              >
                {{ formatInlineFkOption(field, option) }}
              </AdminButton>
            </template>
            <div v-else class="list-group-item text-muted small">
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
    <div v-if="table?.table === 'process_definition_versions'" class="definition-checklist mt-4">
      <div class="definition-checklist-head">
        <strong>Checklist de activacion</strong>
        <span v-if="processDefinitionChecklistLoading" class="text-muted">Validando...</span>
        <span v-else-if="!selectedRow?.id || editorMode === 'create'" class="text-muted">
          Disponible despues de guardar la definicion.
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
        <font-awesome-icon icon="sitemap" class="me-2" />
        Reglas
      </AdminButton>
      <AdminButton
        v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
        variant="outlinePrimary"
        @click="$emit('open-definition-triggers')"
      >
        <font-awesome-icon icon="sitemap" class="me-2" />
        Disparadores
      </AdminButton>
      <AdminButton
        v-if="table?.table === 'process_definition_versions' && editorMode === 'edit' && selectedRow?.id"
        variant="outlinePrimary"
        @click="$emit('open-definition-artifacts')"
      >
        <font-awesome-icon icon="link" class="me-2" />
        Paquetes
      </AdminButton>
      <AdminButton variant="cancel" data-modal-dismiss>Cancelar</AdminButton>
      <AdminButton variant="primary" @click="$emit('submit')">Guardar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminInputField from "@/views/admin/components/AdminInputField.vue";
import AdminLookupField from "@/views/admin/components/AdminLookupField.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";
import AdminSelectField from "@/views/admin/components/AdminSelectField.vue";

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
  selectedRow: { type: Object, default: null },
  isInputField: { type: Function, required: true },
  isForeignKeyField: { type: Function, required: true },
  isFieldLocked: { type: Function, required: true },
  inputType: { type: Function, required: true },
  shouldShowInlineFkSuggestions: { type: Function, required: true },
  formatInlineFkOption: { type: Function, required: true },
  formatSelectOptionLabel: { type: Function, required: true }
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
  "open-definition-rules",
  "open-definition-triggers",
  "open-definition-artifacts",
  "submit"
]);

const modalRef = ref(null);

const updateFormField = (fieldName, value) => {
  emit("update:form-data", {
    ...props.formData,
    [fieldName]: value
  });
};

defineExpose({ el: modalRef });
</script>
