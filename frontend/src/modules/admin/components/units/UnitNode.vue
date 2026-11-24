<template>
  <div
    class="graph-node graph-node--unidad graph-node--franja relative rounded-xl rounded-tl-none px-3 py-2.5 transition-all"
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

    <!-- EL TIPO DE UNIDAD VA EN UNA PESTAÑA DE CARPETA (2026-11-24): el contorno del nodo sube, la
         rodea y vuelve a bajar con una curva, como una sola pieza. Dice qué clase de cosa es el nodo
         y casi nunca cambia; abajo queda lo que sí cambia —vigencia y puestos—. Con el tipo y la
         vigencia dentro, el nodo medía hasta 296 px donde el trazado reserva 210, y se pisaban.
         El texto se corta con puntos suspensivos: el nombre entero va en `title`. La esquina de
         arriba a la izquierda del nodo va recta (`rounded-tl-none`) porque ahí sigue la pestaña. -->
    <span class="graph-node__tipo graph-node__tipo--franja" :title="data.unit_type_name || 'Sin tipo'">
      <span class="graph-node__tipo-texto">{{ data.unit_type_name || 'Sin tipo' }}</span>
    </span>

    <!-- CUANDO EL MAPA SE VE DESDE ESTA UNIDAD, ella es la raíz y lleva la vuelta: a la vista de la que
         se vino y, si se llegó enfocando dos veces, al mapa entero. Va a la izquierda y siempre a la
         vista —no sólo al pasar el ratón—: es la única salida de esa vista, y no puede esconderse. -->
    <div v-if="data.focused" class="nodrag nopan graph-node__toolbar graph-node__toolbar--izquierda">
      <button type="button" class="graph-node__btn graph-node__btn--accent" title="Volver a la vista anterior" @click.stop="data.onUnfocus?.()">
        <IconArrowBackUp class="h-4 w-4" />
      </button>
      <button v-if="data.focusDepth > 1" type="button" class="graph-node__btn" title="Volver al mapa completo" @click.stop="data.onUnfocusAll?.()">
        <IconSitemap class="h-4 w-4" />
      </button>
    </div>

    <!-- Toolbar de nodo (hover), al costado derecho para no tapar los conectores: colapsar / ver sólo
         su rama / agregar hija. La unidad —datos, vigencia, puestos, procesos— se abre pulsando el nodo. -->
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
        title="Ver sólo esta unidad y lo que depende de ella"
        @click.stop="data.onFocus?.(data.id)"
      >
        <IconFocusCentered class="h-4 w-4" />
      </button>
      <button v-if="data.editable" type="button" class="graph-node__btn" title="Agregar unidad hija" @click.stop="data.onAddChild?.(data.id)">
        <IconCornerDownRight class="h-4 w-4" />
      </button>
    </div>

    <!-- LAS OBSERVACIONES DEL NODO: un aviso en la esquina, con cuántas son. Pulsarlo las enseña una
         por una, con qué hacer en cada caso. Antes eran un triángulo junto al nombre —que sólo
         hablaba al pasar el ratón— y una pastilla por cada cosa; con un solo sitio, la siguiente
         observación que haga falta no ocupa más nodo. -->
    <button
      v-if="data.healthIssues && data.healthIssues.length"
      type="button"
      class="nodrag graph-node__aviso"
      :title="data.healthIssues.map((o) => o.titulo).join(' · ')"
      :aria-label="`${data.healthIssues.length} ${data.healthIssues.length === 1 ? 'observación' : 'observaciones'} en ${data.name}`"
      @click.stop="data.onOpenIssues?.(data.id)"
    >
      <IconAlertTriangle class="h-3 w-3" />{{ data.healthIssues.length }}
    </button>

    <p class="m-0 flex items-center gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-bold text-strong" :title="data.name">{{ data.name }}</span>
      <IconCrown v-if="Number(data.head_count) > 0" class="h-3.5 w-3.5 shrink-0 text-warning" title="Tiene jefatura" />
      <span v-if="data.collapsed" class="text-theme-xs font-semibold text-primary">▸</span>
    </p>
    <!-- EL ESTADO Y LOS PUESTOS VAN SIN CAJA (decisión del dueño, 2026-11-24). Un punto con el tono
         del estado y su nombre en gris; la cuenta de puestos, con su icono, sólo toma color cuando
         falta gente. Así la única caja del nodo es el nodo, y lo que no es normal es lo único que
         tiñe. El tono del estado va también en la franja de la izquierda, como en la configuración. -->
    <p class="m-0 mt-1.5 flex flex-wrap items-center gap-3">
      <span class="graph-node__dato" :class="[`graph-node__dato--${tonoVigencia(data.estado)}`, data.estado === 'vigente' ? '' : 'graph-node__dato--destaca']">
        <span class="graph-node__punto"></span>{{ etiquetaVigencia(data.estado) }}
      </span>
      <span
        v-if="Number(data.positions_count) > 0"
        class="graph-node__dato ml-auto"
        :class="[`graph-node__dato--${tonoPuestos}`, tonoPuestos === 'success' ? '' : 'graph-node__dato--destaca']"
        :title="`${data.occupied_count || 0} ocupados de ${data.positions_count} puestos`"
      >
        <IconUsers class="h-3.5 w-3.5" />{{ data.occupied_count || 0 }}/{{ data.positions_count }}
      </span>
    </p>
    <Handle type="source" :position="Position.Bottom" class="graph-node__handle" />
  </div>
</template>

<script setup>
import { coberturaEstado, tonoCobertura, tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import { computed, ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import {
  IconCornerDownRight, IconCrown, IconFocusCentered, IconArrowBackUp, IconSitemap,
  IconAlertTriangle, IconChevronUp, IconChevronDown, IconUsers
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

