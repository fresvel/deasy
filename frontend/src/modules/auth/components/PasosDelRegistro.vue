<template>
  <!-- Dónde estás de los tres. Sin esto, quien llega a la pantalla del código no sabe si le queda un
       paso o cinco, y abandonar es gratis.

       ⚠️ NO SE ESTIRA. Antes cada paso llevaba `flex-1` y, en un contenedor ancho, los tres quedaban
       separados por medio metro de nada: parecía roto. Un indicador de progreso es una FRASE
       --«vas por el 3 de 3»-- y las frases no se justifican. Se centra y se le pone una raya entre
       pasos, que es lo que dice que van seguidos. -->
  <ol class="flex flex-wrap items-center justify-center gap-3" aria-label="Progreso del registro">
    <li v-for="(nombre, indice) in PASOS" :key="nombre" class="flex items-center gap-3">
      <span v-if="indice > 0" class="h-px w-6 bg-line" aria-hidden="true" />
      <span class="flex items-center gap-2">
        <span
          class="deasy-icon-box deasy-icon-box--sm deasy-icon-box--round shrink-0 text-xs font-semibold"
          :class="claseDelPaso(indice)"
          :aria-current="indice === actual ? 'step' : undefined"
        >{{ indice + 1 }}</span>
        <span class="text-xs font-medium" :class="indice === actual ? 'text-strong' : 'text-muted'">
          {{ nombre }}
        </span>
      </span>
    </li>
  </ol>
</template>

<script setup>
import { computed } from "vue";

const PASOS = ["Tus datos", "Tu correo", "Tu teléfono"];
const ORDEN = { datos: 0, correo: 1, telefono: 2 };

const props = defineProps({
  paso: { type: String, required: true },
});

const actual = computed(() => ORDEN[props.paso] ?? 0);

// El tono lo pone el sistema: hecho, en curso, y lo que aún no toca.
const claseDelPaso = (indice) => {
  if (indice < actual.value) return "deasy-icon-box--success deasy-icon-box--solid";
  if (indice === actual.value) return "deasy-icon-box--primary deasy-icon-box--solid";
  return "deasy-icon-box--neutral";
};
</script>
