<template>
  <div
    class="graph-node graph-node--proceso graph-node--franja relative rounded-xl rounded-tl-none px-3 py-2.5 transition-all"
    :class="[
      `graph-node--estado-${tonoVigencia(data.estado)}`,
      data.estado === 'vigente' ? 'graph-node--activo bg-white' : 'graph-node--inactivo bg-white',
      data.highlighted ? 'graph-node--resaltado' : '',
      data.dimmed ? 'graph-node--apagado' : ''
    ]"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle" />

    <!-- EL AVISO DE LA ESQUINA, como en la unidad: cuántas observaciones tiene el proceso. Hoy sólo
         hay una clase —actos que ordenaron algo de él y siguen sin documento—; al pulsarlo se abren
         y llevan a donde se resuelven. -->
    <button
      v-if="data.observaciones && data.observaciones.length"
      type="button"
      class="nodrag graph-node__aviso"
      :title="data.observaciones.map((o) => o.titulo).join(' · ')"
      :aria-label="`${data.observaciones.length} ${data.observaciones.length === 1 ? 'observación' : 'observaciones'} en ${data.name}`"
      @click.stop="data.onOpenIssues?.(data.id)"
    >
      <IconAlertTriangle class="h-3 w-3" />{{ data.observaciones.length }}
    </button>

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
    <!-- El estado, sin caja: como en la unidad. Lo que cuelga del proceso se cuenta en el pie. -->
    <p class="m-0 mt-1.5 flex flex-wrap items-center gap-3">
      <span class="graph-node__dato" :class="[`graph-node__dato--${tonoVigencia(data.estado)}`, data.estado === 'vigente' ? '' : 'graph-node__dato--destaca']">
        <span class="graph-node__punto"></span>{{ etiquetaVigencia(data.estado) }}
      </span>
    </p>

    <!-- LO QUE CUELGA DEL PROCESO SALE DE SU PIE (2026-11-24). Un proceso tiene dos clases de hijos
         —subprocesos y configuraciones— y las dos salían del mismo punto. Ahora el nodo acaba en
         una franja partida en dos mitades, DENTRO de su contorno: cada mitad lleva un ICONO y la
         cifra —no la palabra: «configuración» va a llamarse «línea», y el icono no caduca; el
         nombre va en `title`—, dice cuántos son, se
         pulsa para desplegarlos o recogerlos, y de su centro parten sus líneas. Las dos están
         siempre —aunque una diga que no hay—, así el nodo no cambia de forma y cada clase tiene
         su lado fijo. Tintada cuando hay algo recogido; gris suave cuando ya está a la vista.
         (La primera versión eran pestañas colgando por fuera, y parecían bultos.) -->
    <div class="nodrag graph-node__pie">
      <div class="graph-node__pie-parte">
        <button
          v-if="data.childrenCount"
          type="button"
          class="graph-node__pie-boton"
          :class="data.collapsed ? 'graph-node__pie-boton--cerrado' : ''"
          :title="`${data.childrenCount} ${data.childrenCount === 1 ? 'subproceso' : 'subprocesos'} · pulsa para ${data.collapsed ? 'mostrarlos' : 'ocultarlos'}`"
          @click.stop="data.onToggleCollapse?.(data.id)"
        >
          <IconChevronRight class="h-3 w-3 transition-transform" :class="data.collapsed ? '' : 'rotate-90'" />
          <IconHierarchy2 class="h-3.5 w-3.5" />{{ data.childrenCount }}
        </button>
        <span v-else class="graph-node__pie-vacio" title="Sin subprocesos"><IconHierarchy2 class="h-3.5 w-3.5" />0</span>
        <!-- El conector está siempre: de él se arrastra para crear el primer subproceso. -->
        <Handle id="sub" type="source" :position="Position.Bottom" class="graph-node__handle" />
      </div>
      <div class="graph-node__pie-parte">
        <button
          v-if="data.hasConfigs"
          type="button"
          class="graph-node__pie-boton"
          :class="[data.configsExpanded ? '' : 'graph-node__pie-boton--cerrado', tonoConfiguraciones === 'success' ? '' : 'graph-node__pie-boton--aviso']"
          :title="`${data.active_count || 0} de ${data.definitions_count} configuraciones activas · pulsa para ${data.configsExpanded ? 'ocultarlas' : 'mostrarlas'}`"
          @click.stop="data.onToggleConfigs?.(data.id)"
        >
          <IconChevronRight class="h-3 w-3 transition-transform" :class="data.configsExpanded ? 'rotate-90' : ''" />
          <IconTimeline class="h-3.5 w-3.5" />{{ data.active_count || 0 }}/{{ data.definitions_count }}
        </button>
        <span v-else class="graph-node__pie-vacio" title="Sin configuraciones"><IconTimeline class="h-3.5 w-3.5" />0</span>
        <Handle
          id="cfg"
          type="source"
          :position="Position.Bottom"
          class="graph-node__handle graph-node__handle--sm"
          :class="data.hasConfigs ? '' : 'graph-node__handle--hidden'"
          :connectable="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconAlertTriangle, IconCornerDownRight, IconChevronRight, IconFocusCentered, IconArrowBackUp, IconSitemap, IconHierarchy2, IconTimeline } from "@tabler/icons-vue";

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

