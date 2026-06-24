<template>
  <div class="unit-graph-view flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <span class="font-semibold text-slate-700">Organigrama</span>
        <span>· {{ nodes.length }} unidades · {{ edges.length }} relaciones</span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          Relación
          <select
            v-model="activeRelationType"
            class="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
          >
            <option v-for="rt in relationTypes" :key="rt.id" :value="rt.code">{{ rt.name }}</option>
            <option value="all">Todos los tipos</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input v-model="showInactive" type="checkbox" class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
          Mostrar inactivas
        </label>
        <AppButton v-if="editable" variant="secondary" size="sm" :disabled="loading" @click="$emit('create-unit')">+ Unidad</AppButton>
        <AppButton variant="secondary" size="sm" :disabled="loading" @click="loadGraph">Refrescar</AppButton>
      </div>
    </div>

    <p class="m-0 text-xs text-slate-400">
      <template v-if="editable">Arrastra desde el punto inferior de una unidad al superior de otra para crear una relación padre→hija. Haz clic en una unidad para editarla o en una relación para quitarla.</template>
      <template v-else>Vista de solo lectura. No tienes permisos para editar unidades ni relaciones.</template>
    </p>

    <!-- Leyenda de tipos de relación presentes -->
    <div v-if="legend.length > 1" class="flex flex-wrap items-center gap-3">
      <span v-for="item in legend" :key="item.code" class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <span class="inline-block h-2.5 w-4 rounded-full" :style="{ backgroundColor: item.color }"></span>
        {{ item.name }}
      </span>
    </div>

    <div v-if="feedback.message" class="rounded-xl px-3 py-2 text-sm font-medium" :class="feedback.kind === 'error' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'">
      {{ feedback.message }}
    </div>

    <div class="unit-graph-canvas rounded-2xl border border-slate-200 bg-slate-50">
      <div v-if="loading" class="flex h-full items-center justify-center text-sm text-slate-500">Cargando organigrama…</div>
      <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-rose-500">{{ error }}</div>
      <div v-else-if="!nodes.length" class="flex h-full items-center justify-center text-sm text-slate-400">No hay unidades para mostrar.</div>
      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :min-zoom="0.2"
        :max-zoom="2"
        :nodes-connectable="editable"
        :only-render-visible-elements="true"
        fit-view-on-init
        class="h-full"
        @connect="onConnect"
        @node-click="onNodeClick"
        @edge-click="onEdgeClick"
      >
        <Background pattern-color="#cbd5e1" :gap="20" />
        <Controls />
        <template #node-unit="nodeProps">
          <UnitNode :data="nodeProps.data" />
        </template>
      </VueFlow>
    </div>

    <!-- Confirmar quitar relación -->
    <AppDialogOverlay
      :open="Boolean(selectedEdge)"
      title="Quitar relación"
      panel-class="max-w-md"
      @close="selectedEdge = null"
    >
      <p class="m-0 text-sm text-slate-600">
        ¿Quitar la relación <strong>{{ selectedEdgeLabel }}</strong>? La unidad hija quedará sin padre en este tipo de relación.
      </p>
      <template #footer>
        <AppButton variant="cancel" @click="selectedEdge = null">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmDeleteEdge">Quitar</AppButton>
      </template>
    </AppDialogOverlay>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { VueFlow, MarkerType } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "dagre";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";
import UnitNode from "./UnitNode.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  relationType: { type: String, default: "org" },
  editable: { type: Boolean, default: true }
});
const emit = defineEmits(["edit-unit", "create-unit"]);

const EDGE_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

const nodes = ref([]);
const edges = ref([]);
const rawGraph = ref({ nodes: [], edges: [] });
const relationTypes = ref([]);
const activeRelationType = ref(props.relationType);
const loading = ref(false);
const error = ref("");
const showInactive = ref(true);
const selectedEdge = ref(null);
const feedback = ref({ kind: "", message: "" });
let feedbackTimer = null;

const NODE_W = 210;
const NODE_H = 64;

const relationColorMap = computed(() => {
  const map = new Map();
  relationTypes.value.forEach((rt, idx) => map.set(rt.code, EDGE_PALETTE[idx % EDGE_PALETTE.length]));
  return map;
});
const colorForCode = (code) => relationColorMap.value.get(code) || "#94a3b8";

