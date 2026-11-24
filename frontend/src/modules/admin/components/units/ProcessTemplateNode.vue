<template>
  <div
    class="graph-node graph-node--template relative rounded-xl rounded-tl-none border border-brand-200 border-l-4 border-l-brand-400 bg-white px-2.5 py-2 transition-all"
    :class="data.highlighted ? 'graph-node--resaltado' : ''"
    :title="`${data.display_name} · código de plantilla: ${data.template_code}`"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="graph-node__handle graph-node__handle--sm" />
    <!-- Qué clase de nodo es, como en el proceso. La franja de la izquierda sube con ella. -->
    <span class="graph-node__tipo graph-node__tipo--sm graph-node__tipo--franja"><span class="graph-node__tipo-texto">Entregable</span></span>

    <div v-if="hover && data.editable" class="nodrag nopan graph-node__toolbar graph-node__toolbar--sm">
      <button v-if="data.parentConfigStatus === 'active'" type="button" class="graph-node__btn graph-node__btn--sm graph-node__btn--accent" title="Actualizar plantilla (nueva versión de plantilla + configuración, publica y activa juntas)" @click.stop="data.onGuidedUpdate?.(data)">
        <IconRefresh class="h-4 w-4" />
      </button>
      <button type="button" class="graph-node__btn graph-node__btn--sm" title="Versionar entregable (crea una versión en borrador)" @click.stop="data.onVersion?.(data)">
        <IconGitBranch class="h-4 w-4" />
      </button>
      <button type="button" class="graph-node__btn graph-node__btn--sm" title="Crear un entregable a partir de este" @click.stop="data.onClone?.(data)">
        <IconCopy class="h-4 w-4" />
      </button>
      <button type="button" class="graph-node__btn graph-node__btn--sm" title="Agregar entregable hermano" @click.stop="data.onAddSibling?.(data)">
        <IconPlus class="h-4 w-4" />
      </button>
    </div>
    <p class="m-0 flex items-center gap-2">
      <IconFileText class="h-3.5 w-3.5 shrink-0 text-primary" />
      <span class="min-w-0 flex-1 truncate text-theme-xs font-semibold text-body">{{ data.display_name }}</span>
    </p>
    <!-- Sólo la versión, sin caja. El código de plantilla se quitó de aquí (2026-11-24): repetía el
         nombre en forma de slug y cargaba el nodo; sigue en el `title` del nodo, al pasar el ratón.
         El fondo tintado también se fue: el entregable ya se distingue por su pestaña y su franja. -->
    <p class="m-0 mt-1 flex items-center gap-3">
      <span
        v-if="data.storage_version"
        class="graph-node__dato shrink-0"
        :class="[`graph-node__dato--${tonoEstado}`, tonoEstado === 'success' ? '' : 'graph-node__dato--destaca']"
        :title="`Versión vinculada: ${data.storage_version} (${stateLabel})${Number(data.version_count) > 1 ? ` · ${data.version_count} versiones` : ''}`"
      >
        <span class="graph-node__punto"></span>v{{ data.storage_version }}
        <span v-if="Number(data.version_count) > 1" class="opacity-70">· {{ data.version_count }}</span>
      </span>
      <IconAlertTriangle
        v-if="isUnhealthy"
        class="h-3.5 w-3.5 shrink-0 text-warning"
        :title="`La configuración activa usa una versión ${stateLabel.toLowerCase()} (no publicada) de este entregable. Publica una versión o usa la publicada.`"
      />
    </p>
  </div>
</template>

<script setup>
import { tonoCicloVida, etiquetaCicloVida } from "@/shared/utils/estadoTono.js";
import { ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconFileText, IconGitBranch, IconPlus, IconCopy, IconRefresh, IconAlertTriangle } from "@tabler/icons-vue";
import { computed } from "vue";

const props = defineProps({
  data: { type: Object, required: true }
});
const hover = ref(false);

// Estado de la versión vinculada (badge en el nodo). El detalle de TODAS las versiones va en el drawer.
const lifecycleState = computed(() => String(props.data.lifecycle_state || "published"));
const stateLabel = computed(() => etiquetaCicloVida(lifecycleState.value));
/* El tono y el punto salen del diccionario. Antes eran DOS mapas independientes —`stateBadgeClass`
   y `stateDotClass`— para el mismo campo, y discrepaban: «retirado» era `surface/line` en la
   pastilla y `gray-400` en el punto. */
const tonoEstado = computed(() => tonoCicloVida(lifecycleState.value));
// Señal de salud: una config ACTIVA debería usar la versión publicada. Si usa una no publicada (retirada/borrador)
// = "hueco" → ⚠. En configs borrador es normal (trabajo en curso), no se marca.
const isUnhealthy = computed(() => String(props.data.parentConfigStatus) === "active" && lifecycleState.value !== "published");
</script>

