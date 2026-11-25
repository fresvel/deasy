<template>
  <!-- UN PLANO ENCIMA, Y NO UNA RUTA (frente 25, P23 — 2026-10-14).
       «+ Nuevo» vivía dentro del paso 1 como un botón que CAMBIABA el campo «Proceso» por un input
       y añadía dos campos más. Llevarlo a `/admin/procesos/procesos/processes` no era opción: el
       asistente es un modal y navegar lo destruye con el formulario a medio llenar, y no hay
       reanudación. El plano encima es barato: `AppModalShell` se coloca solo al abrirse, así que
       este modal NO declara ninguna altura. -->
  <AppModalShell
    controlled
    :open="open"
    labelled-by="wizardProcesoModalLabel"
    title="Nuevo proceso"
    content-class="max-w-lg"
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-4">
      <AppAlert v-if="error" variant="danger">{{ error }}</AppAlert>

      <AdminFieldGroup label="Nombre del proceso">
        <AdminInputField
          :model-value="form.name"
          placeholder="Evaluación docente"
          @update:model-value="actualizar('name', $event)"
        />
      </AdminFieldGroup>

      <AdminFieldGroup label="Proceso padre">
        <AdminSelectField
          :model-value="form.parent_id"
          @update:model-value="actualizar('parent_id', $event)"
        >
          <option value="">Sin proceso padre</option>
          <option v-for="proc in processOptions" :key="proc.id" :value="String(proc.id)">{{ proc.name }}</option>
        </AdminSelectField>
      </AdminFieldGroup>

      <AdminFieldGroup label="Slug">
        <div class="deasy-card flex min-h-10 items-center break-all px-3.5 py-2.5 text-sm font-semibold text-body">
          {{ slugPreview || "Se calcula con el nombre" }}
        </div>
      </AdminFieldGroup>
    </div>

    <template #footer>
      <AdminButton variant="danger-outline" @click="$emit('close')">Cancelar</AdminButton>
      <AdminButton variant="primary-outline" :disabled="creando" @click="$emit('crear', form)">
        {{ creando ? 'Creando…' : 'Crear proceso' }}
      </AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  processOptions: { type: Array, default: () => [] },
  creando: { type: Boolean, default: false },
  error: { type: String, default: "" },
  // El slug lo calcula el asistente, que es quien conoce los que ya existen.
  slugPreviewPara: { type: Function, default: null }
});

defineEmits(["close", "crear"]);

const form = ref({ name: "", parent_id: "" });
const actualizar = (campo, valor) => { form.value = { ...form.value, [campo]: valor }; };

// Abrir el plano empieza en limpio: es un formulario de usar y cerrar, no un estado del asistente.
watch(() => props.open, (abierto) => {
  if (abierto) {
    form.value = { name: "", parent_id: "" };
  }
});

const slugPreview = computed(() =>
  props.slugPreviewPara ? props.slugPreviewPara(form.value.name) : ""
);
</script>
