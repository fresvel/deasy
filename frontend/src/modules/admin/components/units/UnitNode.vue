<template>
  <div
    class="unit-node relative rounded-xl border px-3 py-2 shadow-sm transition-all"
    :class="[
      data.is_active ? 'border-slate-300 bg-white' : 'border-rose-200 bg-rose-50/70 opacity-80',
      data.highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : '',
      data.dimmed ? 'opacity-35' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="unit-node__handle" />

    <!-- Toolbar de nodo (hover): colapsar / detalle / editar / agregar hijo / agregar hermano -->
    <div v-if="hover" class="nodrag nopan unit-node__toolbar">
      <button
        v-if="data.hasChildren"
        type="button"
        class="unit-node__btn"
        :title="data.collapsed ? 'Expandir rama' : 'Colapsar rama'"
        @click.stop="data.onToggleCollapse?.(data.id)"
      >
        <IconChevronDown v-if="data.collapsed" class="h-3.5 w-3.5" />
        <IconChevronUp v-else class="h-3.5 w-3.5" />
      </button>
      <button type="button" class="unit-node__btn" title="Ver puestos y ocupaciones" @click.stop="data.onDetail?.(data.id)">
        <IconLayoutSidebarRightExpand class="h-3.5 w-3.5" />
      </button>
      <template v-if="data.editable">
        <button type="button" class="unit-node__btn" title="Editar unidad" @click.stop="data.onEdit?.(data.id)">
          <IconPencil class="h-3.5 w-3.5" />
        </button>
        <button type="button" class="unit-node__btn" title="Agregar unidad hija" @click.stop="data.onAddChild?.(data.id)">
          <IconCornerDownRight class="h-3.5 w-3.5" />
        </button>
        <button type="button" class="unit-node__btn" title="Agregar unidad hermana" @click.stop="data.onAddSibling?.(data.id)">
          <IconPlus class="h-3.5 w-3.5" />
        </button>
      </template>
    </div>

    <p class="m-0 flex items-center gap-1.5">
      <span class="max-w-[10.5rem] truncate text-sm font-bold text-slate-800" :title="data.name">{{ data.name }}</span>
      <IconCrown v-if="data.head_count" class="h-3.5 w-3.5 shrink-0 text-amber-500" title="Tiene jefatura" />
      <IconAlertTriangle
        v-if="data.healthIssues && data.healthIssues.length"
        class="h-3.5 w-3.5 shrink-0 text-amber-500"
        :title="data.healthIssues.join(' · ')"
      />
      <span v-if="data.collapsed" class="text-[11px] font-semibold text-indigo-500">▸</span>
    </p>
    <p class="m-0 mt-1 flex flex-wrap items-center gap-1.5">
      <span class="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
        {{ data.unit_type_name || 'Sin tipo' }}
      </span>
      <span
        v-if="data.positions_count"
        class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1"
        :class="positionsBadgeClass"
        :title="`${data.occupied_count || 0} ocupados de ${data.positions_count} puestos`"
      >{{ data.occupied_count || 0 }}/{{ data.positions_count }} puestos</span>
      <span v-if="!data.is_active" class="text-[11px] font-semibold text-rose-500">Inactiva</span>
    </p>
    <Handle type="source" :position="Position.Bottom" class="unit-node__handle" />
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import {
  IconPencil, IconCornerDownRight, IconPlus, IconCrown,
  IconLayoutSidebarRightExpand, IconAlertTriangle, IconChevronUp, IconChevronDown
} from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});

const hover = ref(false);
const positionsBadgeClass = computed(() => {
  const total = Number(props.data.positions_count) || 0;
  const occ = Number(props.data.occupied_count) || 0;
  if (total === 0) return "bg-slate-100 text-slate-500 ring-slate-200";
  if (occ >= total) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (occ === 0) return "bg-rose-50 text-rose-600 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
});
</script>

<style scoped>
.unit-node__handle {
  width: 9px;
  height: 9px;
  background: #6366f1;
  border: 2px solid #fff;
}
.unit-node__toolbar {
  position: absolute;
  top: -14px;
  right: 6px;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2);
  z-index: 5;
}
.unit-node__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  width: 22px;
  border-radius: 6px;
  color: #475569;
  transition: background 0.15s ease, color 0.15s ease;
}
.unit-node__btn:hover {
  background: #eef2ff;
  color: #4f46e5;
}
</style>
