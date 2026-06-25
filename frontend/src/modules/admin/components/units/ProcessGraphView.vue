<template>
  <div class="unit-graph-view flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <span class="font-semibold text-slate-700">Mapa de procesos</span>
        <span>· {{ nodes.length }} procesos · {{ edges.length }} relaciones</span>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <input v-model="showInactive" type="checkbox" class="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
          Mostrar inactivos
        </label>
        <AppButton v-if="editable" variant="secondary" size="sm" :disabled="loading" @click="openCreateProcess('root', null, '')">+ Proceso</AppButton>
        <AppButton variant="secondary" size="sm" :disabled="loading" @click="loadGraph">Refrescar</AppButton>
      </div>
    </div>

    <p class="m-0 text-xs text-slate-400">
      Jerarquía padre→hijo de procesos (procesos macro y sub-procesos).
      <template v-if="editable"> Pasa el cursor sobre un proceso para editar / agregar hijos, o arrastra desde su punto inferior al superior de otro para anidarlo. Usa el botón de la relación para desvincular (el hijo queda como raíz).</template>
      <template v-else> Vista de solo lectura: no tienes permisos para editar.</template>
    </p>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1.5">
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Buscar proceso…"
          class="h-8 w-52 rounded-lg border border-slate-300 px-3 text-xs outline-none focus:border-indigo-400"
          @keyup.enter="searchAndCenter"
        />
        <AppButton variant="secondary" size="sm" @click="searchAndCenter">Buscar</AppButton>
      </div>
      <AppButton variant="secondary" size="sm" :disabled="exporting" @click="exportPng">{{ exporting ? "Exportando…" : "Exportar PNG" }}</AppButton>
    </div>

    <div v-if="feedback.message" class="rounded-xl px-3 py-2 text-sm font-medium" :class="feedback.kind === 'error' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'">
      {{ feedback.message }}
    </div>

    <div class="unit-graph-canvas rounded-2xl border border-slate-200 bg-slate-50">
      <div v-if="loading" class="flex h-full items-center justify-center text-sm text-slate-500">Cargando mapa de procesos…</div>
      <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-rose-500">{{ error }}</div>
      <div v-else-if="!nodes.length" class="flex h-full items-center justify-center text-sm text-slate-400">No hay procesos para mostrar.</div>
      <VueFlow
        v-else
        v-model:nodes="nodes"
        v-model:edges="edges"
        :min-zoom="0.2"
        :max-zoom="2"
        :nodes-connectable="editable"
        :edges-updatable="editable"
        :delete-key-code="null"
        :only-render-visible-elements="true"
        fit-view-on-init
        class="h-full"
        @connect="onConnect"
        @node-click="onNodeClick"
        @edge-update="onEdgeUpdate"
      >
        <Background pattern-color="#cbd5e1" :gap="20" />
        <Controls />
        <template #node-process="nodeProps">
          <ProcessNode :data="nodeProps.data" />
        </template>
        <template #edge-process="edgeProps">
          <UnitEdge v-bind="edgeProps" />
        </template>
      </VueFlow>
    </div>

    <!-- Confirmar desvincular -->
    <AppDialogOverlay :open="Boolean(selectedEdge)" title="Desvincular proceso" panel-class="max-w-md" @close="selectedEdge = null">
      <p class="m-0 text-sm text-slate-600">
        ¿Desvincular <strong>{{ selectedEdgeLabel }}</strong>? El sub-proceso quedará como proceso raíz (sin padre).
      </p>
      <template #footer>
        <AppButton variant="cancel" @click="selectedEdge = null">Cancelar</AppButton>
        <AppButton variant="danger" @click="confirmDeleteEdge">Desvincular</AppButton>
      </template>
    </AppDialogOverlay>

    <!-- Crear proceso (raíz / hijo / hermano) -->
    <AppDialogOverlay :open="Boolean(createContext)" :title="createDialogTitle" panel-class="max-w-md" @close="createContext = null">
      <p class="m-0 mb-3 text-sm text-slate-600">{{ createDialogHint }}</p>
      <div class="flex flex-col gap-3">
        <label class="block text-sm font-medium text-slate-700">
          Nombre
          <input v-model="createForm.name" type="text" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-400" placeholder="Nombre del proceso" />
        </label>
        <label class="block text-sm font-medium text-slate-700">
          Identificador (slug) <span class="font-normal text-slate-400">(opcional)</span>
          <input v-model="createForm.slug" type="text" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-400" placeholder="se deriva del nombre" />
        </label>
      </div>
      <template #footer>
        <AppButton variant="cancel" @click="createContext = null">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="!createForm.name.trim()" @click="confirmCreateProcess">Crear</AppButton>
      </template>
    </AppDialogOverlay>

    <!-- Drawer: cockpit del proceso (configuraciones, datos generales, sub-procesos, lanzamientos) -->
    <div v-if="detailProcess" class="proc-detail-overlay" @click.self="closeDetail">
      <aside class="proc-detail-drawer">
        <header class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div class="min-w-0">
            <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Detalle de proceso</p>
            <h3 class="m-0 mt-0.5 truncate text-base font-bold text-slate-800">{{ detailProcess.name }}</h3>
          </div>
          <button type="button" class="shrink-0 text-slate-400 transition-colors hover:text-slate-600" title="Cerrar" @click="closeDetail">
            <IconX class="h-5 w-5" />
          </button>
        </header>

        <div class="flex gap-4 border-b border-slate-200 px-5">
          <button type="button" class="proc-detail-tab" :class="detailTab === 'configuraciones' ? 'proc-detail-tab--active' : ''" @click="detailTab = 'configuraciones'">Configuraciones</button>
          <button type="button" class="proc-detail-tab" :class="detailTab === 'general' ? 'proc-detail-tab--active' : ''" @click="detailTab = 'general'">Datos generales</button>
          <button type="button" class="proc-detail-tab" :class="detailTab === 'subprocesos' ? 'proc-detail-tab--active' : ''" @click="detailTab = 'subprocesos'">Sub-procesos</button>
          <button type="button" class="proc-detail-tab" :class="detailTab === 'corridas' ? 'proc-detail-tab--active' : ''" @click="detailTab = 'corridas'">Lanzamientos</button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <div v-if="detailLoading" class="text-sm text-slate-500">Cargando…</div>
          <template v-else>
            <!-- Pestaña: Configuraciones -->
            <div v-show="detailTab === 'configuraciones'">
              <div class="mb-3 flex items-center justify-between gap-2">
                <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">Configuraciones</p>
                <AppButton v-if="editable" variant="primary" size="sm" @click="createConfiguration">+ Nueva configuración</AppButton>
              </div>
              <div v-if="!detailConfigurations.length" class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                Este proceso no tiene configuraciones.
              </div>
              <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
                <li v-for="cfg in detailConfigurations" :key="cfg.definition_id" class="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-semibold text-slate-800" :title="cfg.definition_name">{{ cfg.definition_name }}</span>
                    <span class="ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1" :class="configStatusClass(cfg.status)">{{ configStatusLabel(cfg.status) }}</span>
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">{{ seriesLabel(cfg) }}</span>
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200">{{ cfg.variation_key }}</span>
                    <span>v{{ cfg.definition_version }}</span>
                  </div>
                  <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200">{{ cfg.rules_count }} reglas</span>
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200">{{ cfg.templates_count }} plantillas</span>
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200">{{ cfg.runs_count }} corridas</span>
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <template v-if="editable && cfg.status === 'draft'">
                      <button type="button" class="font-semibold text-indigo-600 hover:underline" @click="editConfiguration(cfg, 'definition')">Editar</button>
                      <span class="text-slate-300">·</span>
                      <button type="button" class="font-semibold text-slate-600 hover:underline" @click="editConfiguration(cfg, 'rules')">Reglas</button>
                      <button type="button" class="font-semibold text-slate-600 hover:underline" @click="editConfiguration(cfg, 'triggers')">Disparadores</button>
                      <button type="button" class="font-semibold text-slate-600 hover:underline" @click="editConfiguration(cfg, 'packages')">Plantillas</button>
                    </template>
                    <template v-else>
                      <button type="button" class="font-semibold text-indigo-600 hover:underline" @click="editConfiguration(cfg, 'definition')">Ver</button>
                      <button v-if="editable && cfg.status === 'active'" type="button" class="font-semibold text-emerald-600 hover:underline" @click="launchConfiguration(cfg)">Lanzar</button>
                    </template>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Pestaña: Datos generales -->
            <div v-show="detailTab === 'general'">
              <p class="m-0 mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Datos generales</p>
              <fieldset :disabled="!editable" class="m-0 flex flex-col gap-3 border-0 p-0">
                <label class="block text-sm font-medium text-slate-700">
                  Nombre
                  <input v-model="generalForm.name" type="text" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-400" />
                </label>
                <label class="block text-sm font-medium text-slate-700">
                  Identificador (slug)
                  <input v-model="generalForm.slug" type="text" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-400" />
                </label>
                <label class="block text-sm font-medium text-slate-700">
                  Proceso padre
                  <select v-model="generalForm.parent_id" class="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-indigo-400">
                    <option value="">— Sin padre (raíz) —</option>
                    <option v-for="opt in parentOptions" :key="opt.id" :value="String(opt.id)">{{ opt.name }}</option>
                  </select>
                </label>
                <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input v-model="generalForm.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" /> Activo
                </label>
              </fieldset>
              <div v-if="editable" class="mt-4 flex justify-end gap-2">
                <AppButton variant="secondary" size="sm" :disabled="savingGeneral" @click="resetGeneralForm">Revertir</AppButton>
                <AppButton variant="primary" size="sm" :disabled="savingGeneral || !generalForm.name.trim()" @click="saveGeneral">{{ savingGeneral ? "Guardando…" : "Guardar" }}</AppButton>
              </div>
            </div>

            <!-- Pestaña: Sub-procesos -->
            <div v-show="detailTab === 'subprocesos'">
              <div class="mb-3 flex items-center justify-between gap-2">
                <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">Sub-procesos</p>
                <AppButton v-if="editable" variant="secondary" size="sm" @click="addChildFromDrawer">+ Sub-proceso</AppButton>
              </div>
              <div v-if="!detailChildren.length" class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                Este proceso no tiene sub-procesos.
              </div>
              <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
                <li v-for="ch in detailChildren" :key="ch.id" class="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-semibold text-slate-800">{{ ch.name }}</span>
                    <span v-if="!ch.is_active" class="text-[11px] font-semibold text-rose-500">Inactivo</span>
                    <span
                      class="ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1"
                      :class="ch.active_count ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : (ch.definitions_count ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-500 ring-slate-200')"
                    >{{ ch.definitions_count ? `${ch.active_count}/${ch.definitions_count} config.` : "Sin config." }}</span>
                  </div>
                  <div class="mt-1.5 flex items-center gap-2 text-xs">
                    <span class="truncate text-slate-400">{{ ch.slug }}</span>
                    <button type="button" class="ml-auto text-[11px] font-semibold text-indigo-600 hover:underline" @click="openProcessDetail(ch.id)">Abrir</button>
                    <button v-if="editable" type="button" class="text-[11px] font-semibold text-rose-600 hover:underline" @click="detachChild(ch.id)">Desvincular</button>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Pestaña: Lanzamientos / corridas -->
            <div v-show="detailTab === 'corridas'">
              <p class="m-0 mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Lanzamientos / corridas</p>
              <div v-if="!detailRuns.length" class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                Este proceso no tiene corridas registradas.
              </div>
              <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
                <li v-for="run in detailRuns" :key="run.id" class="rounded-xl border border-slate-200 px-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-semibold text-slate-800">{{ run.term_name || "Sin periodo" }}</span>
                    <span class="ml-auto inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ring-1" :class="runStatusClass(run.status)">{{ run.status }}</span>
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span class="truncate">{{ run.definition_name }} · v{{ run.definition_version }}</span>
                    <span class="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">{{ run.run_mode === "automatic" ? "Automática" : "Manual" }}</span>
                    <span v-if="run.source_run_id" class="italic text-slate-400">relanzamiento</span>
                  </div>
                </li>
              </ul>
              <p class="m-0 mt-3 text-[11px] leading-snug text-slate-400">El lanzamiento de nuevas corridas se habilitará en el siguiente paso.</p>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { VueFlow, MarkerType, useVueFlow } from "@vue-flow/core";
