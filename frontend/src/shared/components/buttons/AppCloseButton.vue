<template>
  <button
    type="button"
    class="deasy-btn--close inline-flex items-center justify-center transition-colors"
    :aria-label="label"
    :title="label"
    @click="$emit('click', $event)"
  >
    <IconX class="h-4 w-4" stroke-width="2.5" />
  </button>
</template>

<script setup>
/* LA ✕ DE CERRAR — un componente, no una variante de boton.
 *
 * POR QUE EXISTE (2026-08-14, G3)
 * Era `AppButton variant="close"`, y esa modelacion produjo el fallo que la hizo INVISIBLE en
 * los modales del perfil. Una variante es «el mismo boton, otro color». Esto es otro boton, y se
 * notaba en que rompia tres reglas que ninguna otra variante rompe:
 *
 *   1. Traia su propio contenido: `AppButton` tenia una rama `v-if="variant === 'close'"` solo
 *      para inyectar el icono, ignorando el slot. `AppFormModalLayout` le pasaba un `&times;`
 *      que nunca se renderizo.
 *   2. NO admite tamaño, y eso no estaba escrito en ningun sitio. Al recibir el `--md` por
 *      defecto, el `px-4 py-2` dejaba la caja interna de un boton de 36 px en **4 px**: el icono
 *      se aplastaba a 2 px de ancho y desaparecia.
 *   3. Siempre tiene la misma etiqueta y el mismo papel.
 *
 * Y como su contrato no estaba claro, DOS armazones —`AppModalShell` (que absorbio al otro el 2026-08-15) y `AppDialogOverlay`— se
 * saltaron el componente y copiaron el markup a mano. O sea que el mismo boton llegaba al DOM
 * por dos caminos y con tres combinaciones de clases distintas.
 *
 * Aqui no hay `variant` ni `size` que puedan estropearlo: **la combinacion invalida ya no se
 * puede escribir**, que es distinto de estar desaconsejada. La posicion sigue llegando por
 * `class` (`absolute right-4 top-4`), que es lo unico que un contenedor debe decidir.
 *
 * La caja, el color y el radio los pone `.deasy-btn--close` en `buttons.css`, una sola vez.
 */
import { IconX } from "@tabler/icons-vue";

defineProps({
  label: {
    type: String,
    default: "Cerrar"
  }
});

defineEmits(["click"]);
</script>
