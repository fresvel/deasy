<template>
  <span :class="classes">
    <span v-if="dot" class="deasy-tag__dot" />
    <slot />
  </span>
</template>

<script>
/* ⚠️ LOS MAPAS VAN EN UN `<script>` NORMAL, NO EN EL `setup`, y no es estilo: es obligatorio.
 * `defineProps()` se eleva fuera de `setup()`, asi que su `validator` NO puede referenciar una
 * variable declarada dentro — el build falla con «cannot reference locally declared variables».
 *
 * La alternativa que usa `AppAlert` es un array literal dentro del propio validator, pero eso
 * duplicaria la lista de variantes: una en el validator y otra en el mapa. Con el `<script>`
 * aparte hay UNA lista, que es lo que `check-variants.mjs` lee. */

/* El vocabulario cerrado. `muted` murio el 2026-08-15: declaraba el mismo cuerpo que `neutral`. */
export const variantClassMap = {
  success: "deasy-tag--success",
  warning: "deasy-tag--warning",
  danger: "deasy-tag--danger",
  info: "deasy-tag--info",
  salmon: "deasy-tag--salmon",
  accent: "deasy-tag--accent",
  primary: "deasy-tag--primary",
  neutral: "deasy-tag--neutral"
};

/* [2026-08-20] `sizeClassMap` SE QUEDA CON UNA SOLA ENTRADA, y no es un resto: es el contrato.
 *
 * La pastilla tiene UNA talla desde que murio `deasy-tag--sm` (mismo argumento que el `sm` del
 * boton en F5.4: no era una variante, era el contexto cambiando el objeto). El mapa sobrevive
 * porque `check-variants.mjs` lo LEE para validar los `size="…"` de las plantillas: si se borrara,
 * un `size="sm"` olvidado dejaria de fallar y volveria a producir una clase inexistente —que es
 * justo el defecto que F3.3 cerro en este componente.
 *
 * O sea: el mapa no esta aqui para elegir, esta aqui para NEGAR. */
export const sizeClassMap = {
  md: ""
};
</script>

<script setup>
/* LA PASTILLA DE ESTADO.
 *
 * ⚠️ HASTA F3.3 ESTE COMPONENTE NO VALIDABA NADA. Componia `deasy-tag--${variant}` por
 * interpolacion, asi que `variant="rojo"` producia una clase inexistente, la pastilla salia sin
 * color y no fallaba ni el build, ni el lint, ni los tests. Es el mismo defecto que `AppButton`
 * tenia y que cerro la tarea 3.2, con un agravante: aqui una pastilla sin variante es
 * **invisible** —fondo transparente sobre fondo blanco—, mientras un boton sin variante al menos
 * conserva su caja.
 *
 * Ahora hay tres capas, y las tres YA existian en el repo; no se inventa nada:
 *   · `variantClassMap` resuelve por PERTENENCIA, como `AppButton`. Lo desconocido cae a
 *     `neutral`, no a cadena vacia, para que el fallo se vea gris en vez de desaparecer.
 *   · `validator` en `defineProps`, como `AppAlert`, que avisa por consola en desarrollo.
 *   · `check-variants.mjs`, que lee ESTE mismo mapa —no una copia— y falla el build si una
 *     plantilla pide una variante que no esta aqui.
 */
import { computed } from "vue";

const props = defineProps({
  variant: {
    type: String,
    default: "info",
    validator: (v) => Object.hasOwn(variantClassMap, v)
  },
  size: {
    type: String,
    default: "md",
    validator: (v) => Object.hasOwn(sizeClassMap, v)
  },
  /* Con borde. Sobre una superficie tintada —el lienzo del grafo— el relleno `-50` no se
     distingue del fondo, y el borde es lo unico que dibuja la pastilla. */
  outlined: {
    type: Boolean,
    default: false
  },
  /* Un punto del color del tono antes de la etiqueta. */
  dot: {
    type: Boolean,
    default: false
  },
  className: {
    type: [String, Array, Object],
    default: ""
  }
});

const classes = computed(() => [
  "deasy-tag",
  variantClassMap[props.variant] ?? variantClassMap.neutral,
  sizeClassMap[props.size] ?? "",
  props.outlined ? "deasy-tag--outlined" : "",
  props.className
]);
</script>
