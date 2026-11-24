<template>
  <!-- EL ESTADO DE UN NODO DEL MAPA, EN UN CÍRCULO JUNTO A SU NOMBRE (decisión del dueño, 2026-11-24).
       Sustituye al punto con el texto «Vigente» que ocupaba la fila de abajo en todos los nodos.
       Lleva un ICONO DISTINTO POR ESTADO, no una «i»: así la forma dice el estado aunque no se
       distinga el color —el visto de lo que rige, el reloj de lo programado, el lápiz del borrador,
       el círculo tachado de lo suprimido—. El nombre del estado va en `title`, para quien pase el
       ratón, y en `aria-label`, para quien no lo vea.
       Las letras no desaparecen del todo: quien usa esto las sigue escribiendo cuando el estado NO
       es el normal. «Vigente» en 15 de 17 nodos no aporta leerlo; «Suprimida», sí. -->
  <span
    class="graph-node__estado"
    :class="`graph-node__estado--${tono}`"
    role="img"
    :title="etiqueta"
    :aria-label="etiqueta"
  >
    <component :is="ICONO[tono] || IconPencil" class="h-3 w-3" />
  </span>
</template>

<script setup>
import { computed } from "vue";
import { IconBan, IconCheck, IconClock, IconPencil, IconX } from "@tabler/icons-vue";
import { etiquetaCicloVida, etiquetaVigencia, tonoCicloVida, tonoVigencia } from "@/shared/utils/estadoTono.js";

const props = defineProps({
  /* Qué clase de estado es: la `vigencia` de una unidad o un proceso, o el `ciclo` de vida de una
     configuración o de una versión de entregable. */
  eje: { type: String, default: "vigencia" },
  valor: { type: String, default: "" },
  /* El nodo es de género femenino (una unidad): «Suprimida», «Programada». */
  femenino: { type: Boolean, default: false }
});

/* El icono sale del TONO, que es lo que los dos ejes tienen en común: lo que está bien, lo que
   informa, lo que aún no existe, lo que dejó de estar y lo que está mal. */
const ICONO = Object.freeze({ success: IconCheck, info: IconClock, neutral: IconPencil, warning: IconBan, danger: IconX });

const tono = computed(() => (props.eje === "ciclo" ? tonoCicloVida(props.valor) : tonoVigencia(props.valor)));
const etiqueta = computed(() =>
  (props.eje === "ciclo" ? etiquetaCicloVida(props.valor) : etiquetaVigencia(props.valor, { femenino: props.femenino })));
</script>