import { toPng } from "html-to-image";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "dagre";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";
import { IconX } from "@tabler/icons-vue";
import ProcessNode from "./ProcessNode.vue";
import UnitEdge from "./UnitEdge.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  editable: { type: Boolean, default: true }
});
// El drawer delega en el padre la apertura de modales (wizard / lanzar): se cierra primero y emite, para
// no apilar capas (un modal a la vez). El padre reabre el drawer al cerrar el modal (reopenDetail).
const emit = defineEmits(["open-config-wizard", "edit-config", "launch-config"]);

const NODE_W = 210;
const NODE_H = 64;
const EDGE_COLOR = "#6366f1";

const nodes = ref([]);
const edges = ref([]);
const rawGraph = ref({ nodes: [], edges: [] });
const loading = ref(false);
const error = ref("");
const showInactive = ref(true);
const selectedEdge = ref(null);
const createContext = ref(null);
const createForm = ref({ name: "", slug: "" });
const searchTerm = ref("");
const highlightId = ref("");
const collapsedIds = ref(new Set());
const exporting = ref(false);
const feedback = ref({ kind: "", message: "" });
let feedbackTimer = null;

// Drawer / cockpit del proceso (réplica del de unidades): detalle con pestañas.
const detailProcess = ref(null);
const detailTab = ref("configuraciones");
const detailLoading = ref(false);
const detailConfigurations = ref([]);
const detailChildren = ref([]);
const detailRuns = ref([]);
const generalForm = ref({ name: "", slug: "", parent_id: "", is_active: true });
const savingGeneral = ref(false);

