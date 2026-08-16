<template>
  <main class="flex min-w-0 flex-1 flex-col w-full bg-surface px-3 py-4 transition-all duration-300 sm:px-4 lg:px-5">
    <!-- EL TOPE DE ANCHO — adoptado de TailAdmin el 2026-08-16 (F4.C, delta 1).
         Su contenedor de pagina es `mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6`; aqui no habia
         tope, asi que el contenido se estiraba de borde a borde sin limite. En una ventana de 2560
         el area util pasaba de 2000 px y las lineas de texto se volvian ilegibles de largas.

         ⚠️ NO SE NOTA por debajo de ~1960 px de ventana (1536 de tope + 424 de barra lateral), asi
         que en un portatil el cambio es CERO. Se comprueba en un monitor ancho, no a simple vista. -->
    <div class="mx-auto h-full w-full max-w-(--breakpoint-2xl) pb-6">
      <slot></slot>
    </div>
  </main>
</template>

<script setup>
import { defineProps } from "vue";

defineProps({
    showmenu: {
        type: Boolean,
        default: false
    },
    shownotify: {
        type: Boolean,
        default: false
    },
    shownavmenu: {
        type: Boolean,
        default: false
    }
});
</script>
