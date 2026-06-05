<template>
  <AdminModalShell
    controlled
    :open="open"
    labelled-by="processWizardModalLabel"
    title="Crear proceso guiado"
    size="xl"
    dialog-class="max-w-6xl"
    close-action
    @close="$emit('close')"
  >
    <!-- Stepper -->
    <div class="mb-4 flex items-stretch gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <button
        v-for="(step, index) in steps"
        :key="step.key"
        type="button"
        class="group flex flex-1 min-w-[7.5rem] items-center gap-2 rounded-xl px-3 py-2 text-left transition"
        :class="stepButtonClass(step, index)"
        :disabled="isStepLocked(step)"
        @click="$emit('go-to-step', step.key)"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          :class="stepBadgeClass(step)"
        >
          <font-awesome-icon v-if="isStepComplete(step)" icon="check" />
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="flex flex-col">
          <span class="text-sm font-bold leading-tight">{{ step.label }}</span>
          <span class="text-[0.65rem] font-semibold uppercase tracking-wide" :class="stepHintClass(step)">{{ stepHint(step) }}</span>
        </span>
      </button>
    </div>

    <div v-if="wizardError" class="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ wizardError }}</div>

    <div v-if="definitionContext?.id && currentStep !== 'definition'" class="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 text-sm text-emerald-800">
      <strong>{{ definitionContext.name || `Configuración #${definitionContext.id}` }}</strong>
      <span class="inline-flex items-center rounded-md bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
        {{ definitionContext.definition_version || "—" }}
      </span>
      <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold" :class="definitionStatusBadgeClass">
        {{ definitionStatusLabel }}
      </span>
    </div>

    <!-- Paso 1: Configuración -->
    <div v-show="currentStep === 'definition'">
      <p class="mb-3 text-sm text-slate-600">Define el proceso y su primera versión. Después agregarás paquetes, reglas y disparadores antes de activarla.</p>
      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Proceso" group-class="md:col-span-6">
          <div class="flex gap-2">
            <AdminSelectField
              v-if="form.process_mode === 'existing'"
              :model-value="form.process_id"
              class="flex-1"
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
              @update:model-value="updateForm('new_process_name', $event)"
            />
            <AdminButton variant="cancel" @click="toggleProcessMode">
              {{ form.process_mode === 'existing' ? '+ Nuevo' : 'Existente' }}
            </AdminButton>
          </div>
        </AdminFieldGroup>
        <AdminFieldGroup label="Nombre de la configuración" group-class="md:col-span-6">
          <AdminInputField :model-value="form.name" placeholder="ej. Informe de Investigación 2026" @update:model-value="updateForm('name', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Origen de serie" group-class="md:col-span-6">
          <AdminSelectField :model-value="form.series_source_type" @update:model-value="updateForm('series_source_type', $event)">
            <option value="unit_type">Por tipo de unidad</option>
            <option value="cargo">Por cargo</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup :label="form.series_source_type === 'cargo' ? 'Cargo' : 'Tipo de unidad'" group-class="md:col-span-6">
          <AdminSelectField
            v-if="form.series_source_type === 'cargo'"
            :model-value="form.cargo_id"
            @update:model-value="updateForm('cargo_id', $event)"
          >
            <option value="">Selecciona un cargo</option>
            <option v-for="c in cargoOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </AdminSelectField>
          <AdminSelectField
            v-else
            :model-value="form.unit_type_id"
            @update:model-value="updateForm('unit_type_id', $event)"
          >
            <option value="">Selecciona un tipo de unidad</option>
            <option v-for="u in unitTypeOptions" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Variación" group-class="md:col-span-4">
          <AdminInputField :model-value="form.variation_key" placeholder="general" @update:model-value="updateForm('variation_key', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Versión" group-class="md:col-span-4">
          <AdminInputField :model-value="form.definition_version" placeholder="1.0.0" @update:model-value="updateForm('definition_version', $event)" />
        </AdminFieldGroup>
        <AdminFieldGroup label="Requiere documento" group-class="md:col-span-4">
          <AdminSelectField :model-value="String(form.has_document)" @update:model-value="updateForm('has_document', Number($event))">
            <option value="1">Sí (genera entregables)</option>
            <option value="0">No</option>
          </AdminSelectField>
        </AdminFieldGroup>
        <AdminFieldGroup label="Descripción" group-class="md:col-span-12">
          <AdminInputField :model-value="form.description" placeholder="Descripción breve del proceso" @update:model-value="updateForm('description', $event)" />
        </AdminFieldGroup>
      </div>
    </div>

    <!-- Pasos 2-5: contenido inyectado por el padre (paneles embebidos) -->
    <div v-show="currentStep === 'packages'"><slot name="packages" /></div>
    <div v-show="currentStep === 'rules'"><slot name="rules" /></div>
    <div v-show="currentStep === 'triggers'"><slot name="triggers" /></div>
    <div v-show="currentStep === 'activate'"><slot name="activate" /></div>

    <template #footer>
      <AdminButton variant="cancel" @click="$emit('close')">Cerrar</AdminButton>
      <AdminButton v-if="currentStep !== 'definition'" variant="secondary" :disabled="prevDisabled" @click="goPrev">Atrás</AdminButton>
      <AdminButton
        v-if="currentStep === 'definition'"
        variant="primary"
        :disabled="creatingDefinition"
        @click="$emit('create-definition')"
      >{{ creatingDefinition ? 'Creando…' : (definitionContext?.id ? 'Continuar' : 'Crear configuración →') }}</AdminButton>
      <AdminButton
        v-else-if="currentStep !== 'activate'"
        variant="primary"
        @click="goNext"
      >Siguiente →</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { computed } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  currentStep: { type: String, default: "definition" },
  steps: { type: Array, default: () => [] },
  stepStatus: { type: Object, default: () => ({}) },
  definitionContext: { type: Object, default: null },
  definitionForm: { type: Object, default: () => ({}) },
  processOptions: { type: Array, default: () => [] },
  unitTypeOptions: { type: Array, default: () => [] },
  cargoOptions: { type: Array, default: () => [] },
  creatingDefinition: { type: Boolean, default: false },
  wizardError: { type: String, default: "" }
});

