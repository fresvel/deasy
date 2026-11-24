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
      </p>
      <AppAlert v-if="mover.error.value" variant="danger">{{ mover.error.value }}</AppAlert>
      <label class="deasy-form-label">
        Qué pasó
        <select v-model="form.origen" class="deasy-control deasy-control--select">
          <option value="">—</option>
          <option v-for="origen in mover.peticion.value.origenes" :key="origen" :value="origen">{{ ROTULO[origen] }}</option>
        </select>
      </label>
      <!-- UNA CORRECCIÓN no tiene fecha: la relación estaba mal registrada desde el principio, y se
           arregla en su sitio. Lo que pide es el motivo. -->
      <template v-if="form.origen === 'correccion'">
        <p class="m-0 text-theme-xs text-muted">
          Se cambia el padre de la relación actual, sin abrir otra. Lo que decía antes queda en la bitácora de correcciones.
        </p>
        <label class="deasy-form-label">
          Motivo de la corrección
          <textarea v-model="form.motivo" rows="2" class="deasy-control" placeholder="Qué estaba mal registrado y por qué"></textarea>
        </label>
      </template>
      <template v-else-if="form.origen">
        <p v-if="mover.peticion.value.relacionVigente" class="m-0 text-theme-xs text-muted">
          La relación actual no se borra: termina ese día y queda en la historia.
        </p>
        <label class="deasy-form-label">
          Desde
          <input v-model="form.vigente_desde" type="date" class="deasy-control" />
        </label>
        <label v-if="form.origen === 'reorganizacion'" class="deasy-form-label">
          Acto que lo ordena
          <select v-model="form.acto_id" class="deasy-control deasy-control--select">
            <option value="">— Elige un acto —</option>
            <option v-for="acto in actoOptions" :key="acto.id" :value="String(acto.id)">{{ acto.etiqueta }}</option>
          </select>
        </label>
      </template>
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

/* «Qué pasó» y no «Origen»: es la pregunta que decide todo lo demás del diálogo. */
const ROTULO = {
  carga_inicial: "Carga inicial — así estaba al cargar el sistema",
  reorganizacion: "Reorganización — la institución lo movió",
  correccion: "Corrección — estaba mal registrado"
};
</script>
