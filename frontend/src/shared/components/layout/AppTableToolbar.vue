<template>
  <div class="deasy-table-toolbar">
    <!-- FILA 1 · LAS PESTAÑAS, Y EXISTE SIEMPRE.
         ⚠️ AQUI HABIA UNA FILA DE TITULO Y SE RETIRO (2026-08-22, idea del dueño). Medido en 7
         rutas: **el titulo repetia lo que la cabecera de la aplicacion ya dice en las 7**, y en
         `/admin/gestiones/firmas/signature_flow_steps` repetia ademas la pestaña activa. Era la
         tercera vez que la pantalla decia lo mismo, contando el menu lateral.

         Y al quitarla se resuelve el salto que quedaba: la fila de pestañas **solo existia si
         habia pestañas**, asi que `/perfil/certificacion` —la unica seccion sin subsecciones—
         arrancaba la tabla 56 px mas arriba que sus cinco hermanas. Ahora la fila esta siempre: si
         la pagina no tiene pestañas se pinta UNA, con el nombre y con foco.

         ⚠️ Esa unica pestaña es un `<span>` y no un `<button>`, y el bloque no lleva `role="tablist"`:
         no hay a donde ir. Fingir un tablist de un elemento le diria a un lector de pantalla que
         hay algo que elegir. Lleva `aria-current="page"`, que es lo que de verdad significa. -->
    <div class="deasy-table-toolbar__tabs">
      <slot name="tabs">
        <div v-if="title" class="deasy-inline-tabs">
          <span class="deasy-inline-tab deasy-inline-tab--active" aria-current="page">{{ title }}</span>
        </div>
      </slot>
    </div>

    <!-- FILA 2 · LAS PESTAÑAS ANIDADAS, cuando la pestaña activa del nivel 1 las tiene.
         ⚠️ Van DEBAJO de las de nivel 1 y no las sustituyen: el dueño lo pidio explicito —«se debe
         mantener las pestañas originales en su lugar y mostrar las anidadas abajo»—. -->
    <div v-if="$slots.subtabs" class="deasy-table-toolbar__subtabs">
      <slot name="subtabs" />
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
