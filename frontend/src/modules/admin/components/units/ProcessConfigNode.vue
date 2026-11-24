<template>
  <div
    class="graph-node graph-node--config relative rounded-2xl rounded-tl-none border-l-4 px-2.5 py-2 transition-all"
    :class="[statusBorderClass, data.highlighted ? 'graph-node--resaltado' : '']"
    :title="data.definition_name"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle graph-node__handle--sm" />
    <!-- Qué clase de nodo es, como en el proceso. La franja de estado de la izquierda sube con ella. -->
    <span class="graph-node__tipo graph-node__tipo--sm graph-node__tipo--franja"><span class="graph-node__tipo-texto">Configuración</span></span>

    <div v-if="hover && data.editable" class="nodrag nopan graph-node__toolbar graph-node__toolbar--sm">
      <button v-if="data.status === 'draft'" type="button" class="graph-node__btn graph-node__btn--sm" title="Agregar entregable" @click.stop="data.onAddTemplate?.(data)">
        <IconFilePlus class="h-4 w-4" />
      </button>
      <button v-if="data.status !== 'draft'" type="button" class="graph-node__btn graph-node__btn--sm" title="Versionar configuración" @click.stop="data.onVersion?.(data)">
        <IconGitBranch class="h-4 w-4" />
      </button>
      <button type="button" class="graph-node__btn graph-node__btn--sm" title="Agregar configuración hermana" @click.stop="data.onAddSibling?.(data)">
        <IconPlus class="h-4 w-4" />
      </button>
    </div>
    <p class="m-0 flex items-center gap-2">
      <span class="min-w-0 flex-1 truncate text-theme-xs font-semibold text-body">{{ data.definition_name }}</span>
    </p>
    <!-- El estado y los entregables, sin caja: como en la unidad y el proceso. -->
    <p class="m-0 mt-1 flex flex-wrap items-center gap-3">
      <span class="graph-node__dato" :class="[`graph-node__dato--${tonoEstado}`, tonoEstado === 'success' ? '' : 'graph-node__dato--destaca']">
        <span class="graph-node__punto"></span>{{ statusLabel }}
      </span>
    </p>
    <!-- LOS ENTREGABLES CUELGAN DE UNA PESTAÑA CENTRADA. La configuración sólo tiene una clase de
         hijos, así que no hay lado que elegir: va en el eje, donde entra la línea por arriba y de
         donde sale hacia el entregable, que el trazado coloca justo debajo. -->
    <div v-if="data.templatesCount" class="nodrag graph-node__rama graph-node__rama--centro" :class="data.templatesExpanded ? '' : 'graph-node__rama--cerrada'">
      <button
        type="button"
        class="graph-node__rama-boton"
        :title="data.templatesExpanded ? 'Ocultar entregables' : 'Mostrar entregables'"
        @click.stop="data.onToggleTemplates?.(data.definition_id)"
      >
        <IconChevronRight class="h-3 w-3 transition-transform" :class="data.templatesExpanded ? 'rotate-90' : ''" />
        {{ data.templatesCount }} entregable{{ data.templatesCount === 1 ? "" : "s" }}
      </button>
      <Handle type="source" :position="Position.Bottom" class="graph-node__handle graph-node__handle--sm" />
    </div>
    <Handle v-else type="source" :position="Position.Bottom" class="graph-node__handle graph-node__handle--sm graph-node__handle--hidden" />
  </div>
</template>

<script setup>
import { tonoCicloVida } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconChevronRight, IconFilePlus, IconGitBranch, IconPlus } from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});
const hover = ref(false);

const statusLabel = computed(() => ({ active: "Activa", draft: "Borrador", retired: "Retirada" }[props.data.status] || props.data.status));
// El estado se lee por el borde izquierdo y por la etiqueta; el fondo NO lo tiñe.
//
// Aquí hubo tres tintes de fondo —emerald, amber y el gris de superficie, los tres al 40 %—
// que nunca se llegaron a ver: el `<style scoped>` del componente declaraba `background:#fff`
// y, al no estar en ninguna capa, ganaba a las utilidades de Tailwind. Se quitaron porque el
// tinte no añade información que el borde y la etiqueta no den ya, y sí resta contraste.
//
// ⚠️ Los nombres de esas clases van DESCRITOS y no escritos a propósito. Este comentario lo
// han reescrito CUATRO scripts de migración distintos (F4.1, F4.4-a, F4.4-d y uno anterior),
// porque contenía literales que sus expresiones regulares casaban. Un reemplazo masivo no
// distingue código de prosa. Si vuelves a nombrarlas aquí, volverá a pasar.
/* El borde izquierdo tiñe el nodo entero con el mismo tono que su pastilla: antes decia AMBAR
   para `draft` mientras el chip decia neutral, para el mismo dato y a dos centimetros. */
const statusBorderClass = computed(() => `graph-node--estado graph-node--estado-${tonoCicloVida(props.data.status)}`);
/* Mismas variantes que el modal de edicion. Antes `draft` salia AMBAR aqui y gris alla: el
   mismo estado con dos colores segun la pantalla. */
const tonoEstado = computed(() => tonoCicloVida(props.data.status));
</script>

