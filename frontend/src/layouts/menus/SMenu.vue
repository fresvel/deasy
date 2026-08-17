<template>
  <!-- ⚠️ EL ANCHO DE ESCRITORIO LO DECIDE EL ESTADO, y por eso vive en el `:class` de la aside y
       no en el CSS de su contenido: la aside es quien ocupa la columna, asi que estrechar solo lo
       de dentro no devolveria el espacio al area de datos. Ese fue justo el fallo del 2026-08-16 —
       al cerrar el panel quedaba una franja de 282 px, oscura y VACIA, a la izquierda del
       contenido. `w-22` son 88 px (el rail de iconos) y es escalon de la escala de Tailwind, no un
       valor arbitrario.

       🪤 Y el comentario va AQUI, fuera de la etiqueta: dentro de `<aside …>` el compilador de Vue
       muere con «Duplicate attribute», que no dice ni una palabra sobre comentarios. Segunda vez
       en el mismo dia. -->
  <aside
    class="fixed left-0 top-[60px] z-40 flex h-[calc(100vh-60px)] w-[282px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white transition-all duration-300 [scrollbar-width:none] xl:sticky xl:top-[60px] xl:h-[calc(100vh-60px)] xl:translate-x-0 xl:overflow-visible [&::-webkit-scrollbar]:hidden"
    :class="show
      ? 'translate-x-0 shadow-[18px_0_36px_rgba(var(--elev-ink-rgb),0.24)] xl:shadow-none'
      : '-translate-x-[110%] xl:w-22 xl:translate-x-0'"
  >
    <slot></slot>
  </aside>

  <div
    v-if="show"
    class="fixed inset-0 top-[60px] z-30 bg-navy/28 transition-opacity duration-300 xl:hidden"
    @click="$emit('close-mobile')"
    aria-hidden="true"
  ></div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";

defineProps({
  show: {
    type: Boolean,
    default: true
  }
});

defineEmits(["close-mobile"]);
</script>