const nodeNameById = computed(() => {
  const map = new Map();
  (rawGraph.value.nodes || []).forEach((u) => map.set(String(u.id), u.name));
  return map;
});
const selectedEdgeLabel = computed(() => {
  if (!selectedEdge.value) return "";
  const p = nodeNameById.value.get(String(selectedEdge.value.source)) || selectedEdge.value.source;
  const c = nodeNameById.value.get(String(selectedEdge.value.target)) || selectedEdge.value.target;
  return `${p} → ${c}`;
});
const legend = computed(() => {
  const codes = new Set((rawGraph.value.edges || []).map((e) => e.relation_type_code));
  return relationTypes.value
    .filter((rt) => codes.has(rt.code))
    .map((rt) => ({ code: rt.code, name: rt.name, color: colorForCode(rt.code) }));
});

const setFeedback = (kind, message) => {
  feedback.value = { kind, message };
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.value = { kind: "", message: "" }; }, 4000);
};

// Auto-layout jerárquico (top-down) con dagre.
const layout = (rawNodes, rawEdges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 45, ranksep: 75 });
  g.setDefaultEdgeLabel(() => ({}));
  rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return rawNodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
};

const buildGraph = () => {
  const apiNodes = (rawGraph.value.nodes || []).filter(
    (u) => showInactive.value || Number(u.is_active) === 1
  );
  const visibleIds = new Set(apiNodes.map((u) => String(u.id)));
  const rawNodes = apiNodes.map((u) => ({
    id: String(u.id),
    type: "unit",
    position: { x: 0, y: 0 },
    data: u
  }));
  const rawEdges = (rawGraph.value.edges || [])
    .filter((e) => visibleIds.has(String(e.parent_unit_id)) && visibleIds.has(String(e.child_unit_id)))
    .map((e) => {
      const color = colorForCode(e.relation_type_code);
      return {
        id: `e${e.id}`,
        source: String(e.parent_unit_id),
        target: String(e.child_unit_id),
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 1.6 },
        data: { relationId: e.id, relationTypeId: e.relation_type_id, code: e.relation_type_code }
      };
    });
  nodes.value = rawNodes.length ? layout(rawNodes, rawEdges) : [];
  edges.value = rawEdges;
};

const loadGraph = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getUnitGraph(activeRelationType.value);
    rawGraph.value = { nodes: data.nodes || [], edges: data.edges || [] };
    relationTypes.value = data.relationTypes || [];
    buildGraph();
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo cargar el organigrama.";
  } finally {
    loading.value = false;
  }
};

// Fase 3: clic en nodo abre el editor de unidad existente (en el componente padre).
const onNodeClick = ({ node }) => {
  if (!props.editable || !node?.data) return;
  emit("edit-unit", { ...node.data });
};

// Fase 4: conectar dos nodos crea la relación padre(source)→hija(target).
const onConnect = async ({ source, target }) => {
  if (!props.editable || !source || !target || source === target) return;
  if (activeRelationType.value === "all") {
    setFeedback("error", "Elige un tipo de relación específico (no 'Todos') para crear aristas.");
    return;
  }
  const rtId = relationTypes.value.find((r) => r.code === activeRelationType.value)?.id;
  if (!rtId) {
    setFeedback("error", "No se encontró el tipo de relación para crear la arista.");
    return;
  }
  try {
    await adminSqlService.create("unit_relations", {
      relation_type_id: rtId,
      parent_unit_id: Number(source),
      child_unit_id: Number(target)
    });
    setFeedback("success", "Relación creada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear la relación.");
    await loadGraph();
  }
};

const onEdgeClick = ({ edge }) => {
  if (!props.editable) return;
  selectedEdge.value = edge || null;
};

const confirmDeleteEdge = async () => {
  const edge = selectedEdge.value;
  selectedEdge.value = null;
  if (!edge?.data?.relationId) return;
  try {
    await adminSqlService.remove("unit_relations", { id: edge.data.relationId });
    setFeedback("success", "Relación eliminada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo eliminar la relación.");
  }
};

watch(showInactive, buildGraph);
watch(activeRelationType, loadGraph);
onMounted(loadGraph);

defineExpose({ reloadGraph: loadGraph });
</script>

<style scoped>
.unit-graph-canvas {
  height: 70vh;
  min-height: 28rem;
}
</style>
