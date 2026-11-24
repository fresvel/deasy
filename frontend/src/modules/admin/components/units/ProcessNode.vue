<template>
  <div
    class="graph-node graph-node--proceso relative rounded-xl rounded-tl-none border px-3 py-2 transition-all"
    :class="[
      data.estado === 'vigente' ? 'graph-node--activo bg-white' : 'graph-node--inactivo bg-white',
      data.highlighted ? 'graph-node--resaltado' : '',
      data.dimmed ? 'graph-node--apagado' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle" />

    <!-- LA PESTAÑA DICE QUÉ CLASE DE NODO ES. En este mapa conviven tres —proceso, configuración y
         entregable— y hasta ahora se distinguían sólo por tamaño y color. Es la misma pestaña de
         carpeta que lleva la unidad con su tipo. -->
    <span class="graph-node__tipo"><span class="graph-node__tipo-texto">Proceso</span></span>

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

    <!-- El nombre tiene la fila entera; el estado va SIEMPRE, también cuando rige, y es lo primero
         de la fila de abajo, igual que en la unidad. Así se lee qué rige sin deducirlo de una ausencia. -->
    <p class="m-0 flex items-center gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-bold text-strong" :title="data.name">{{ data.name }}</span>
      <span v-if="data.collapsed" class="text-theme-xs font-semibold text-primary">▸</span>
    </p>
    <!-- PRUEBA (2026-11-24, opción 3): el estado y las configuraciones van en una franja al pie,
         separada por una línea fina, en texto pequeño. Sólo toma color lo que no es lo normal. La
         cuenta de configuraciones sigue siendo el botón que las despliega. -->
    <div class="graph-node__pie">
      <span class="graph-node__dato" :class="[`graph-node__dato--${tonoVigencia(data.estado)}`, data.estado === 'vigente' ? '' : 'graph-node__dato--destaca']">{{ etiquetaVigencia(data.estado) }}</span>
      <span aria-hidden="true">·</span>
      <button
        v-if="data.hasConfigs"
        type="button"
        class="nodrag graph-node__toggle graph-node__dato"
        :class="[`graph-node__dato--${tonoConfiguraciones}`, tonoConfiguraciones === 'success' ? '' : 'graph-node__dato--destaca']"
        :title="data.configsExpanded ? 'Ocultar configuraciones' : 'Mostrar configuraciones'"
        @click.stop="data.onToggleConfigs?.(data.id)"
      >
        <IconChevronRight class="h-3 w-3 transition-transform" :class="data.configsExpanded ? 'rotate-90' : ''" />
        {{ data.active_count || 0 }}/{{ data.definitions_count }} config.
      </button>
      <span v-else class="graph-node__dato">Sin config.</span>
    </div>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle" />
  </div>
</template>

<script setup>
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

