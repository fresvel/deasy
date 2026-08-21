<template>
  <!-- EL MARCO Y SU TOPE DE ANCHO VIVEN EN `layout.css` DESDE F13 (2026-08-20).
       Antes esta plantilla escribia `px-3 py-4 sm:px-4 lg:px-5` y `max-w-(--breakpoint-2xl)` a
       mano, y la clase `deasy-workspace-content` —que el armazon le pasaba desde fuera— solo
       declaraba la mitad. Con el marco partido en dos sitios no habia un nombre que vigilar: un
       padding escrito en una plantilla no lo puede proteger ningun gate. -->
  <main class="deasy-workspace-content">
    <div class="deasy-page">
      <slot></slot>
    </div>
  </main>
</template>

<script setup>
/* ⚠️ AQUI HABIA TRES PROPS QUE NO USABA NADIE: `showmenu`, `shownotify` y `shownavmenu`. Ninguna
   se leia en la plantilla —que no tiene ni una expresion— y la tercera ni siquiera se pasaba. El
   armazon enviaba las otras dos y se perdian en `attrs`. Retiradas en F13; es el mismo hallazgo
   que F1.3c hizo con los tres `AdminDefinition*`: ficheros cuyo unico trabajo era declarar props
   para no usarlas. */
</script>
