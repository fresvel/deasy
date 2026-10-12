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
      <AppAlert variant="warning" class="flex flex-wrap items-center justify-between gap-3" v-if="duplicateDefinition?.id">
        <span>Ya existe una configuración para esa variación y versión.</span>
        <AdminButton variant="primary-outline" @click="$emit('edit-existing-definition', duplicateDefinition)">
          Editar existente
        </AdminButton>
      </AppAlert>
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
            <AdminButton variant="danger-outline" :disabled="isDefinitionLocked" @click="toggleProcessMode">
              {{ form.process_mode === 'existing' ? '+ Nuevo' : 'Existente' }}
            </AdminButton>
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup label="Nombre generado" group-class="md:col-span-6">
          <div class="deasy-card flex min-h-10 items-center break-all px-3.5 py-2.5 text-sm font-semibold text-body">
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
          <div class="deasy-card flex min-h-10 items-center break-all px-3.5 py-2.5 text-sm font-semibold text-body">
            {{ processSlugPreview || "Pendiente" }}
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup label="Línea de proceso" group-class="md:col-span-12">
          <AdminSelectField :model-value="form.linea_id" :disabled="isDefinitionLocked" @update:model-value="updateForm('linea_id', $event)">
            <option value="">Selecciona una línea</option>
            <option v-for="linea in lineaOptions" :key="linea.id" :value="String(linea.id)">
              {{ linea.label || linea.nombre }}
            </option>
            <option value="__new__">Nueva línea</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingLinea"
          label="Nombre de la línea"
          group-class="md:col-span-12"
        >
          <AdminInputField
            :model-value="form.linea_nombre"
            placeholder="Informe de Investigación Formativa · Coordinadores de Carrera"
            :disabled="isDefinitionLocked"
            @update:model-value="updateForm('linea_nombre', $event)"
          />
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingLinea"
          label="Cargo que lo produce"
          group-class="md:col-span-4"
        >
          <AdminSelectField
            :model-value="form.cargo_id"
            :disabled="isDefinitionLocked"
            @update:model-value="updateForm('cargo_id', $event)"
          >
            <option value="">Cualquier cargo</option>
            <option v-for="c in cargoOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingLinea"
          label="Dónde"
          group-class="md:col-span-4"
        >
          <AdminSelectField :model-value="form.unit_scope_type" :disabled="isDefinitionLocked" @update:model-value="updateForm('unit_scope_type', $event)">
            <option value="all_units">Todas las unidades</option>
            <option value="unit_type">Por tipo de unidad</option>
            <option value="unit_exact">Una unidad concreta</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup
          v-if="isCreatingLinea && form.unit_scope_type === 'unit_type'"
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
          v-if="isCreatingLinea && form.unit_scope_type === 'unit_exact'"
          label="Unidad"
          group-class="md:col-span-4"
        >
          <AdminSelectField
            :model-value="form.unit_id"
            :disabled="isDefinitionLocked"
            @update:model-value="updateForm('unit_id', $event)"
          >
            <option value="">Selecciona una unidad</option>
            <option v-for="u in unitOptions" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
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
      <AdminButton variant="neutral-outline" @click="$emit('close')">Cerrar</AdminButton>
      <AdminButton v-if="currentStep !== 'definition'" variant="neutral-outline" :disabled="prevDisabled" @click="goPrev">Atrás</AdminButton>
      <AdminButton
        v-if="currentStep === 'definition'"
        variant="primary-outline"
        :disabled="creatingDefinition"
        @click="handleDefinitionPrimary"
      >{{ creatingDefinition ? 'Creando…' : (definitionContext?.id ? 'Continuar' : 'Crear configuración →') }}</AdminButton>
      <AdminButton
        v-else-if="currentStep !== 'activate'"
        variant="primary-outline"
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
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

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
  lineaOptions: { type: Array, default: () => [] },
  unitOptions: { type: Array, default: () => [] },
  processSlugPreview: { type: String, default: "" },
  definitionNamePreview: { type: String, default: "" },
  creatingDefinition: { type: Boolean, default: false },
  wizardError: { type: String, default: "" },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits(["close", "go-to-step", "create-definition", "edit-existing-definition", "update:definitionForm"]);

const form = computed(() => props.definitionForm || {});
// LOS DOS EJES SE PIDEN JUNTOS, que es la diferencia con la serie: ésta ofrecía «por tipo de
// unidad» O «por cargo», nunca los dos, así que «los Coordinadores DE CARRERA» no cabía y había que
// partirlo entre esta pantalla y la regla de reparto.
const isCreatingLinea = computed(() => form.value.linea_id === "__new__");

const hasDefinition = computed(() => Boolean(props.definitionContext?.id));
const isDefinitionLocked = computed(() => props.readonly || hasDefinition.value);
const modalTitle = computed(() =>
  props.definitionContext?.id ? "Configuración de proceso" : "Configurar nuevo proceso"
);
const showContextSummary = computed(() => Boolean(props.definitionContext?.id && props.currentStep !== "definition"));
const definitionNameLabel = computed(() =>
  props.definitionNamePreview || props.definitionContext?.name || "Pendiente"
);

const updateForm = (field, value) => {
  const nextForm = { ...props.definitionForm, [field]: value };
  // El alcance limpia SU columna, no la del cargo: el cargo es el otro eje y sobrevive a cualquier
  // alcance. Con la serie había que borrarlo, porque los dos ejes eran excluyentes.
  if (field === "unit_scope_type") {
    if (value === "unit_type") {
      nextForm.unit_id = "";
    } else if (value === "unit_exact") {
      nextForm.unit_type_id = "";
    } else {
      nextForm.unit_type_id = "";
      nextForm.unit_id = "";
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
