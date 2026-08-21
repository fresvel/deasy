<template>
  <div class="deasy-table-toolbar">
    <!-- FILA 1 · SOLO EL TITULO: dice QUE estas viendo, y nada mas.
         ⚠️ Aqui hubo DOS intentos fallidos, los dos vistos por el dueño y no por un gate.
         (1) El titulo era el contenido POR DEFECTO del slot `tabs`, asi que en cuanto una pagina
             traia pestañas **el nombre desaparecia**: en `/perfil/formacion` no se sabia que tabla
             era.
         (2) Se pintaron los dos en esta misma fila, y quedaba el titulo pegado a las pestañas.
         Lo correcto es lo que admin ya hacia: **el titulo tiene su linea** y lo que FILTRA baja a
         la fila de abajo. Y las pestañas son un filtro, igual que el buscador: eligen que porcion
         de la tabla ves. Por eso comparten sitio y por eso las dos familias quedan identicas. -->
    <div class="deasy-table-toolbar__head">
      <h2 v-if="title" class="deasy-title deasy-title--panel m-0">{{ title }}</h2>
    </div>

    <!-- FILA 2 · LAS PESTAÑAS, en su propia linea y debajo del titulo.
         ⚠️ No van dentro de `__head` —quedaban pegadas al titulo— ni dentro de `__filtro`, que es
         para lo que filtra FILAS. Una pestaña elige QUE TABLA o QUE PORCION ves, que es navegacion,
         no filtrado: en `/admin` son las tablas hermanas y en `/perfil` las subsecciones.
         Antes de esto, las de admin las pintaba `AdminTableManager` con marcado en linea **antes**
         de la seccion, asi que el titulo salia DEBAJO de ellas en admin y ENCIMA en perfil. Lo vio
         el dueño; era el tercer sintoma del mismo problema. -->
    <div v-if="$slots.tabs" class="deasy-table-toolbar__tabs">
      <slot name="tabs" />
    </div>

    <div class="deasy-table-toolbar__bar">
      <!-- FILA 2 · A la izquierda lo que FILTRA —el buscador en admin, las pestañas en perfil—; a
           la derecha las acciones.
           ⚠️ El `v-if` no es opcional: sin el, una pagina que no filtra pintaba una caja VACIA de
           1348 px de ancho y altura 0 dentro de la fila. -->
      <div v-if="$slots.filtro" class="deasy-table-toolbar__filtro">
        <slot name="filtro" />
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
