<template>
  <div
    class="graph-node relative rounded-xl border px-3 py-2 transition-all"
    :class="[
      data.is_active ? 'border-line-strong bg-white' : 'border-line bg-white opacity-80',
      data.highlighted ? 'ring-2 ring-brand-400 ring-offset-1' : '',
      data.dimmed ? 'opacity-35' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle" />

    <!-- Toolbar de nodo (hover), al costado derecho para no tapar los conectores: colapsar / editar /
         agregar hijo / agregar hermano. El detalle (puestos/ocupaciones) se abre al hacer clic en el nodo. -->
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
        <button type="button" class="graph-node__btn" title="Editar unidad" @click.stop="data.onEdit?.(data.id)">
          <IconPencil class="h-4 w-4" />
        </button>
        <button type="button" class="graph-node__btn" title="Agregar unidad hija" @click.stop="data.onAddChild?.(data.id)">
          <IconCornerDownRight class="h-4 w-4" />
        </button>
        <button type="button" class="graph-node__btn" title="Agregar unidad hermana" @click.stop="data.onAddSibling?.(data.id)">
          <IconPlus class="h-4 w-4" />
        </button>
      </template>
    </div>

    <p class="m-0 flex items-center gap-1.5">
      <span class="max-w-[10.5rem] truncate text-sm font-bold text-strong" :title="data.name">{{ data.name }}</span>
      <IconCrown v-if="data.head_count" class="h-3.5 w-3.5 shrink-0 text-warning" title="Tiene jefatura" />
      <IconAlertTriangle
        v-if="data.healthIssues && data.healthIssues.length"
        class="h-3.5 w-3.5 shrink-0 text-warning"
        :title="data.healthIssues.join(' · ')"
      />
      <span v-if="data.collapsed" class="text-theme-xs font-semibold text-primary">▸</span>
    </p>
    <p class="m-0 mt-1 flex flex-wrap items-center gap-1.5">
      <span class="inline-flex items-center rounded-xl bg-surface px-1.5 py-0.5 text-theme-xs font-semibold text-icon ring-1 ring-line">
        {{ data.unit_type_name || 'Sin tipo' }}
      </span>
      <span
        v-if="data.positions_count"
        class="inline-flex items-center rounded-xl px-1.5 py-0.5 text-theme-xs font-semibold ring-1"
        :class="positionsBadgeClass"
        :title="`${data.occupied_count || 0} ocupados de ${data.positions_count} puestos`"
      >{{ data.occupied_count || 0 }}/{{ data.positions_count }} puestos</span>
      <AppTag v-if="!data.is_active" variant="warning" size="sm" outlined>Inactiva</AppTag>
    </p>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle" />
  </div>
</template>

<script setup>
import AppTag from "@/shared/components/data/AppTag.vue";
import { coberturaEstado, tonoCobertura } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import {
  IconPencil, IconCornerDownRight, IconPlus, IconCrown,
  IconAlertTriangle, IconChevronUp, IconChevronDown
} from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});

const hover = ref(false);
const positionsBadgeClass = computed(() => {
  /* Aqui SI aplica la rampa entera: una unidad con puestos y nadie dentro es la alarma, y por eso
     `vacio` conserva el rojo. `coberturaEstado` decide el grado; el diccionario, el tono. */
  const estado = coberturaEstado(Number(props.data.occupied_count) || 0, Number(props.data.positions_count) || 0);
  return `graph-node__badge--${tonoCobertura(estado)}`;
});
</script>

