<template>
  <!-- Dónde estás de los tres. Sin esto, alguien que llega a la pantalla del código no sabe si le
       queda un paso o cinco, y abandonar es gratis. -->
  <ol class="mb-8 flex items-center gap-2" aria-label="Progreso del registro">
    <li v-for="(nombre, indice) in PASOS" :key="nombre" class="flex flex-1 items-center gap-2">
      <!-- La caja de icono es del sistema de diseño: `deasy-icon-box` + tamaño + tono. Escribirla a
           mano con `h-7 w-7 rounded-full` la deja fuera del sistema, y hay una puerta que lo caza. -->
      <span
        class="deasy-icon-box deasy-icon-box--sm deasy-icon-box--round shrink-0 text-xs font-semibold"
        :class="claseDelPaso(indice)"
        :aria-current="indice === actual ? 'step' : undefined"
      >{{ indice + 1 }}</span>
      <span class="text-xs font-medium" :class="indice === actual ? 'text-strong' : 'text-muted'">
        {{ nombre }}
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
