<template>
  <div class="deasy-table-toolbar">
    <!-- LA FILA QUE DICE DONDE ESTAS. Existe SIEMPRE: si la pagina tiene variantes se llena con
         sus pestañas y si no, con el nombre de la tabla. Asi todas las paginas con tabla arrancan
         a la misma altura y no hay salto al navegar entre perfil y admin. -->
    <div class="deasy-table-toolbar__head">
      <slot name="tabs">
        <h2 v-if="title" class="deasy-title deasy-title--panel m-0">{{ title }}</h2>
      </slot>
    </div>

    <div class="deasy-table-toolbar__bar">
      <div class="deasy-table-toolbar__search">
        <slot name="search" />
      </div>
      <div class="deasy-table-toolbar__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup>
/* LA BARRA DE UNA PAGINA CON TABLA — F13.4, 2026-08-21.
 *
 * Antes de esto, los cuatro bloques de una pagina con tabla —acciones, pestañas, filtro y tabla—
 * aparecian en TRES ordenes distintos y ningun par de paginas coincidia. En `/perfil` el boton
 * «Agregar» flotaba SOBRE las pestañas y no habia buscador; en `/admin` habia buscador pero no
 * pestañas, y la barra de acciones caia **17 px mas a la derecha** que el filtro porque una vivia
 * dentro de un `deasy-card p-4` y la otra no.
 *
 * ⚠️ ESTE COMPONENTE NO DIBUJA CAJA. La pagina no lleva caja (F13.5) y la tabla ya trae la suya
 * (`deasy-table-responsive`): una mas seria el tercer borde concentrico. Aqui solo hay disposicion.
 *
 * ⚠️ Y NO TIENE VARIANTE «sin pestañas»: si no las hay, `#tabs` cae a su contenido por defecto, que
 * es el titulo. Un modificador para eso seria un `v-if` con nombre de clase.
 */
defineProps({
  /* El nombre de lo que se esta viendo. Solo se pinta si NADIE llena el slot `tabs`. */
  title: { type: String, default: "" }
});
</script>
