<template>
  <!-- EL MAYOR FOCO DE RUIDO DEL PASO 1, EN SU PROPIO PLANO (frente 25, P23 — 2026-10-14).
       «Nueva línea» era una opción del desplegable de líneas, y elegirla inyectaba CINCO campos más
       —nombre, cargo, dónde y, según el dónde, tipo de unidad o unidad— en la misma pantalla que ya
       pedía los de la configuración. Aquí los cinco están juntos y el paso 1 se queda en tres. -->
  <AppModalShell
    controlled
    :open="open"
    labelled-by="wizardLineaModalLabel"
    title="Nueva línea de proceso"
    content-class="max-w-2xl"
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-4">
      <AppAlert v-if="error" variant="danger">{{ error }}</AppAlert>

      <p class="m-0 text-sm text-muted">
        Una línea es <strong>la obligación</strong>: quién la produce y dónde. Sus dos ejes se
        declaran juntos, y de ella cuelgan las configuraciones con su versión.
      </p>

      <div class="grid gap-3 md:grid-cols-12">
        <AdminFieldGroup label="Proceso" group-class="md:col-span-6">
          <AdminSelectField
            :model-value="form.process_id"
            @update:model-value="actualizar('process_id', $event)"
          >
            <option value="">Selecciona un proceso</option>
            <option v-for="proc in processOptions" :key="proc.id" :value="String(proc.id)">{{ proc.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>

        <AdminFieldGroup label="Nombre de la línea" group-class="md:col-span-6">
          <AdminInputField
            :model-value="form.nombre"
            placeholder="Informe de Investigación Formativa · Coordinadores de Carrera"
            @update:model-value="actualizar('nombre', $event)"
          />
        </AdminFieldGroup>

        <AdminFieldGroup label="Cargo que lo produce" group-class="md:col-span-4">
          <AdminSelectField
            :model-value="form.cargo_id"
            @update:model-value="actualizar('cargo_id', $event)"
          >
            <option value="">Cualquier cargo</option>
            <option v-for="c in cargoOptions" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>

        <AdminFieldGroup label="Dónde" group-class="md:col-span-4">
          <AdminSelectField
            :model-value="form.unit_scope_type"
            @update:model-value="actualizar('unit_scope_type', $event)"
          >
            <option value="all_units">Todas las unidades</option>
            <option value="unit_type">Por tipo de unidad</option>
            <option value="unit_exact">Una unidad concreta</option>
          </AdminSelectField>
        </AdminFieldGroup>

        <AdminFieldGroup
          v-if="form.unit_scope_type === 'unit_type'"
          label="Tipo de unidad"
          group-class="md:col-span-4"
        >
          <AdminSelectField
            :model-value="form.unit_type_id"
            @update:model-value="actualizar('unit_type_id', $event)"
          >
            <option value="">Selecciona un tipo de unidad</option>
            <option v-for="u in unitTypeOptions" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>

        <AdminFieldGroup
          v-if="form.unit_scope_type === 'unit_exact'"
          label="Unidad"
          group-class="md:col-span-4"
        >
          <AdminSelectField
            :model-value="form.unit_id"
            @update:model-value="actualizar('unit_id', $event)"
          >
            <option value="">Selecciona una unidad</option>
            <option v-for="u in unitOptions" :key="u.id" :value="String(u.id)">{{ u.name }}</option>
          </AdminSelectField>
        </AdminFieldGroup>
      </div>
    </div>

    <template #footer>
      <AdminButton variant="danger-outline" @click="$emit('close')">Cancelar</AdminButton>
      <AdminButton variant="primary-outline" :disabled="creando" @click="$emit('crear', form)">
        {{ creando ? 'Creando…' : 'Crear línea' }}
      </AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref, watch } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  processOptions: { type: Array, default: () => [] },
  cargoOptions: { type: Array, default: () => [] },
  unitTypeOptions: { type: Array, default: () => [] },
  unitOptions: { type: Array, default: () => [] },
  // El proceso por el que está acotado el buscador: la línea nueva nace ahí por defecto.
  processIdPorDefecto: { type: String, default: "" },
  creando: { type: Boolean, default: false },
  error: { type: String, default: "" }
});

defineEmits(["close", "crear"]);

const enBlanco = () => ({
  process_id: props.processIdPorDefecto || "",
  nombre: "",
  cargo_id: "",
  unit_scope_type: "all_units",
  unit_type_id: "",
  unit_id: ""
});

const form = ref(enBlanco());

const actualizar = (campo, valor) => {
  const siguiente = { ...form.value, [campo]: valor };
  // El alcance limpia SU columna, no la del cargo: el cargo es el otro eje y sobrevive a cualquier
  // alcance. Con la serie había que borrarlo, porque los dos ejes eran excluyentes.
  if (campo === "unit_scope_type") {
    if (valor === "unit_type") {
      siguiente.unit_id = "";
    } else if (valor === "unit_exact") {
      siguiente.unit_type_id = "";
    } else {
      siguiente.unit_type_id = "";
      siguiente.unit_id = "";
    }
  }
  form.value = siguiente;
};

watch(() => props.open, (abierto) => {
  if (abierto) {
    form.value = enBlanco();
  }
});
</script>