const { fitView } = useVueFlow();

const nodeNameById = computed(() => {
  const map = new Map();
  (rawGraph.value.nodes || []).forEach((p) => map.set(String(p.id), p.name));
  return map;
});
const edgeLabel = (edge) => {
  if (!edge) return "";
  const p = nodeNameById.value.get(String(edge.source)) || edge.source;
  const c = nodeNameById.value.get(String(edge.target)) || edge.target;
  return `${p} → ${c}`;
};
const selectedEdgeLabel = computed(() => edgeLabel(selectedEdge.value));

const childrenMap = computed(() => {
  const map = new Map();
  (rawGraph.value.edges || []).forEach((e) => {
    const p = String(e.parent_process_id);
    if (!map.has(p)) map.set(p, []);
    map.get(p).push(String(e.child_process_id));
  });
  return map;
});
const hiddenByCollapse = computed(() => {
  const hidden = new Set();
  const walk = (id) => {
    (childrenMap.value.get(String(id)) || []).forEach((childId) => {
      if (!hidden.has(childId)) {
        hidden.add(childId);
        walk(childId);
      }
    });
  };
  collapsedIds.value.forEach((id) => walk(id));
  return hidden;
});

const toggleCollapse = (processId) => {
  const id = String(processId);
  const next = new Set(collapsedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsedIds.value = next;
  buildGraph();
};

const setFeedback = (kind, message) => {
  feedback.value = { kind, message };
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.value = { kind: "", message: "" }; }, 4000);
};

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
  const hidden = hiddenByCollapse.value;
  const apiNodes = (rawGraph.value.nodes || []).filter(
    (p) => (showInactive.value || Number(p.is_active) === 1) && !hidden.has(String(p.id))
  );
  const visibleIds = new Set(apiNodes.map((p) => String(p.id)));
  const rawNodes = apiNodes.map((p) => ({
    id: String(p.id),
    type: "process",
    position: { x: 0, y: 0 },
    data: {
      ...p,
      editable: props.editable,
      onEdit: editProcess,
      onAddChild,
      onAddSibling,
      onToggleCollapse: toggleCollapse,
      hasChildren: childrenMap.value.has(String(p.id)),
      collapsed: collapsedIds.value.has(String(p.id)),
      highlighted: highlightId.value === String(p.id)
    }
  }));
  const rawEdges = (rawGraph.value.edges || [])
    .filter((e) => visibleIds.has(String(e.parent_process_id)) && visibleIds.has(String(e.child_process_id)))
    .map((e) => ({
      id: e.id,
      type: "process",
      source: String(e.parent_process_id),
      target: String(e.child_process_id),
      updatable: props.editable,
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
      style: { stroke: EDGE_COLOR, strokeWidth: 1.6 },
      data: {
        childProcessId: e.child_process_id,
        editable: props.editable,
        onDelete: openDeleteEdge
      }
    }));
  nodes.value = rawNodes.length ? layout(rawNodes, rawEdges) : [];
  edges.value = rawEdges;
};

