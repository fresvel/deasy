<template>
  <!-- El texto que se acepta, para leerlo ANTES de marcar la casilla.
       ⚠️ El Art. 12 de la LOPDP no sólo dice QUÉ hay que informar: dice CUÁNDO — «de forma previa
       […] en el momento mismo de la recogida del dato personal». Un enlace que se lleva a otra
       página rompe el registro a medias; un modal deja leerlo sin perder lo escrito. -->
  <AppModalShell
    controlled
    :open="Boolean(documento)"
    labelled-by="documento-legal-title"
    :title="titulo"
    size="lg"
    @close="$emit('close')"
  >
    <article class="deasy-typography max-h-[60vh] overflow-y-auto text-sm" v-html="html" />

    <p class="mt-4 rounded-md border border-line bg-surface p-3 text-xs text-muted">
      <strong class="text-strong">Versión {{ documento?.version }}.</strong>
      Cuando aceptes, queda registrado que aceptaste <em>esta</em> versión y la huella de su texto,
      para que pueda comprobarse que no ha cambiado.
    </p>

    <template #footer>
      <AppButton variant="neutral-outline" class-name="w-full" @click="$emit('close')">
        Cerrar
      </AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed } from "vue";
import { marked } from "marked";

import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

import { TITULOS } from "../services/documentosLegalesService.js";

const props = defineProps({
  documento: { type: Object, default: null },
});
defineEmits(["close"]);

const titulo = computed(() => {
  if (!props.documento) return "";
  const nombre = TITULOS[props.documento.clase] ?? props.documento.clase;
  // Los títulos van en primera persona («el tratamiento de mis datos») para la casilla; aquí se
  // encabeza la lectura, así que se pone en mayúscula la primera letra y se quita el artículo.
  return nombre.replace(/^(los|el|la)\s+/i, "").replace(/^./, (c) => c.toUpperCase());
});

const html = computed(() => (props.documento?.texto ? marked.parse(props.documento.texto) : ""));
</script>
