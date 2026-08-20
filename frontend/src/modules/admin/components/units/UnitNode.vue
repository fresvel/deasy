<template>
  <div
    class="graph-node relative rounded-xl border px-3 py-2 transition-all"
    :class="[
      data.is_active ? 'graph-node--activo bg-white' : 'graph-node--inactivo bg-white',
      data.highlighted ? 'graph-node--resaltado' : '',
      data.dimmed ? 'graph-node--apagado' : ''
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
      <AppTag variant="neutral" outlined>{{ data.unit_type_name || 'Sin tipo' }}</AppTag>
      <AppTag
        v-if="data.positions_count"
        :variant="tonoPuestos"
        outlined
        :title="`${data.occupied_count || 0} ocupados de ${data.positions_count} puestos`"
      >{{ data.occupied_count || 0 }}/{{ data.positions_count }} puestos</AppTag>
      <AppTag v-if="!data.is_active" variant="warning" outlined>Inactiva</AppTag>
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
/* Devuelve el NOMBRE DEL TONO, no una clase. Hasta el 2026-08-20 devolvia
   `graph-node__badge--${tono}` —clase ya retirada— y la plantilla escribia la geometria a mano; ahora es
   `AppTag` y esto vuelve a ser lo que el contrato de `estadoTono.js` pide: un nombre de tono. */
const tonoPuestos = computed(() => {
  /* Aqui SI aplica la rampa entera: una unidad con puestos y nadie dentro es la alarma, y por eso
     `vacio` conserva el rojo. `coberturaEstado` decide el grado; el diccionario, el tono. */
  const estado = coberturaEstado(Number(props.data.occupied_count) || 0, Number(props.data.positions_count) || 0);
  return tonoCobertura(estado);
});
</script>