const loadGraph = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getProcessGraph();
    rawGraph.value = { nodes: data.nodes || [], edges: data.edges || [] };
    buildGraph();
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo cargar el mapa de procesos.";
  } finally {
    loading.value = false;
  }
};

const rawProcessById = (processId) =>
  (rawGraph.value.nodes || []).find((p) => String(p.id) === String(processId)) || null;

// Clic en el nodo abre el drawer (detalle); el ✎ del hover lo abre en "Datos generales".
const onNodeClick = ({ node }) => {
  if (!node?.data) return;
  openProcessDetail(node.data.id);
};
const editProcess = (processId) => openProcessDetail(processId, "general");

// Opciones de proceso padre (todos menos el propio; el backend bloquea ciclos).
const parentOptions = computed(() =>
  (rawGraph.value.nodes || [])
    .filter((p) => String(p.id) !== String(detailProcess.value?.id))
    .map((p) => ({ id: p.id, name: p.name }))
);

const resetGeneralForm = () => {
  const p = detailProcess.value;
  generalForm.value = {
    name: p?.name || "",
    slug: p?.slug || "",
    parent_id: p?.parent_id ? String(p.parent_id) : "",
    is_active: Number(p?.is_active) === 1
  };
};

const openProcessDetail = async (processId, tab = "configuraciones") => {
  const p = rawProcessById(processId);
  detailProcess.value = p
    ? { id: p.id, name: p.name, slug: p.slug, parent_id: p.parent_id, is_active: p.is_active }
    : { id: processId, name: "" };
  detailTab.value = tab;
  detailLoading.value = true;
  try {
    const { data } = await adminSqlService.getProcessDetail(processId);
    detailProcess.value = data.process || detailProcess.value;
    detailConfigurations.value = data.configurations || [];
    detailChildren.value = data.children || [];
    detailRuns.value = data.runs || [];
    resetGeneralForm();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cargar el detalle del proceso.");
    detailProcess.value = null;
  } finally {
    detailLoading.value = false;
  }
};
const closeDetail = () => { detailProcess.value = null; };

