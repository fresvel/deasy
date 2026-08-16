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
      <span class="max-w-[10.5rem] truncate text-sm font-bold text-strong" :title="data.name">{{ data.name }}</span>
      <span v-if="data.collapsed" class="text-[11px] font-semibold text-primary">▸</span>
    </p>
    <p class="m-0 mt-1 flex flex-wrap items-center gap-1.5">
      <span class="inline-flex max-w-[10.5rem] items-center truncate rounded-xl bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line" :title="data.slug">
        {{ data.slug }}
      </span>
      <button
        v-if="data.definitions_count"
        type="button"
        class="nodrag graph-node__badge"
        :class="configBadgeClass"
        :title="data.configsExpanded ? 'Ocultar configuraciones' : 'Mostrar configuraciones'"
        @click.stop="data.onToggleConfigs?.(data.id)"
      >
        <IconChevronRight class="h-3 w-3 transition-transform" :class="data.configsExpanded ? 'rotate-90' : ''" />
        {{ data.active_count || 0 }}/{{ data.definitions_count }} config.
      </button>
      <AppTag v-else variant="neutral" size="sm" outlined>Sin config.</AppTag>
      <AppTag v-if="!data.is_active" variant="warning" size="sm" outlined>Inactivo</AppTag>
    </p>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle" />
  </div>
</template>

<script setup>
import AppTag from "@/shared/components/data/AppTag.vue";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconPencil, IconCornerDownRight, IconPlus, IconChevronUp, IconChevronDown, IconChevronRight } from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});

const hover = ref(false);
/* El TONO sale del diccionario; aqui solo queda decidir el ESTADO, que es negocio. */
const configBadgeClass = computed(() => {
  const total = Number(props.data.definitions_count) || 0;
  const activas = Number(props.data.active_count) || 0;
  /* ⚠️ La cobertura de configuraciones NO usa `coberturaEstado`: aqui «cero activas» y «ninguna
     configuracion» no son dos grados de lo mismo, asi que solo hay tres escalones y falta el
     `danger`. Un proceso sin configuraciones esta pendiente de definir, no roto. */
  if (total === 0) return "graph-node__badge--neutral";
  return activas >= 1 ? "graph-node__badge--success" : "graph-node__badge--warning";
});
</script>

