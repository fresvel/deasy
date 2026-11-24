<template>
  <!-- DESDE CUÁNDO (frente 27, D-04). Sólo aparece al mover o desvincular un nodo cuya relación ya
       rige: esa relación no se pisa, se le pone fin, y la nueva empieza el mismo día. La misma pieza
       sirve al organigrama y al mapa de procesos. -->
  <AppModalShell
    v-if="Boolean(mover.peticion.value)"
    controlled
    :open="Boolean(mover.peticion.value)"
    :title="mover.peticion.value.padreId ? 'Cambiar de padre' : 'Desvincular'"
    content-class="max-w-md"
    @close="mover.cancelar"
  >
    <div class="flex flex-col gap-3">
      <p class="m-0 text-sm text-icon">
        <template v-if="mover.peticion.value.padreId">
          <strong>{{ mover.peticion.value.hijoNombre }}</strong> pasará a depender de
          <strong>{{ mover.peticion.value.padreNombre }}</strong>.
        </template>
        <template v-else>
          <strong>{{ mover.peticion.value.hijoNombre }}</strong> dejará de depender de su padre.
        </template>
        La relación actual ya rige, así que no se borra: termina ese día y queda en la historia.
      </p>
      <AppAlert v-if="mover.error.value" variant="danger">{{ mover.error.value }}</AppAlert>
      <div class="grid grid-cols-2 gap-3">
        <label class="deasy-form-label">
          Desde
          <input v-model="form.vigente_desde" type="date" class="deasy-control" />
        </label>
        <label class="deasy-form-label">
          Origen
          <select v-model="form.origen" class="deasy-control deasy-control--select">
            <option value="">—</option>
            <option value="carga_inicial">Carga inicial</option>
            <option value="reorganizacion">Reorganización</option>
          </select>
        </label>
      </div>
      <label v-if="form.origen === 'reorganizacion'" class="deasy-form-label">
        Acto que lo ordena
        <select v-model="form.acto_id" class="deasy-control deasy-control--select">
          <option value="">— Elige un acto —</option>
          <option v-for="acto in actoOptions" :key="acto.id" :value="String(acto.id)">{{ acto.etiqueta }}</option>
        </select>
      </label>
    </div>
    <template #footer>
      <AppButton variant="danger-outline" :disabled="mover.guardando.value" @click="mover.cancelar">Cancelar</AppButton>
      <AppButton
        variant="primary-outline"
        :disabled="mover.guardando.value || !mover.sePuedeConfirmar.value"
        @click="mover.confirmar"
      >{{ mover.guardando.value ? "Guardando…" : "Confirmar" }}</AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

const props = defineProps({
  /* Lo que devuelve `useMoverNodo`. */
  mover: { type: Object, required: true },
  /* [{ id, etiqueta }] — los actos entre los que elegir si el origen es una reorganización. */
  actoOptions: { type: Array, default: () => [] }
});
/* El formulario es del composable; aquí se edita por referencia, como en `NodeVigenciaPanel`. */
const form = computed(() => props.mover.form.value);
</script>