const saveGeneral = async () => {
  const p = detailProcess.value;
  if (!p?.id || !generalForm.value.name.trim()) return;
  savingGeneral.value = true;
  try {
    await adminSqlService.update(
      "processes",
      { id: p.id },
      {
        name: generalForm.value.name.trim(),
        slug: generalForm.value.slug.trim(),
        is_active: generalForm.value.is_active ? 1 : 0
      }
    );
    const nextParent = generalForm.value.parent_id ? Number(generalForm.value.parent_id) : null;
    if (Number(p.parent_id || 0) !== Number(nextParent || 0)) {
      await adminSqlService.setProcessParent(p.id, nextParent);
    }
    setFeedback("success", "Proceso actualizado.");
    await loadGraph();
    await openProcessDetail(p.id, "general");
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo actualizar el proceso.");
  } finally {
    savingGeneral.value = false;
  }
};

const addChildFromDrawer = () => {
  if (!detailProcess.value?.id) return;
  openCreateProcess("child", detailProcess.value.id, detailProcess.value.name);
};
const detachChild = async (childId) => {
  try {
    await adminSqlService.setProcessParent(Number(childId), null);
    setFeedback("success", "Sub-proceso desvinculado.");
    await loadGraph();
    if (detailProcess.value?.id) await openProcessDetail(detailProcess.value.id, "subprocesos");
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo desvincular el sub-proceso.");
  }
};

