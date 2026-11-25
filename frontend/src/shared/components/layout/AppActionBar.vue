<template>
  <div class="deasy-action-bar">
    <slot />
  </div>
</template>

<script setup>
/* LA BARRA DE ACCIONES DE UNA PANTALLA — los botones alineados a la derecha, encima del contenido.
 *
 * ⚠️ NO ES UNA CABECERA, y ése es el hallazgo que la hizo nacer. La caja se llamaba
 * `admin-page-header` y su plantilla era, literalmente:
 *
 *     <div class="admin-page-header">
 *       <div class="admin-page-header__main" />        <-- vacío, autocerrado
 *       <div class="admin-page-header__actions"> … </div>
 *     </div>
 *
 * En los DOS componentes que la usaban —`AdminTableHeader` y `ProfileSectionShell`— la mitad
 * «título» estaba vacía **por diseño**, no por accidente: un `space-between` con un hueco a la
 * izquierda para empujar los botones a la derecha. Es un `justify-end` escrito con un elemento de
 * relleno, y arrastraba consigo el nombre equivocado: quien leía `admin-page-header` daba por hecho
 * que ahí había un título.
 *
 * El plan de F3.4 los describía como «el mismo componente escrito dos veces». Al leerlos no lo son:
 * uno tiene tres botones de admin y el otro uno de perfil. Lo que sí estaba duplicado —y es lo que
 * este componente colapsa— es **la caja**. Los botones se quedan donde estaban, en su slot.
 *
 * `admin-page-header` sigue vivo para los usos que SÍ llevan título (`HomeView`), y ésos son
 * material del `AppPageHeader` que el plan describe: otro colapso, con el hero dentro.
 */
</script>
