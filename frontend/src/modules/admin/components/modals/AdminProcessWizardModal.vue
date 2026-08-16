<template>
  <AdminProcessWizardShell
    controlled
    :open="open"
    labelled-by="processWizardModalLabel"
    :title="modalTitle"
    :steps="steps"
    :current-step="currentStep"
    :step-status="stepStatus"
    :definition-context="definitionContext"
    :wizard-error="wizardError"
    :show-context-summary="showContextSummary"
    lock-after-first-until-context
    @close="$emit('close')"
    @go-to-step="$emit('go-to-step', $event)"
  >
    <!-- Paso 1: Configuración -->
    <div v-show="currentStep === 'definition'" class="flex flex-col gap-4">
      <div
        v-if="duplicateDefinition?.id"
        class="deasy-alert deasy-alert--warning flex flex-wrap items-center justify-between gap-3"
      >
        <span>Ya existe una configuración para esa variación y versión.</span>
        <AdminButton variant="primaryOutline" @click="$emit('edit-existing-definition', duplicateDefinition)">
          Editar existente
        </AdminButton>
      </div>
      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Proceso" group-class="md:col-span-6">
          <div class="flex gap-2">
            <AdminSelectField
              v-if="form.process_mode === 'existing'"
              :model-value="form.process_id"
              class="flex-1"
              :disabled="isDefinitionLocked"
              @update:model-value="updateForm('process_id', $event)"
            >
              <option value="">Selecciona un proceso</option>
              <option v-for="proc in processOptions" :key="proc.id" :value="String(proc.id)">{{ proc.name }}</option>
            </AdminSelectField>
            <AdminInputField
              v-else
              :model-value="form.new_process_name"
              class="flex-1"
              placeholder="Nombre del nuevo proceso"
              :disabled="isDefinitionLocked"
              @update:model-value="updateForm('new_process_name', $event)"
            />
            <AdminButton variant="dangerOutline" :disabled="isDefinitionLocked" @click="toggleProcessMode">
              {{ form.process_mode === 'existing' ? '+ Nuevo' : 'Existente' }}
            </AdminButton>
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup label="Nombre generado" group-class="md:col-span-6">
          <div class="flex min-h-10 items-center break-all rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-body">
            {{ definitionNameLabel }}
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="form.process_mode === 'new'"
          label="Proceso padre"
          group-class="md:col-span-6"
        >
          <AdminSelectField
            :model-value="form.new_process_parent_id"
            :disabled="isDefinitionLocked"
            @update:model-value="updateForm('new_process_parent_id', $event)"
          >
            <option value="">Sin proceso padre</option>
            <option v-for="proc in processOptions" :key="proc.id" :value="String(proc.id)">{{ proc.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="form.process_mode === 'new'"
          label="Slug"
          group-class="md:col-span-6"
        >
          <div class="flex min-h-10 items-center break-all rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-body">
            {{ processSlugPreview || "Pendiente" }}
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup label="Variación de proceso" group-class="md:col-span-8">
          <AdminSelectField :model-value="form.series_id" :disabled="isDefinitionLocked" @update:model-value="updateForm('series_id', $event)">
            <option value="">Selecciona una variación</option>
            <option v-for="series in seriesOptions" :key="series.id" :value="String(series.id)">
              {{ series.label || series.code }}
            </option>
            <option value="__new__">Nueva variación</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Código de variación" group-class="md:col-span-4">
          <div class="flex min-h-10 items-center break-all rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-body">
            {{ seriesCodePreview || "Pendiente" }}
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingSeries"
          label="Origen de serie"
          group-class="md:col-span-4"
        >
          <AdminSelectField :model-value="form.series_source_type" :disabled="isDefinitionLocked" @update:model-value="updateForm('series_source_type', $event)">
            <option value="unit_type">Por tipo de unidad</option>
            <option value="cargo">Por cargo</option>
            <option value="default">Sin variación (nombre directo)</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingSeries && form.series_source_type === 'unit_type'"
          label="Tipo de unidad"
          group-class="md:col-span-4"
        >
          <AdminSelectField
            :model-value="form.unit_type_id"
            :disabled="isDefinitionLocked"
            @update:model-value="updateForm('unit_type_id', $event)"
          >
            <option value="">Selecciona un tipo de unidad</option>
            <option v-for="u in unitTypeOptions" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingSeries && form.series_source_type === 'cargo'"
          label="Cargo"
          group-class="md:col-span-4"
        >
          <AdminSelectField
            :model-value="form.cargo_id"
            :disabled="isDefinitionLocked"
            @update:model-value="updateForm('cargo_id', $event)"
          >
            <option value="">Selecciona un cargo</option>
            <option v-for="c in cargoOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Versión" group-class="md:col-span-4">
          <AdminInputField :model-value="form.definition_version" placeholder="1.0.0" :disabled="isDefinitionLocked" @update:model-value="updateForm('definition_version', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Descripción" group-class="md:col-span-12">
          <AdminInputField :model-value="form.description" placeholder="Descripción breve del proceso" :disabled="isDefinitionLocked" @update:model-value="updateForm('description', $event)" />
        </AdminFieldGroup>
      </div>
    </div>

    <!-- Pasos 2-5: contenido inyectado por el padre (paneles embebidos) -->
    <div v-show="currentStep === 'packages'"><slot name="packages" /></div>
    <div v-show="currentStep === 'rules'"><slot name="rules" /></div>
    <div v-show="currentStep === 'triggers'"><slot name="triggers" /></div>
    <div v-show="currentStep === 'activate'"><slot name="activate" /></div>

    <template #footer>
      <AdminButton variant="neutralOutline" @click="$emit('close')">Cerrar</AdminButton>
      <AdminButton v-if="currentStep !== 'definition'" variant="neutralOutline" :disabled="prevDisabled" @click="goPrev">Atrás</AdminButton>
      <AdminButton
        v-if="currentStep === 'definition'"
        variant="primary"
        :disabled="creatingDefinition"
        @click="handleDefinitionPrimary"
      >{{ creatingDefinition ? 'Creando…' : (definitionContext?.id ? 'Continuar' : 'Crear configuración →') }}</AdminButton>
      <AdminButton
        v-else-if="currentStep !== 'activate'"
        variant="primary"
        @click="goNext"
      >Siguiente →</AdminButton>
    </template>
  </AdminProcessWizardShell>
</template>

<script setup>
import { computed } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminProcessWizardShell from "@/modules/admin/components/modals/AdminProcessWizardShell.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  currentStep: { type: String, default: "definition" },
  steps: { type: Array, default: () => [] },
  stepStatus: { type: Object, default: () => ({}) },
  definitionContext: { type: Object, default: null },
  definitionForm: { type: Object, default: () => ({}) },
  duplicateDefinition: { type: Object, default: null },
  processOptions: { type: Array, default: () => [] },
  unitTypeOptions: { type: Array, default: () => [] },
  cargoOptions: { type: Array, default: () => [] },
  seriesOptions: { type: Array, default: () => [] },
  seriesCodePreview: { type: String, default: "" },
  processSlugPreview: { type: String, default: "" },
  definitionNamePreview: { type: String, default: "" },
  creatingDefinition: { type: Boolean, default: false },
  wizardError: { type: String, default: "" },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits(["close", "go-to-step", "create-definition", "edit-existing-definition", "update:definitionForm"]);

const form = computed(() => props.definitionForm || {});
const isCreatingSeries = computed(() => form.value.series_id === "__new__");

const hasDefinition = computed(() => Boolean(props.definitionContext?.id));
const isDefinitionLocked = computed(() => props.readonly || hasDefinition.value);
const modalTitle = computed(() =>
  props.definitionContext?.id ? "Configuración de proceso" : "Configurar nuevo proceso"
);
const showContextSummary = computed(() => Boolean(props.definitionContext?.id && props.currentStep !== "definition"));
const definitionIntroText = computed(() =>
  props.definitionContext?.id
    ? "Revisa la configuración base y navega por paquetes, reglas, disparadores y activación."
    : "Define el proceso y su primera versión. Después agregarás paquetes, reglas y disparadores antes de activarla."
);
const definitionNameLabel = computed(() =>
  props.definitionNamePreview || props.definitionContext?.name || "Pendiente"
);

const updateForm = (field, value) => {
  const nextForm = { ...props.definitionForm, [field]: value };
  if (field === "series_source_type") {
    if (value === "unit_type") {
      nextForm.cargo_id = "";
    } else if (value === "cargo") {
      nextForm.unit_type_id = "";
    } else {
      nextForm.unit_type_id = "";
      nextForm.cargo_id = "";
    }
  } else if (field === "process_mode") {
    if (value === "existing") {
      nextForm.new_process_name = "";
      nextForm.new_process_parent_id = "";
    } else {
      nextForm.process_id = "";
    }
  }
  emit("update:definitionForm", nextForm);
};

const toggleProcessMode = () => {
  if (isDefinitionLocked.value) {
    return;
  }
  updateForm("process_mode", form.value.process_mode === "existing" ? "new" : "existing");
};

const currentIndex = computed(() => props.steps.findIndex((s) => s.key === props.currentStep));
const prevDisabled = computed(() => currentIndex.value <= 0);

const goNext = () => {
  const next = props.steps[currentIndex.value + 1];
  if (next) emit("go-to-step", next.key);
};
const goPrev = () => {
  const prev = props.steps[currentIndex.value - 1];
  if (prev) emit("go-to-step", prev.key);
};

const handleDefinitionPrimary = () => {
  if (hasDefinition.value) {
    goNext();
    return;
  }
  emit("create-definition");
};
</script>