const configStatusClass = (status) => {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "draft") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
};
const configStatusLabel = (status) => ({ active: "Activa", draft: "Borrador", retired: "Retirada" }[status] || status);
const seriesLabel = (cfg) => {
  if (cfg.series_source_type === "cargo") return `Cargo · ${cfg.series_cargo_name || cfg.series_code}`;
  if (cfg.series_source_type === "unit_type") return `Tipo · ${cfg.series_unit_type_name || cfg.series_code}`;
  return "General";
};
const runStatusClass = (status) => {
  if (status === "active") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "completed") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (status === "pending") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-500 ring-slate-200";
};

// Acciones de configuración: cierran el drawer y delegan en el padre (wizard / lanzar).
const createConfiguration = () => {
  if (!detailProcess.value?.id) return;
  const payload = { processId: detailProcess.value.id, processName: detailProcess.value.name };
  closeDetail();
  emit("open-config-wizard", payload);
};
const editConfiguration = (cfg, step = "definition") => {
  if (!detailProcess.value?.id || !cfg?.definition_id) return;
  const payload = {
    processId: detailProcess.value.id,
    definition: { ...cfg, process_name: detailProcess.value.name },
    step,
    readonly: cfg.status !== "draft"
  };
  closeDetail();
  emit("edit-config", payload);
};
const launchConfiguration = (cfg) => {
  if (!detailProcess.value?.id || !cfg?.definition_id) return;
  const payload = {
    processId: detailProcess.value.id,
    definition: { ...cfg, process_name: detailProcess.value.name }
  };
  closeDetail();
  emit("launch-config", payload);
};

const parentProcessIdOf = (childId) => {
  const edge = (rawGraph.value.edges || []).find((e) => String(e.child_process_id) === String(childId));
  return edge ? edge.parent_process_id : null;
};

const openCreateProcess = (mode, parentProcessId, anchorName) => {
  if (!props.editable) return;
  createForm.value = { name: "", slug: "" };
  createContext.value = { mode, parentProcessId: parentProcessId || null, anchorName: anchorName || "" };
};
const onAddChild = (processId) => {
  openCreateProcess("child", processId, nodeNameById.value.get(String(processId)));
};
const onAddSibling = (processId) => {
  const parentId = parentProcessIdOf(processId);
  openCreateProcess("sibling", parentId, nodeNameById.value.get(String(processId)));
};

const createDialogTitle = computed(() => {
  if (createContext.value?.mode === "child") return "Agregar sub-proceso";
  if (createContext.value?.mode === "sibling") return "Agregar proceso hermano";
  return "Agregar proceso";
});
const createDialogHint = computed(() => {
  const ctx = createContext.value;
  if (!ctx) return "";
  if (ctx.mode === "child") return `Se creará como sub-proceso de "${ctx.anchorName}".`;
  if (ctx.mode === "sibling") {
    return ctx.parentProcessId
      ? `Se creará bajo el mismo padre que "${ctx.anchorName}".`
      : `"${ctx.anchorName}" es raíz: el nuevo proceso se creará sin padre.`;
  }
  return "Se creará como proceso raíz (sin padre).";
});

