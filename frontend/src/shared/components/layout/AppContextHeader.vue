<template>
  <div class="deasy-context-header">
    <div class="deasy-context-header__copy">
      <div class="deasy-context-header__title">{{ title }}</div>
      <div v-if="subtitle" class="deasy-context-header__subtitle">{{ subtitle }}</div>
    </div>
  </div>
</template>

<script setup>
/* LA CABECERA DE CONTEXTO de la barra superior — el título de dónde estás, con su subtítulo.
 *
 * Estaba copiada **seis veces byte a byte**: `AdminView`, `HomeView`, `ProcessManagementView`,
 * `PerfilView`, `SignatureCenterView` y `DocumentCenterView`. Lo único que cambiaba entre las seis
 * eran las dos expresiones del contenido; la estructura —tres `<div>` anidados y el `v-if` del
 * subtítulo— era idéntica.
 *
 * No es un colapso de CSS: las cuatro clases ya estaban bien y siguen igual. Es un colapso de
 * PLANTILLA, que es la mitad del problema que ningún gate de CSS puede ver: `css-prune` daba verde
 * —la clase tenía consumidores— y `check-orphan-classes` también. Seis copias de un markup son seis
 * sitios donde tocar el día que cambie, y cinco oportunidades de que una se quede atrás.
 *
 * Va sobre la barra oscura, y por eso sus colores son blancos con alfa y no tokens de superficie.
 */
defineProps({
  title: {
    type: String,
    default: "",
  },
  /* Opcional a propósito: dos de las seis vistas no lo tienen (Centro de firmas y Centro
     documental), y las otras cuatro lo pasan desde un `computed` que puede venir vacío. */
  subtitle: {
    type: String,
    default: "",
  },
});
</script>
