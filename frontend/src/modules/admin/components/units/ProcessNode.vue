<template>
  <div
    class="graph-node graph-node--proceso graph-node--franja relative rounded-xl rounded-tl-none px-3 py-2.5 transition-all"
    :class="[
      `graph-node--estado-${tonoVigencia(data.estado)}`,
      data.estado === 'vigente' ? 'graph-node--activo bg-white' : 'graph-node--inactivo bg-white',
      data.highlighted ? 'graph-node--resaltado' : '',
      data.dimmed ? 'graph-node--apagado' : '',
      data.childrenCount ? 'rounded-bl-none' : '',
      data.hasConfigs ? 'rounded-br-none' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle" />

    <!-- LA PESTAÑA DICE QUÉ CLASE DE NODO ES. En este mapa conviven tres —proceso, configuración y
         entregable— y hasta ahora se distinguían sólo por tamaño y color. Es la misma pestaña de
         carpeta que lleva la unidad con su tipo. -->
    <span class="graph-node__tipo graph-node__tipo--franja"><span class="graph-node__tipo-texto">Proceso</span></span>

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
    </p>
    <!-- El estado, sin caja: como en la unidad. Lo que cuelga del proceso ya no se cuenta aquí: va
         en las pestañas de abajo. -->
    <p class="m-0 mt-1.5 flex flex-wrap items-center gap-3">
      <span class="graph-node__dato" :class="[`graph-node__dato--${tonoVigencia(data.estado)}`, data.estado === 'vigente' ? '' : 'graph-node__dato--destaca']">
        <span class="graph-node__punto"></span>{{ etiquetaVigencia(data.estado) }}
      </span>
      <span v-if="!data.hasConfigs" class="graph-node__dato ml-auto">Sin config.</span>
    </p>

    <!-- LO QUE CUELGA DEL PROCESO SALE DE SUS PESTAÑAS (2026-11-24). Un proceso tiene dos clases de
         hijos —sus subprocesos y sus configuraciones— y las dos salían del mismo punto, distinguidas
         sólo por el trazo de la línea. Ahora cada clase tiene su pestaña al pie: dice cuántos son,
         se pulsa para desplegarlos o recogerlos, y de ella parten sus líneas. Siempre en el mismo
         lado —subprocesos a la izquierda, configuraciones a la derecha— aunque falte una.
         Rellena cuando hay algo recogido que enseñar; en blanco cuando ya está a la vista. -->
    <div v-if="data.childrenCount" class="nodrag graph-node__rama graph-node__rama--izquierda" :class="data.collapsed ? 'graph-node__rama--cerrada' : ''">
      <button
        type="button"
        class="graph-node__rama-boton"
        :title="data.collapsed ? 'Mostrar subprocesos' : 'Ocultar subprocesos'"
        @click.stop="data.onToggleCollapse?.(data.id)"
      >
        <IconChevronRight class="h-3 w-3 transition-transform" :class="data.collapsed ? '' : 'rotate-90'" />
        {{ data.childrenCount }} {{ data.childrenCount === 1 ? "subproceso" : "subprocesos" }}
      </button>
      <Handle id="sub" type="source" :position="Position.Bottom" class="graph-node__handle" />
    </div>
    <!-- Sin subprocesos no hay pestaña, pero el conector sigue: de él se arrastra para crear el primero. -->
    <Handle v-else id="sub" type="source" :position="Position.Bottom" class="graph-node__handle" />

    <div
      v-if="data.hasConfigs"
      class="nodrag graph-node__rama graph-node__rama--derecha"
      :class="[data.configsExpanded ? '' : 'graph-node__rama--cerrada', tonoConfiguraciones === 'success' ? '' : 'graph-node__rama--aviso']"
    >
      <button
        type="button"
        class="graph-node__rama-boton"
        :title="data.configsExpanded ? 'Ocultar configuraciones' : 'Mostrar configuraciones'"
        @click.stop="data.onToggleConfigs?.(data.id)"
      >
        <IconChevronRight class="h-3 w-3 transition-transform" :class="data.configsExpanded ? 'rotate-90' : ''" />
        {{ data.active_count || 0 }}/{{ data.definitions_count }} config.
      </button>
      <Handle id="cfg" type="source" :position="Position.Bottom" class="graph-node__handle graph-node__handle--sm" :connectable="false" />
    </div>
  </div>
</template>

<script setup>
import { tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconCornerDownRight, IconChevronRight, IconFocusCentered, IconArrowBackUp, IconSitemap } from "@tabler/icons-vue";

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