const confirmCreateProcess = async () => {
  const ctx = createContext.value;
  const form = createForm.value;
  if (!ctx || !form.name.trim()) return;
  try {
    await adminSqlService.createProcessWithParent({
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      parent_id: ctx.parentProcessId || null
    });
    createContext.value = null;
    setFeedback("success", "Proceso creado.");
    await loadGraph();
    if (detailProcess.value?.id) await openProcessDetail(detailProcess.value.id, "subprocesos");
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo crear el proceso.");
  }
};

// Conectar source→target = anidar target bajo source (su padre pasa a ser source).
const onConnect = async ({ source, target }) => {
  if (!props.editable || !source || !target || source === target) return;
  try {
    await adminSqlService.setProcessParent(Number(target), Number(source));
    setFeedback("success", "Proceso anidado.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo anidar el proceso.");
    await loadGraph();
  }
};

const findEdgeById = (edgeId) => edges.value.find((e) => e.id === edgeId) || null;
const openDeleteEdge = (edgeId) => {
  if (!props.editable) return;
  selectedEdge.value = findEdgeById(edgeId);
};
const confirmDeleteEdge = async () => {
  const edge = selectedEdge.value;
  selectedEdge.value = null;
  const childId = edge?.data?.childProcessId;
  if (!childId) return;
  try {
    await adminSqlService.setProcessParent(Number(childId), null);
    setFeedback("success", "Proceso desvinculado.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo desvincular el proceso.");
  }
};

// Reparentar arrastrando el extremo de la arista a otro nodo padre.
const onEdgeUpdate = async ({ edge, connection }) => {
  if (!props.editable) return;
  const childId = edge?.data?.childProcessId;
  const source = connection?.source;
  const target = connection?.target;
  if (!childId || !source || !target || source === target) return;
  try {
    await adminSqlService.setProcessParent(Number(target), Number(source));
    setFeedback("success", "Relación reasignada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo reasignar la relación.");
    await loadGraph();
  }
};

const searchAndCenter = () => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return;
  const match = (rawGraph.value.nodes || []).find((p) =>
    String(p.name || "").toLowerCase().includes(term) || String(p.slug || "").toLowerCase().includes(term)
  );
  if (!match) {
    setFeedback("error", "No se encontró ningún proceso con ese nombre.");
    return;
  }
  if (hiddenByCollapse.value.has(String(match.id))) {
    collapsedIds.value = new Set();
    buildGraph();
  }
  highlightId.value = String(match.id);
  buildGraph();
  fitView({ nodes: [{ id: String(match.id) }], duration: 600, maxZoom: 1.2, padding: 0.6 });
};

const exportPng = async () => {
  const container = document.querySelector(".unit-graph-canvas .vue-flow");
  const el = document.querySelector(".unit-graph-canvas .vue-flow__viewport");
  const target = container || el;
  if (!target) return;
  exporting.value = true;
  try {
    const dataUrl = await toPng(target, { backgroundColor: "#ffffff", pixelRatio: 2 });
    const a = document.createElement("a");
    a.download = "mapa-procesos.png";
    a.href = dataUrl;
    a.click();
    setFeedback("success", "Mapa de procesos exportado.");
  } catch (e) {
    setFeedback("error", "No se pudo exportar la imagen.");
  } finally {
    exporting.value = false;
  }
};

watch(showInactive, buildGraph);
onMounted(loadGraph);

defineExpose({
  reloadGraph: loadGraph,
  openDetail: openProcessDetail,
  // Tras cerrar un modal externo (wizard/lanzar): recarga el grafo (badges) y reabre el drawer.
  reopenDetail: async (processId) => {
    await loadGraph();
    await openProcessDetail(processId, "configuraciones");
  }
});
</script>

<style scoped>
.unit-graph-canvas {
  height: 70vh;
  min-height: 28rem;
}
.proc-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1075;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(1px);
}
.proc-detail-drawer {
  display: flex;
  flex-direction: column;
  width: min(30rem, 100vw);
  height: 100%;
  background: #fff;
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.18);
}
.proc-detail-tab {
  position: relative;
  padding: 0.6rem 0.15rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.proc-detail-tab:hover {
  color: #334155;
}
.proc-detail-tab--active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}
</style>
