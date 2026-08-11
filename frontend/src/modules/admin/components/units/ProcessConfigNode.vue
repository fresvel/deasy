<template>
  <div
    class="graph-node graph-node--config relative rounded-2xl border-l-4 px-2.5 py-1.5 shadow-sm transition-all"
    :class="[statusBorderClass, data.highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : '']"
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
      <span class="max-w-[9.5rem] truncate text-[12px] font-semibold text-slate-700">{{ data.definition_name }}</span>
      <span class="ml-auto inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold ring-1" :class="statusChipClass">{{ statusLabel }}</span>
    </p>
    <p class="m-0 mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
      <span class="truncate">{{ seriesLabel }}</span>
      <span class="shrink-0">· v{{ data.definition_version }}</span>
    </p>
    <p v-if="data.templatesCount" class="m-0 mt-1">
      <button
        type="button"
        class="nodrag inline-flex items-center gap-0.5 rounded bg-violet-50 px-1 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-100"
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
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconChevronRight, IconFilePlus, IconGitBranch, IconPlus } from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});
const hover = ref(false);

const statusLabel = computed(() => ({ active: "Activa", draft: "Borrador", retired: "Retirada" }[props.data.status] || props.data.status));
// El estado se lee por el borde izquierdo y por la etiqueta; el fondo NO lo tiñe.
// Aquí hubo un `bg-emerald-50/40` / `bg-amber-50/40` / `bg-slate-50` que nunca se llegó a
// ver: el `<style scoped>` del componente declaraba `background: #fff` y, al no estar en
// ninguna capa, ganaba a las utilidades de Tailwind. Se han quitado porque el tinte no
// añade información que el borde y la etiqueta no den ya, y sí resta contraste al texto.
const statusBorderClass = computed(() => {
  if (props.data.status === "active") return "border-l-emerald-400 border-y border-r border-y-slate-200 border-r-slate-200";
  if (props.data.status === "draft") return "border-l-amber-400 border-y border-r border-y-slate-200 border-r-slate-200";
  return "border-l-slate-300 border-y border-r border-y-slate-200 border-r-slate-200";
});
const statusChipClass = computed(() => {
  if (props.data.status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (props.data.status === "draft") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
});
const seriesLabel = computed(() => {
  if (props.data.series_source_type === "cargo") return `Cargo · ${props.data.series_cargo_name || props.data.series_code}`;
  if (props.data.series_source_type === "unit_type") return `Tipo · ${props.data.series_unit_type_name || props.data.series_code}`;
  return "General";
});
</script>

