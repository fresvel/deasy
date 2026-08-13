<template>
  <div class="deasy-alert" :class="`deasy-alert--${variant}`" role="alert">
    <slot />
  </div>
</template>

<script setup>
/*
 * La alerta en línea: un mensaje de estado dentro de un formulario o un panel.
 *
 * POR QUE EXISTE
 * El mismo trío `bg-X-50 + border-X-200 + text-X-700` estaba copiado a mano **15 veces** solo en su
 * variante de error, en 12 ficheros, y con derivas entre copias (`rounded-2xl` en unas, `mb-3` en
 * otras, `font-medium` en unas sí). Renombrar esos colores a la paleta adoptada habría sido lateral
 * y además habría CONSERVADO el fallo: los tintes `-200` como borde miden 1.21–1.49:1 y no cumplen
 * WCAG 1.4.11. El trío repetido no era un color mal puesto: era este componente, que faltaba.
 *
 * DE DONDE SALE EL COLOR
 * De la receta de `frontend/CLAUDE.md` §2.4, no de un tinte elegido a ojo: el borde se deriva al
 * 71 % sobre blanco —el porcentaje al que llega a 3:1— y el relleno al 6 %, que es el que deja
 * pasar AA al texto que lleva encima (al 10 % `--color-warning` da 4.39 y NO pasa).
 * La variante declara un único token en `--tone` y una regla común lo gasta.
 */
defineProps({
  variant: {
    type: String,
    default: "danger",
    validator: (v) => ["danger", "warning", "success", "info"].includes(v),
  },
});
</script>
