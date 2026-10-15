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
      <!-- TRES CAMPOS, Y ERAN HASTA ONCE (frente 25, P23 — 2026-10-14).
           Este paso declaraba 12 grupos de campo que cubrían TRES entidades —proceso, línea y
           configuración—: 5 visibles en el caso común y 11 en el peor. Lo que queda son los tres
           datos que SON de la configuración. El proceso ACOTA el buscador en vez de ser un campo, y
           crear un proceso o una línea abre su propio plano. -->
      <!-- SOBRE UNA CONFIGURACIÓN YA CREADA LOS DOS PLANOS NO SE DESACTIVAN: SE VAN (2026-10-14).
           Salían deshabilitados y con el tono de peligro, así que parecían dos botones rojos que al
           pulsarlos no hacían nada —el dueño lo leyó como «ya no me sale el modal»—. Un paso 1
           bloqueado no admite cambiar la línea, de modo que crear un proceso o una línea desde ahí
           no tendría dónde aterrizar: lo que no se puede usar no se enseña. Y el tono vuelve a ser
           el de una acción que AÑADE; el rojo es de Cancelar y de lo que destruye. -->
      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Acotar por proceso" group-class="md:col-span-5">
          <div class="flex items-stretch gap-2">
            <AdminSelectField
              :model-value="filtroProcessId"
              class="flex-1"
              :disabled="isDefinitionLocked"
              @update:model-value="$emit('update:filtroProcessId', $event)"
            >
              <option value="">Todos los procesos</option>
              <option v-for="proc in processOptions" :key="proc.id" :value="String(proc.id)">{{ proc.name }}</option>
            </AdminSelectField>
            <AdminButton v-if="!isDefinitionLocked" variant="primary-outline" @click="$emit('abrir-proceso')">
              + Nuevo
            </AdminButton>
          </div>
          <p class="m-0 mt-1 text-theme-xs text-muted">
            Sólo filtra la búsqueda. El proceso de una configuración lo dice su línea.
          </p>
        </AdminFieldGroup>

        <AdminFieldGroup label="Línea de proceso" group-class="md:col-span-7">
          <div class="flex items-stretch gap-2">
            <AdminLookupField
              class="flex-1"
              group-class="flex-1"
              :model-value="selectedLineaName"
              placeholder="Escribe para buscar una línea"
              :disabled="isDefinitionLocked"
              :show-search="false"
              :suggest-provider="isDefinitionLocked ? null : lineaSuggestProvider"
              @select="$emit('elegir-linea', $event)"
              @clear="$emit('elegir-linea', null)"
            />
            <AdminButton v-if="!isDefinitionLocked" variant="primary-outline" @click="$emit('abrir-linea')">
              + Nueva
            </AdminButton>
          </div>
        </AdminFieldGroup>

        <AdminFieldGroup label="Versión" group-class="md:col-span-4">
          <AdminInputField :model-value="form.definition_version" placeholder="1.0.0" :disabled="isDefinitionLocked" @update:model-value="updateForm('definition_version', $event)" />
        </AdminFieldGroup>

        <AdminFieldGroup label="Se llamará" group-class="md:col-span-8">
          <div class="deasy-card flex min-h-10 items-center break-all px-3.5 py-2.5 text-sm font-semibold text-body">
            {{ definitionNameLabel }}
          </div>
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
import AdminLookupField from "@/modules/admin/components/forms/AdminLookupField.vue";
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
  // La ACOTACIÓN, que no es un campo del formulario: sólo decide qué líneas ofrece el buscador.
  filtroProcessId: { type: String, default: "" },
  lineaSuggestProvider: { type: Function, default: null },
  selectedLineaName: { type: String, default: "" },
  definitionNamePreview: { type: String, default: "" },
  creatingDefinition: { type: Boolean, default: false },
  wizardError: { type: String, default: "" },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits([
  "close",
  "go-to-step",
  "create-definition",
  "edit-existing-definition",
  "update:definitionForm",
  "update:filtroProcessId",
  "elegir-linea",
  "abrir-proceso",
  "abrir-linea"
]);

const form = computed(() => props.definitionForm || {});

const hasDefinition = computed(() => Boolean(props.definitionContext?.id));
const isDefinitionLocked = computed(() => props.readonly || hasDefinition.value);
const modalTitle = computed(() =>
  props.definitionContext?.id ? "Configuración de proceso" : "Configurar nuevo proceso"
);
const showContextSummary = computed(() => Boolean(props.definitionContext?.id && props.currentStep !== "definition"));
// SIN LÍNEA NO HAY NOMBRE QUE PREVISUALIZAR. La previsualización junta línea y versión descartando
// lo vacío, así que sin línea elegida enseñaba la versión sola —«1.0.0»— como si fuera el nombre.
const definitionNameLabel = computed(() => {
  if (props.definitionContext?.id) {
    return props.definitionContext.name || "Pendiente";
  }
  return props.selectedLineaName ? (props.definitionNamePreview || "Pendiente") : "Pendiente";
});

// AQUÍ LIMPIABA CAMPOS DE OTRAS DOS ENTIDADES, y era la señal: el alcance de la LÍNEA borraba su
// columna hermana, y alternar «Existente / + Nuevo» vaciaba los campos del PROCESO. Las dos reglas
// se fueron con sus campos a sus planos; lo que queda escribe el formulario y ya está.
const updateForm = (field, value) => {
  emit("update:definitionForm", { ...props.definitionForm, [field]: value });
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
