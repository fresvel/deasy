<template>
  <div
    class="graph-node graph-node--config relative rounded-2xl border-l-4 px-2.5 py-1.5 transition-all"
    :class="[statusBorderClass, data.highlighted ? 'ring-2 ring-brand-400 ring-offset-1' : '']"
    :title="data.definition_name"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle graph-node__handle--sm" />

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
    <p class="m-0 flex items-center gap-1.5">
      <span class="min-w-0 flex-1 truncate text-theme-xs font-semibold text-body">{{ data.definition_name }}</span>
      <AppTag :variant="tonoEstado" outlined>{{ statusLabel }}</AppTag>
    </p>
    <p class="m-0 mt-0.5 flex items-center gap-1 text-theme-xs text-muted">
      <span class="truncate">{{ seriesLabel }}</span>
      <span class="shrink-0">· v{{ data.definition_version }}</span>
    </p>
    <p v-if="data.templatesCount" class="m-0 mt-1">
      <button
        type="button"
        class="nodrag graph-node__badge graph-node__badge--brand"
        :title="data.templatesExpanded ? 'Ocultar entregables' : 'Mostrar entregables'"
        @click.stop="data.onToggleTemplates?.(data.definition_id)"
      >
        <IconChevronRight class="h-2.5 w-2.5 transition-transform" :class="data.templatesExpanded ? 'rotate-90' : ''" />
        {{ data.templatesCount }} entregable{{ data.templatesCount === 1 ? "" : "s" }}
      </button>
    </p>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle graph-node__handle--sm" :class="data.templatesCount ? '' : 'graph-node__handle--hidden'" />
  </div>
</template>

<script setup>
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoCicloVida, etiquetaCicloVida } from "@/shared/utils/estadoTono.js";
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
const seriesLabel = computed(() => {
  if (props.data.series_source_type === "cargo") return `Cargo · ${props.data.series_cargo_name || props.data.series_code}`;
  if (props.data.series_source_type === "unit_type") return `Tipo · ${props.data.series_unit_type_name || props.data.series_code}`;
  return "General";
});
</script>

