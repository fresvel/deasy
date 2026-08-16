<template>
  <AppButton
    variant="dangerSoft"
    size="sm"
    icon-only
    :title="label"
    :aria-label="label"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <IconTrash class="h-5 w-5" />
  </AppButton>
</template>

<script setup>
/* EL BOTON DE ELIMINAR — un componente, como la ✕, y por los mismos motivos.
 *
 * Se llamaba `BtnDelete` y venia de antes del sistema de diseno. Cumple las tres senales de
 * §1-bis igual que `AppCloseButton`: trae su propio contenido (el icono), no admite variante ni
 * tamano, y su papel es siempre el mismo. Asi que sobrevive como componente — lo que NO sobrevive
 * es como estaba escrito (2026-08-15, G5):
 *
 *   1. **El icono era un `<svg>` de 24 nodos pegado a mano** en vez del `IconTrash` que usa el
 *      resto del repo. Dos papeleras distintas en la misma pantalla.
 *   2. **Emitia `onpress`, no `click`.** Un contrato inventado que obliga a recordarlo en cada
 *      uso y que ningun otro componente del sistema comparte.
 *   3. **Aceptaba `className`**, o sea estilo viajando por el atributo — justo lo que la fase 3
 *      viene a quitar. `MultiSignerPanel` lo usaba para un `mx-0 self-center` que no hace falta.
 *   4. Y el fallo que prueba que el contrato no estaba claro: ese mismo uso le pasaba
 *      **`variant="dangerSoft"`, una prop que `BtnDelete` NO declara**. Vue la deja pasar como
 *      atributo suelto al `<button>` del DOM y no falla nada. `check-variants` no lo veia porque
 *      solo mira los mapas de `AppButton`.
 *
 * `disabled` si se queda: es estado, no aspecto. */
import { IconTrash } from "@tabler/icons-vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";

defineProps({
  label: {
    type: String,
    default: "Eliminar"
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(["click"]);
</script>
