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

    <!-- La vuelta de una vista enfocada en esta configuración: como en el proceso y la unidad. -->
    <div v-if="data.focused" class="nodrag nopan graph-node__toolbar graph-node__toolbar--sm graph-node__toolbar--izquierda">
      <button type="button" class="graph-node__btn graph-node__btn--sm graph-node__btn--accent" title="Volver a la vista anterior" @click.stop="data.onUnfocus?.()">
        <IconArrowBackUp class="h-4 w-4" />
      </button>
      <button v-if="data.focusDepth > 1" type="button" class="graph-node__btn graph-node__btn--sm" title="Volver al mapa completo" @click.stop="data.onUnfocusAll?.()">
        <IconSitemap class="h-4 w-4" />
      </button>
    </div>

    <div v-if="hover && (data.editable || (data.templatesCount && !data.focused))" class="nodrag nopan graph-node__toolbar graph-node__toolbar--sm">
      <button
        v-if="data.templatesCount && !data.focused"
        type="button"
        class="graph-node__btn graph-node__btn--sm"
        title="Ver sólo esta configuración y sus entregables"
        @click.stop="data.onFocus?.(`c-${data.definition_id}`)"
      >
        <IconFocusCentered class="h-4 w-4" />
      </button>
      <button v-if="data.editable && data.status === 'draft'" type="button" class="graph-node__btn graph-node__btn--sm" title="Agregar entregable" @click.stop="data.onAddTemplate?.(data)">
        <IconFilePlus class="h-4 w-4" />
      </button>
      <button v-if="data.editable && data.status !== 'draft'" type="button" class="graph-node__btn graph-node__btn--sm" title="Versionar configuración" @click.stop="data.onVersion?.(data)">
        <IconGitBranch class="h-4 w-4" />
      </button>
      <button v-if="data.editable" type="button" class="graph-node__btn graph-node__btn--sm" title="Agregar configuración hermana" @click.stop="data.onAddSibling?.(data)">
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
    <!-- Los entregables cuelgan del pie, como en el proceso. La configuración sólo tiene una clase
         de hijos, así que el pie es de una pieza y la línea sale de su centro, por el eje. -->
    <div class="nodrag graph-node__pie">
      <div class="graph-node__pie-parte">
        <button
          v-if="data.templatesCount"
          type="button"
          class="graph-node__pie-boton"
          :class="data.templatesExpanded ? '' : 'graph-node__pie-boton--cerrado'"
          :title="`${data.templatesCount} ${data.templatesCount === 1 ? 'entregable' : 'entregables'} · pulsa para ${data.templatesExpanded ? 'ocultarlos' : 'mostrarlos'}`"
          @click.stop="data.onToggleTemplates?.(data.definition_id)"
        >
          <IconChevronRight class="h-3 w-3 transition-transform" :class="data.templatesExpanded ? 'rotate-90' : ''" />
          <IconFileText class="h-3.5 w-3.5" />{{ data.templatesCount }}
        </button>
        <span v-else class="graph-node__pie-vacio" title="Sin entregables"><IconFileText class="h-3.5 w-3.5" />0</span>
        <Handle type="source" :position="Position.Bottom" class="graph-node__handle graph-node__handle--sm" :class="data.templatesCount ? '' : 'graph-node__handle--hidden'" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { tonoCicloVida } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconArrowBackUp, IconChevronRight, IconFilePlus, IconFileText, IconFocusCentered, IconGitBranch, IconPlus, IconSitemap } from "@tabler/icons-vue";

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