const emit = defineEmits(["close", "go-to-step", "create-definition", "update:definitionForm"]);

const form = computed(() => props.definitionForm || {});

const hasDefinition = computed(() => Boolean(props.definitionContext?.id));

// Estado de la configuración como badge (no como parte del nombre): label legible + color por estado.
const DEFINITION_STATUS_META = {
  draft: { label: "Borrador", class: "bg-slate-200 text-slate-700" },
  active: { label: "Activa", class: "bg-emerald-500 text-white" },
  retired: { label: "Retirada", class: "bg-amber-200 text-amber-800" }
};
const definitionStatusMeta = computed(() =>
  DEFINITION_STATUS_META[String(props.definitionContext?.status || "draft").toLowerCase()]
  || { label: props.definitionContext?.status || "—", class: "bg-slate-200 text-slate-700" }
);
const definitionStatusLabel = computed(() => definitionStatusMeta.value.label);
const definitionStatusBadgeClass = computed(() => definitionStatusMeta.value.class);

const updateForm = (field, value) => {
  emit("update:definitionForm", { ...props.definitionForm, [field]: value });
};

const toggleProcessMode = () => {
  updateForm("process_mode", form.value.process_mode === "existing" ? "new" : "existing");
};

const isStepComplete = (step) => Boolean(props.stepStatus?.[step.key]);
const isStepLocked = (step) => step.key !== "definition" && !hasDefinition.value;

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

const stepButtonClass = (step, index) => {
  if (step.key === props.currentStep) return "bg-white shadow-sm ring-1 ring-indigo-300";
  if (isStepLocked(step)) return "opacity-50 cursor-not-allowed";
  return "hover:bg-white/70";
};
const stepBadgeClass = (step) => {
  if (isStepComplete(step)) return "bg-emerald-500 text-white";
  if (step.key === props.currentStep) return "bg-indigo-500 text-white";
  return "bg-slate-200 text-slate-500";
};
const stepHintClass = (step) => {
  if (isStepComplete(step)) return "text-emerald-600";
  if (step.key === props.currentStep) return "text-indigo-500";
  return "text-slate-400";
};
const stepHint = (step) => {
  if (step.key === "activate") return hasDefinition.value ? "Final" : "Bloqueado";
  if (isStepComplete(step)) return "Completo";
  if (isStepLocked(step)) return "Bloqueado";
  return "Pendiente";
};
</script>
