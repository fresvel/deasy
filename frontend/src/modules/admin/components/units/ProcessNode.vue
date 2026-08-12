<template>
  <div
    class="graph-node relative rounded-xl border px-3 py-2 shadow-sm transition-all"
    :class="[
      data.is_active ? 'border-slate-300 bg-white' : 'border-rose-200 bg-rose-50/70 opacity-80',
      data.highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : '',
      data.dimmed ? 'opacity-35' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle" />

    <div v-if="hover" class="nodrag nopan graph-node__toolbar">
      <button
        v-if="data.hasChildren"
        type="button"
        class="graph-node__btn"
        :title="data.collapsed ? 'Expandir rama' : 'Colapsar rama'"
        @click.stop="data.onToggleCollapse?.(data.id)"
      >
        <IconChevronDown v-if="data.collapsed" class="h-4 w-4" />
        <IconChevronUp v-else class="h-4 w-4" />
      </button>
      <template v-if="data.editable">
        <button type="button" class="graph-node__btn" title="Editar proceso" @click.stop="data.onEdit?.(data.id)">
          <IconPencil class="h-4 w-4" />
        </button>
        <button type="button" class="graph-node__btn" title="Agregar proceso hijo" @click.stop="data.onAddChild?.(data.id)">
          <IconCornerDownRight class="h-4 w-4" />
        </button>
        <button type="button" class="graph-node__btn" title="Agregar proceso hermano" @click.stop="data.onAddSibling?.(data.id)">
          <IconPlus class="h-4 w-4" />
        </button>
      </template>
    </div>

    <p class="m-0 flex items-center gap-1.5">
      <span class="max-w-[10.5rem] truncate text-sm font-bold text-slate-800" :title="data.name">{{ data.name }}</span>
      <span v-if="data.collapsed" class="text-[11px] font-semibold text-indigo-500">▸</span>
    </p>
    <p class="m-0 mt-1 flex flex-wrap items-center gap-1.5">
      <span class="inline-flex max-w-[10.5rem] items-center truncate rounded-xl bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200" :title="data.slug">
        {{ data.slug }}
      </span>
      <button
        v-if="data.definitions_count"
        type="button"
        class="nodrag inline-flex items-center gap-0.5 rounded-xl px-1.5 py-0.5 text-[11px] font-semibold ring-1 transition-colors hover:brightness-95"
        :class="configBadgeClass"
        :title="data.configsExpanded ? 'Ocultar configuraciones' : 'Mostrar configuraciones'"
        @click.stop="data.onToggleConfigs?.(data.id)"
      >
        <IconChevronRight class="h-3 w-3 transition-transform" :class="data.configsExpanded ? 'rotate-90' : ''" />
        {{ data.active_count || 0 }}/{{ data.definitions_count }} config.
      </button>
      <span v-else class="inline-flex items-center rounded-xl bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-brand-text-muted ring-1 ring-slate-200">Sin config.</span>
      <span v-if="!data.is_active" class="text-[11px] font-semibold text-rose-500">Inactivo</span>
    </p>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle" />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconPencil, IconCornerDownRight, IconPlus, IconChevronUp, IconChevronDown, IconChevronRight } from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});

const hover = ref(false);
const configBadgeClass = computed(() => {
  const total = Number(props.data.definitions_count) || 0;
  const active = Number(props.data.active_count) || 0;
  if (total === 0) return "bg-slate-100 text-slate-500 ring-slate-200";
  if (active >= 1) return "bg-emerald-50 text-state-success ring-emerald-200";
  return "bg-amber-50 text-state-warning ring-amber-200";
});
</script>

