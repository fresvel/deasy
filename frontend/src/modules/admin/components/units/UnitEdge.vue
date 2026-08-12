<template>
  <BaseEdge :id="id" :path="edgePath" :marker-end="markerEnd" :style="style" />
  <EdgeLabelRenderer>
    <div
      v-if="data?.editable"
      class="nodrag nopan graph-edge-toolbar"
      :style="toolbarStyle"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
    >
      <button v-if="data?.onEdit" type="button" class="graph-edge-btn" title="Cambiar tipo de relación" @click.stop="data?.onEdit?.(id)">
        <IconPencil class="h-3.5 w-3.5" />
      </button>
      <button type="button" class="graph-edge-btn graph-edge-btn--danger" title="Quitar relación" @click.stop="data?.onDelete?.(id)">
        <IconX class="h-3.5 w-3.5" />
      </button>
    </div>
  </EdgeLabelRenderer>
</template>

<script setup>
import { computed, ref } from "vue";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@vue-flow/core";
import { IconPencil, IconX } from "@tabler/icons-vue";

// Vue Flow pasa muchos props de arista; el componente renderiza un fragment (BaseEdge + EdgeLabelRenderer),
// así que se desactiva la herencia de atributos para evitar warnings de "extraneous non-props attributes".
defineOptions({ inheritAttrs: false });

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, default: 0 },
  sourceY: { type: Number, default: 0 },
  targetX: { type: Number, default: 0 },
  targetY: { type: Number, default: 0 },
  sourcePosition: { type: String, default: "bottom" },
  targetPosition: { type: String, default: "top" },
  markerEnd: { type: String, default: "" },
  style: { type: Object, default: () => ({}) },
  data: { type: Object, default: () => ({}) }
});

const hover = ref(false);
const pathData = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition
  })
);
const edgePath = computed(() => pathData.value[0]);
const toolbarStyle = computed(() => ({
  position: "absolute",
  transform: `translate(-50%, -50%) translate(${pathData.value[1]}px, ${pathData.value[2]}px)`,
  pointerEvents: "all",
  opacity: hover.value ? 1 : 0.55
}));
</script>
