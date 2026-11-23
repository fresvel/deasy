<template>
  <!-- LAS VIDAS DE UN NODO (frente 27, D-03). Arriba va la vida en curso, o el formulario para abrir
       una; abajo, las anteriores. Sin ninguna vida el nodo es un borrador. La misma pieza sirve al
       mapa de procesos y al organigrama: lo que cambia es el `sujeto` con que se nombra al nodo. -->
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <p class="deasy-overline">{{ vigencia.tituloDeLaVida.value }}</p>
      <AppTag :variant="tonoVigencia(estado)" outlined>{{ etiquetaVigencia(estado) }}</AppTag>
    </div>

    <!-- La última vida terminó: se puede abrir otra, pero no sin pedirlo. -->
    <div v-if="vigencia.vidaModo.value === 'cerrada'" class="flex flex-col items-start gap-3">
      <p class="m-0 text-sm text-icon">{{ sujeto }} sin vida en curso. Reactivar abre una vida nueva; la anterior queda en su historia.</p>
      <AppButton v-if="editable" variant="primary-outline" @click="$emit('reactivar')">Reactivar</AppButton>
    </div>

    <div v-else class="flex flex-col gap-3">
      <div class="grid grid-cols-2 gap-3">
        <label class="deasy-form-label">
          Rige desde
          <input v-model="form.vigente_desde" type="date" class="deasy-control" :disabled="!editable" />
        </label>
        <label class="deasy-form-label">
          Origen del inicio
          <select v-model="form.inicio_origen" class="deasy-control deasy-control--select" :disabled="!editable">
            <option value="">—</option>
            <option value="carga_inicial">Carga inicial</option>
            <option value="reorganizacion">Reorganización</option>
          </select>
        </label>
      </div>
      <label v-if="form.inicio_origen === 'reorganizacion'" class="deasy-form-label">
        Acto que lo ordena
        <select v-model="form.inicio_acto_id" class="deasy-control deasy-control--select" :disabled="!editable">
          <option value="">— Elige un acto —</option>
          <option v-for="acto in vigencia.actoOptions.value" :key="acto.id" :value="String(acto.id)">{{ acto.etiqueta }}</option>
        </select>
      </label>
      <!-- El fin sólo se ofrece sobre una vida que ya existe: una vida nueva se abre, no nace cerrada. -->
      <template v-if="vigencia.vidaModo.value === 'editar'">
        <div class="grid grid-cols-2 gap-3">
          <label class="deasy-form-label">
            Rige hasta
            <input v-model="form.vigente_hasta" type="date" class="deasy-control" :disabled="!editable" />
          </label>
          <label class="deasy-form-label">
            Origen del fin
            <select v-model="form.fin_origen" class="deasy-control deasy-control--select" :disabled="!editable || !form.vigente_hasta">
              <option value="">—</option>
              <option value="carga_inicial">Carga inicial</option>
              <option value="reorganizacion">Reorganización</option>
            </select>
          </label>
        </div>
        <label v-if="form.fin_origen === 'reorganizacion'" class="deasy-form-label">
          Acto que lo suprime
          <select v-model="form.fin_acto_id" class="deasy-control deasy-control--select" :disabled="!editable">
            <option value="">— Elige un acto —</option>
            <option v-for="acto in vigencia.actoOptions.value" :key="acto.id" :value="String(acto.id)">{{ acto.etiqueta }}</option>
          </select>
        </label>
        <p class="m-0 text-theme-xs text-muted">«Rige hasta» es el primer día en que ya no rige.</p>
      </template>
    </div>

    <div v-if="vigencia.vidasAnteriores.value.length">
      <p class="deasy-overline mb-2">Vidas anteriores</p>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="vida in vigencia.vidasAnteriores.value" :key="vida.id" class="rounded-xl border border-line px-3 py-2.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-strong">{{ vida.vigente_desde }} → {{ vida.vigente_hasta || "sin fecha de fin" }}</span>
            <AppTag :variant="tonoVigencia(vida.estado)" outlined class-name="ml-auto">{{ etiquetaVigencia(vida.estado) }}</AppTag>
          </div>
          <p class="m-0 mt-1 text-theme-xs text-muted">
            Inicio: {{ etiquetaOrigen(vida.inicio_origen) }}<span v-if="vida.inicio_acto_numero"> · {{ vida.inicio_acto_numero }}</span>
            <template v-if="vida.vigente_hasta">
              · Fin: {{ etiquetaOrigen(vida.fin_origen) }}<span v-if="vida.fin_acto_numero"> · {{ vida.fin_acto_numero }}</span>
            </template>
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { etiquetaOrigen } from "@/modules/admin/composables/estructura/useNodeVigencia.js";

const props = defineProps({
  /* Lo que devuelve `useNodeVigencia`. Se pasa entero: la pestaña es la cara de ese estado. */
  vigencia: { type: Object, required: true },
  /* El estado del nodo hoy: borrador, programado, vigente o suprimido. */
  estado: { type: String, default: "borrador" },
  /* Cómo se nombra al nodo en la frase de reactivar: «Proceso», «Unidad»… */
  sujeto: { type: String, default: "Nodo" },
  editable: { type: Boolean, default: false }
});
defineEmits(["reactivar"]);

/* El formulario vive en el composable; aquí sólo se le da un nombre corto para la plantilla. */
const form = computed(() => props.vigencia.vidaForm.value);
</script>
