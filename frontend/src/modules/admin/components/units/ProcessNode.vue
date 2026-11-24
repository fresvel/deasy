<template>
  <div
    class="graph-node relative rounded-xl border px-3 py-2 transition-all"
    :class="[
      data.estado === 'vigente' ? 'graph-node--activo bg-white' : 'graph-node--inactivo bg-white',
      data.highlighted ? 'graph-node--resaltado' : '',
      data.dimmed ? 'graph-node--apagado' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle" />

    <!-- La vuelta de una vista enfocada: como en el organigrama, a la izquierda y siempre a la vista. -->
    <div v-if="data.focused" class="nodrag nopan graph-node__toolbar graph-node__toolbar--izquierda">
      <button type="button" class="graph-node__btn graph-node__btn--accent" title="Volver a la vista anterior" @click.stop="data.onUnfocus?.()">
        <IconArrowBackUp class="h-4 w-4" />
      </button>
      <button v-if="data.focusDepth > 1" type="button" class="graph-node__btn" title="Volver al mapa completo" @click.stop="data.onUnfocusAll?.()">
        <IconSitemap class="h-4 w-4" />
      </button>
    </div>

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
      <button
        v-if="data.hasChildren && !data.focused"
        type="button"
        class="graph-node__btn"
        title="Ver sólo este proceso y lo que depende de él"
        @click.stop="data.onFocus?.(data.id)"
      >
        <IconFocusCentered class="h-4 w-4" />
      </button>
      <button v-if="data.editable" type="button" class="graph-node__btn" title="Agregar proceso hijo" @click.stop="data.onAddChild?.(data.id)">
        <IconCornerDownRight class="h-4 w-4" />
      </button>
    </div>

    <!-- El estado va SIEMPRE, también cuando rige, y en el mismo sitio que el de la configuración:
         a la derecha del nombre. Así se lee de un vistazo qué rige sin deducirlo de una ausencia. -->
    <p class="m-0 flex items-center gap-2">
      <span class="max-w-[10.5rem] truncate text-sm font-bold text-strong" :title="data.name">{{ data.name }}</span>
      <span v-if="data.collapsed" class="text-theme-xs font-semibold text-primary">▸</span>
      <AppTag :variant="tonoVigencia(data.estado)" outlined class-name="ml-auto">{{ etiquetaVigencia(data.estado) }}</AppTag>
    </p>
    <p class="m-0 mt-1 flex flex-wrap items-center gap-2">
      <button
        v-if="data.hasConfigs"
        type="button"
        class="nodrag graph-node__toggle"
        :title="data.configsExpanded ? 'Ocultar configuraciones' : 'Mostrar configuraciones'"
        @click.stop="data.onToggleConfigs?.(data.id)"
      >
        <AppTag :variant="tonoConfiguraciones" outlined>
          <IconChevronRight class="h-3 w-3 transition-transform" :class="data.configsExpanded ? 'rotate-90' : ''" />
          {{ data.active_count || 0 }}/{{ data.definitions_count }} config.
        </AppTag>
      </button>
      <AppTag v-else variant="neutral" outlined>Sin config.</AppTag>
    </p>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle" />
  </div>
</template>

<script setup>
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconCornerDownRight, IconChevronUp, IconChevronDown, IconChevronRight, IconFocusCentered, IconArrowBackUp, IconSitemap } from "@tabler/icons-vue";

const props = defineProps({
  data: { type: Object, required: true }
});

const hover = ref(false);
/* ⚠️ La cobertura de configuraciones NO usa `coberturaEstado`: aqui «cero activas» y «ninguna
   configuracion» no son dos grados de lo mismo, asi que no hay escalon `danger`. Un proceso sin
   configuraciones esta pendiente de definir, no roto — y ese caso ni llega aqui: pinta su propia
   pastilla «Sin config.». */
const tonoConfiguraciones = computed(() => ((Number(props.data.active_count) || 0) >= 1 ? "success" : "warning"));
</script>

