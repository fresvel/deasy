<template>
  <!-- Variante embebida de AppModalShell: misma API de slots (default = cuerpo, #footer) pero SIN overlay ni
       header, para hospedar el contenido de un modal dentro de otro (p. ej. el wizard de crear como pestaña). -->
  <div>
    <div class="deasy-dialog-body">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="deasy-dialog-footer flex flex-wrap items-center justify-end gap-3"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script>
// inheritAttrs: false → los props específicos de modal (title, labelled-by, size…) que reciba vía <component :is>
// no se vuelcan como atributos sueltos en el div.
export default { inheritAttrs: false };
</script>
