<template>
  <div class="unit-graph-view flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Izquierda: regresar + título + contador + ayuda -->
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <AppButton variant="secondary" size="sm" icon-only title="Regresar" aria-label="Regresar" @click="$emit('go-back')">
          <IconArrowLeft class="h-4 w-4" />
        </AppButton>
        <span class="font-semibold text-slate-700">Mapa de procesos</span>
        <span class="text-xs">· {{ nodes.length }} procesos · {{ edges.length }} relaciones</span>
        <AppInfoTip placement="bottom" aria-label="Ayuda del mapa de procesos">
          <template v-if="editable">
            Jerarquía padre→hijo de procesos (procesos macro y sub-procesos). Pasa el cursor sobre un proceso para
            editar / agregar hijos, o arrastra desde su punto inferior al superior de otro para anidarlo. Usa el
            botón de la relación para desvincular (el hijo queda como raíz).
          </template>
          <template v-else>
            Jerarquía padre→hijo de procesos (procesos macro y sub-procesos). Vista de solo lectura: no tienes
            permisos para editar.
          </template>
        </AppInfoTip>
      </div>
      <!-- Derecha: niveles a mostrar (segmented) + refrescar + exportar + crear -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button type="button" class="proc-toggle" :class="showInactive ? 'proc-toggle--on' : ''" title="Mostrar también procesos inactivos" @click="showInactive = !showInactive">Inactivos</button>
          <button type="button" class="proc-toggle" :class="showConfigs ? 'proc-toggle--on' : ''" title="Mostrar las configuraciones de cada proceso" @click="toggleConfigsView">Configuraciones</button>
          <button type="button" class="proc-toggle" :class="showTemplates ? 'proc-toggle--on' : ''" title="Mostrar los entregables de cada configuración" @click="toggleTemplatesView">Entregables</button>
        </div>
        <AppButton variant="secondary" size="sm" icon-only :disabled="loading" title="Refrescar" aria-label="Refrescar" @click="loadGraph">
          <IconRefresh class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </AppButton>
        <AppButton variant="secondary" size="sm" icon-only :disabled="exporting" title="Exportar PNG" aria-label="Exportar PNG" @click="exportPng">
          <IconDownload class="h-4 w-4" />
        </AppButton>
        <AppButton v-if="editable" variant="primary" size="sm" :disabled="loading" title="Crear proceso raíz" @click="openCreateProcess('root', null, '')">
          <IconPlus class="mr-1 h-4 w-4" /> Proceso
        </AppButton>
      </div>
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
        <template #node-config="nodeProps">
          <ProcessConfigNode :data="nodeProps.data" />
        </template>
        <template #node-template="nodeProps">
          <ProcessTemplateNode :data="nodeProps.data" />
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

    <!-- Editar datos generales del proceso (modal, como en unidades) -->
    <AppDialogOverlay :open="Boolean(editingProcess)" title="Editar proceso" panel-class="max-w-md" @close="closeEditModal">
      <div class="flex flex-col gap-3">
        <label class="block text-sm font-medium text-slate-700">
          Nombre
          <input v-model="editForm.name" type="text" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-400" placeholder="Nombre del proceso" />
        </label>
        <label class="block text-sm font-medium text-slate-700">
          Identificador (slug)
          <input v-model="editForm.slug" type="text" class="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-400" placeholder="identificador" />
        </label>
        <label class="block text-sm font-medium text-slate-700">
          Proceso padre
          <select v-model="editForm.parent_id" class="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-indigo-400">
            <option value="">— Sin padre (raíz) —</option>
            <option v-for="opt in parentOptions" :key="opt.id" :value="String(opt.id)">{{ opt.name }}</option>
          </select>
        </label>
        <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input v-model="editForm.is_active" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-indigo-600" /> Activo
        </label>
      </div>
      <template #footer>
        <AppButton variant="cancel" :disabled="savingEdit" @click="closeEditModal">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="savingEdit || !editForm.name.trim()" @click="saveProcessEdit">{{ savingEdit ? "Guardando…" : "Guardar" }}</AppButton>
      </template>
    </AppDialogOverlay>

    <!-- Drawer: cockpit del proceso (configuraciones, sub-procesos, lanzamientos) -->
    <div v-if="detailProcess" class="proc-detail-overlay" @click.self="closeDetail">
      <aside class="proc-detail-drawer">
        <header class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div class="min-w-0">
            <p class="m-0 text-xs font-bold uppercase tracking-wide text-slate-400">Detalle de proceso</p>
            <h3 class="m-0 mt-0.5 truncate text-base font-bold text-slate-800">{{ detailProcess.name }}</h3>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button v-if="editable" type="button" class="text-slate-400 transition-colors hover:text-indigo-600" title="Editar datos del proceso" @click="openEditModal(detailProcess.id)">
              <IconPencil class="h-5 w-5" />
            </button>
            <button type="button" class="text-slate-400 transition-colors hover:text-slate-600" title="Cerrar" @click="closeDetail">
              <IconX class="h-5 w-5" />
            </button>
          </div>
        </header>

        <div class="flex gap-4 border-b border-slate-200 px-5">
          <button type="button" class="proc-detail-tab" :class="detailTab === 'configuraciones' ? 'proc-detail-tab--active' : ''" @click="detailTab = 'configuraciones'">Configuraciones</button>
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

    <!-- Drawer: versiones del entregable (plantilla) -->
    <div v-if="templateDetail" class="proc-detail-overlay" @click.self="closeTemplateVersions">
      <aside class="proc-detail-drawer">
        <div class="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div class="min-w-0">
            <p class="m-0 text-[11px] font-semibold uppercase tracking-wide text-violet-500">Entregable · versiones</p>
            <h3 class="m-0 mt-0.5 truncate text-base font-bold text-slate-800">{{ templateDetail.displayName || templateDetail.templateCode }}</h3>
            <p class="m-0 mt-0.5 truncate text-xs text-slate-400">
              {{ templateDetail.templateCode }}<span v-if="templateDetail.configName"> · en {{ templateDetail.configName }}</span>
            </p>
          </div>
          <button type="button" class="text-slate-400 transition-colors hover:text-slate-600" title="Cerrar" @click="closeTemplateVersions">
            <IconX class="h-5 w-5" />
          </button>
        </div>
        <div v-if="editable" class="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2.5">
          <AppButton variant="secondary" size="sm" @click="versionFromDrawer">+ Nueva versión</AppButton>
          <AppButton v-if="templateDetail.configStatus === 'active'" variant="primary" size="sm" @click="guidedFromDrawer">Actualizar (publicar + activar)</AppButton>
        </div>
        <!-- Señal de salud: la config usa una versión NO publicada de este entregable. -->
        <div v-if="drawerHealthWarning" class="border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <p class="m-0 font-semibold">⚠ La configuración usa una versión {{ drawerHealthWarning.pinnedLabel }} de este entregable.</p>
          <p class="m-0 mt-0.5">
            <template v-if="drawerHealthWarning.publishedVersion && editable">
              Debería usar la versión publicada
              <button type="button" class="font-semibold text-indigo-700 underline" @click="useVersionInConfig(drawerHealthWarning.publishedVersion)">v{{ drawerHealthWarning.publishedVersion.storage_version }}</button>.
            </template>
            <template v-else-if="!drawerHealthWarning.publishedVersion">Este entregable no tiene ninguna versión publicada. Publica una o crea una nueva versión.</template>
          </p>
        </div>
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div v-if="templateDetail.loading" class="text-sm text-slate-500">Cargando…</div>
          <ul v-else-if="templateDetail.versions.length" class="m-0 flex list-none flex-col gap-2 p-0">
            <li
              v-for="v in templateDetail.versions"
              :key="v.id"
              class="cursor-pointer rounded-xl border px-3 py-2.5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
              :class="String(v.id) === String(templateDetail.pinnedArtifactId) ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'"
              role="button"
              tabindex="0"
              :title="v.lifecycle_state === 'draft' ? 'Abrir para editar' : 'Abrir (solo lectura)'"
              @click="openVersionFromDrawer(v)"
              @keydown.enter="openVersionFromDrawer(v)"
              @keydown.space.prevent="openVersionFromDrawer(v)"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-800">v{{ v.storage_version }}</span>
                <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1" :class="versionStateClass(v.lifecycle_state)">{{ versionStateLabel(v.lifecycle_state) }}</span>
                <span v-if="String(v.id) === String(templateDetail.pinnedArtifactId)" class="inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200" title="Versión vinculada a esta configuración">Vinculada aquí</span>
                <span class="ml-auto text-[11px] font-semibold text-indigo-600">{{ v.lifecycle_state === 'draft' ? 'Editar' : 'Ver' }} →</span>
              </div>
              <div class="mt-1 flex items-center justify-between gap-2">
                <span class="text-[11px] text-slate-400">{{ formatVersionDate(v.created_at) }}</span>
                <button
                  v-if="editable && v.lifecycle_state !== 'retired' && String(v.id) !== String(templateDetail.pinnedArtifactId)"
                  type="button"
                  class="rounded-md border border-violet-200 px-2 py-0.5 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  :title="templateDetail.configStatus === 'active' ? 'Prepara un borrador de la configuración con esta versión' : 'La configuración (borrador) usará esta versión'"
                  @click.stop="useVersionInConfig(v)"
                >Usar en esta config</button>
              </div>
            </li>
          </ul>
          <p v-else class="m-0 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">Sin versiones.</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { VueFlow, MarkerType } from "@vue-flow/core";
import { toBlob } from "html-to-image";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "dagre";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppDialogOverlay from "@/shared/components/modals/AppDialogOverlay.vue";
import AppInfoTip from "@/shared/components/widgets/AppInfoTip.vue";
import { IconX, IconPencil, IconArrowLeft, IconRefresh, IconDownload, IconPlus } from "@tabler/icons-vue";
import ProcessNode from "./ProcessNode.vue";
import ProcessConfigNode from "./ProcessConfigNode.vue";
import ProcessTemplateNode from "./ProcessTemplateNode.vue";
import UnitEdge from "./UnitEdge.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  editable: { type: Boolean, default: true }
});
// El drawer delega en el padre la apertura de modales (wizard / lanzar): se cierra primero y emite, para
// no apilar capas (un modal a la vez). El padre reabre el drawer al cerrar el modal (reopenDetail).
const emit = defineEmits([
  "open-config-wizard", "edit-config", "launch-config", "go-back", "version-config", "version-template",
  "add-template", "clone-template", "guided-update-template", "open-template-editor", "notify"
]);

const NODE_W = 210;
const NODE_H = 64;
const CONFIG_W = 190;
const CONFIG_H = 64;
const TEMPLATE_W = 170;
const TEMPLATE_H = 52;
const EDGE_COLOR = "#6366f1";
const CONFIG_EDGE_COLOR = "#94a3b8";
const TEMPLATE_EDGE_COLOR = "#a78bfa";

const nodes = ref([]);
const edges = ref([]);
const rawGraph = ref({ nodes: [], edges: [], configs: [], templates: [] });
const expandedConfigIds = ref(new Set());
const expandedTemplateIds = ref(new Set());
const showConfigs = ref(false);
const showTemplates = ref(false);
const loading = ref(false);
const error = ref("");
const showInactive = ref(true);
const selectedEdge = ref(null);
const createContext = ref(null);
const createForm = ref({ name: "", slug: "" });
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
// Edición de datos generales del proceso en un modal aparte (como en unidades).
const editingProcess = ref(null);
const editForm = ref({ name: "", slug: "", parent_id: "", is_active: true });
const savingEdit = ref(false);

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

// Configuraciones por proceso (para el nivel expandible de configuraciones en el grafo).
const configsByProcess = computed(() => {
  const map = new Map();
  (rawGraph.value.configs || []).forEach((c) => {
    const pid = String(c.process_id);
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push(c);
  });
  return map;
});
const toggleConfigs = (processId) => {
  const id = String(processId);
  const next = new Set(expandedConfigIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedConfigIds.value = next;
  buildGraph();
};

// Entregables (plantillas) por configuración (definition_id) para el 3er nivel del grafo.
const templatesByConfig = computed(() => {
  const map = new Map();
  (rawGraph.value.templates || []).forEach((t) => {
    const did = String(t.definition_id);
    if (!map.has(did)) map.set(did, []);
    map.get(did).push(t);
  });
  return map;
});
const toggleTemplates = (definitionId) => {
  const id = String(definitionId);
  const next = new Set(expandedTemplateIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedTemplateIds.value = next;
  buildGraph();
};

// Toggles globales de la barra: expanden/colapsan TODOS los procesos / configuraciones de una vez.
const expandAllConfigs = (on) => {
  if (on) {
    expandedConfigIds.value = new Set((rawGraph.value.configs || []).map((c) => String(c.process_id)));
  } else {
    expandedConfigIds.value = new Set();
    expandedTemplateIds.value = new Set();
    showTemplates.value = false;
  }
  buildGraph();
};
const expandAllTemplates = (on) => {
  if (on) {
    if (!showConfigs.value) {
      showConfigs.value = true;
      expandedConfigIds.value = new Set((rawGraph.value.configs || []).map((c) => String(c.process_id)));
    }
    expandedTemplateIds.value = new Set((rawGraph.value.templates || []).map((t) => String(t.definition_id)));
  } else {
    expandedTemplateIds.value = new Set();
  }
  buildGraph();
};

// Solo los ids numéricos son procesos (configs usan "c-<id>", entregables "t-<id>").
const isProcessId = (id) => /^\d+$/.test(String(id));

const setFeedback = (kind, message) => {
  feedback.value = { kind, message };
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.value = { kind: "", message: "" }; }, 4000);
};

const dimsOf = (n) => {
  if (n.type === "config") return { width: CONFIG_W, height: CONFIG_H };
  if (n.type === "template") return { width: TEMPLATE_W, height: TEMPLATE_H };
  return { width: NODE_W, height: NODE_H };
};
const layout = (rawNodes, rawEdges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 45, ranksep: 75 });
  g.setDefaultEdgeLabel(() => ({}));
  rawNodes.forEach((n) => g.setNode(n.id, dimsOf(n)));
  rawEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return rawNodes.map((n) => {
    const p = g.node(n.id);
    const { width, height } = dimsOf(n);
    return { ...n, position: { x: p.x - width / 2, y: p.y - height / 2 } };
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
      hasConfigs: Number(p.definitions_count) > 0,
      configsExpanded: expandedConfigIds.value.has(String(p.id)),
      onToggleConfigs: toggleConfigs,
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
  // Nivel de configuraciones (expand-on-demand): por cada proceso visible y expandido, agrega sus
  // configuraciones como nodos hijos (estilo distinto) con una arista punteada proceso→config.
  apiNodes.forEach((p) => {
    const pid = String(p.id);
    if (!expandedConfigIds.value.has(pid)) return;
    (configsByProcess.value.get(pid) || []).forEach((cfg) => {
      const did = String(cfg.definition_id);
      const cfgTemplates = templatesByConfig.value.get(did) || [];
      rawNodes.push({
        id: `c-${cfg.definition_id}`,
        type: "config",
        position: { x: 0, y: 0 },
        data: {
          ...cfg,
          editable: props.editable,
          templatesCount: cfgTemplates.length,
          templatesExpanded: expandedTemplateIds.value.has(did),
          onToggleTemplates: toggleTemplates,
          onAddTemplate: addTemplateToConfig,
          onVersion: versionConfig,
          onAddSibling: addSiblingConfig,
          highlighted: false
        }
      });
      rawEdges.push({
        id: `pc-${pid}-${cfg.definition_id}`,
        type: "process",
        source: pid,
        target: `c-${cfg.definition_id}`,
        updatable: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: CONFIG_EDGE_COLOR },
        style: { stroke: CONFIG_EDGE_COLOR, strokeWidth: 1.2, strokeDasharray: "4 3" },
        data: { editable: false }
      });
      // 3er nivel: entregables (plantillas) de la configuración, si está expandida.
      if (!expandedTemplateIds.value.has(did)) return;
      cfgTemplates.forEach((tpl) => {
        rawNodes.push({
          id: `t-${tpl.id}`,
          type: "template",
          position: { x: 0, y: 0 },
          data: {
            ...tpl,
            editable: props.editable,
            parentConfigStatus: cfg.status,
            onVersion: versionTemplate,
            onAddSibling: addSiblingTemplate,
            onClone: cloneTemplate,
            onGuidedUpdate: guidedUpdateTemplate,
            highlighted: false
          }
        });
        rawEdges.push({
          id: `ct-${cfg.definition_id}-${tpl.id}`,
          type: "process",
          source: `c-${cfg.definition_id}`,
          target: `t-${tpl.id}`,
          updatable: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: TEMPLATE_EDGE_COLOR },
          style: { stroke: TEMPLATE_EDGE_COLOR, strokeWidth: 1.2, strokeDasharray: "3 3" },
          data: { editable: false }
        });
      });
    });
  });
  nodes.value = rawNodes.length ? layout(rawNodes, rawEdges) : [];
  edges.value = rawEdges;
};

const loadGraph = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getProcessGraph();
    rawGraph.value = {
      nodes: data.nodes || [],
      edges: data.edges || [],
      configs: data.configs || [],
      templates: data.templates || []
    };
    buildGraph();
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudo cargar el mapa de procesos.";
  } finally {
    loading.value = false;
  }
};

const rawProcessById = (processId) =>
  (rawGraph.value.nodes || []).find((p) => String(p.id) === String(processId)) || null;

// Clic en nodo proceso → drawer; clic en nodo configuración → abre el wizard de esa configuración.
const onNodeClick = ({ node }) => {
  if (!node?.data) return;
  if (node.type === "config") {
    openConfigFromNode(node.data);
    return;
  }
  if (node.type === "template") {
    openTemplateFromNode(node.data);
    return;
  }
  openProcessDetail(node.data.id);
};
// Abre la configuración (wizard) desde su nodo en el grafo; reusa el camino edit-config del padre.
const openConfigFromNode = (cfg) => {
  const proc = rawProcessById(cfg.process_id);
  closeDetail();
  emit("edit-config", {
    processId: cfg.process_id,
    definition: { ...cfg, process_name: proc?.name },
    step: "definition",
    readonly: cfg.status !== "draft"
  });
};
// Clic en un entregable → abre el DRAWER de versiones de ese template_code (no sobrecarga el nodo). Desde ahí
// se ve el linaje (borrador/publicada/retirada), se abre cada versión (editar/ver) y se versiona/actualiza.
const openTemplateFromNode = (tpl) => {
  if (!tpl?.template_code) return;
  closeDetail();
  const cfg = (rawGraph.value.configs || []).find((c) => String(c.definition_id) === String(tpl.definition_id)) || null;
  templateDetail.value = {
    open: true,
    loading: true,
    templateCode: tpl.template_code,
    displayName: tpl.display_name,
    definitionId: tpl.definition_id,
    pinnedArtifactId: tpl.template_artifact_id,
    configName: cfg?.definition_name || cfg?.name || "",
    configStatus: cfg?.status || "",
    versions: []
  };
  loadTemplateVersions();
};

// --- Drawer de versiones del entregable ---
const templateDetail = ref(null);
const loadTemplateVersions = async () => {
  const code = templateDetail.value?.templateCode;
  if (!code) return;
  templateDetail.value.loading = true;
  try {
    const { data } = await adminSqlService.getTemplateVersions(code);
    if (templateDetail.value) templateDetail.value.versions = Array.isArray(data) ? data : (data?.rows || data?.data || []);
  } catch {
    if (templateDetail.value) templateDetail.value.versions = [];
  } finally {
    if (templateDetail.value) templateDetail.value.loading = false;
  }
};
const closeTemplateVersions = () => { templateDetail.value = null; };
// Abrir una versión concreta en el editor (borrador = editable, publicada/retirada = solo lectura).
const openVersionFromDrawer = (v) => {
  if (!v?.id) return;
  const definitionId = templateDetail.value?.definitionId;
  closeTemplateVersions();
  emit("open-template-editor", { templateArtifactId: v.id, definitionId });
};
const versionFromDrawer = () => {
  const td = templateDetail.value;
  if (!td) return;
  closeTemplateVersions();
  emit("version-template", { templateArtifactId: td.pinnedArtifactId, displayName: td.displayName, templateCode: td.templateCode });
};
const guidedFromDrawer = () => {
  const td = templateDetail.value;
  if (!td) return;
  closeTemplateVersions();
  emit("guided-update-template", { definitionId: td.definitionId, templateArtifactId: td.pinnedArtifactId, displayName: td.displayName, templateCode: td.templateCode });
};
// Acción config-céntrica: usar esta versión en la configuración (borrador → re-apunta; activa → prepara borrador
// de trabajo y avisa que se aplica al activar).
const useVersionInConfig = async (v) => {
  const td = templateDetail.value;
  if (!td?.definitionId || !v?.id) return;
  try {
    const { data } = await adminSqlService.useTemplateVersionInConfig(td.definitionId, v.id);
    emit("notify", { kind: "success", title: "Versión aplicada", message: data?.__notice || "Listo." });
    await loadGraph();
    await loadTemplateVersions();
    if (data?.mode === "draft" && templateDetail.value) {
      templateDetail.value.pinnedArtifactId = v.id;
    }
  } catch (err) {
    emit("notify", { kind: "error", title: "No se pudo aplicar la versión", message: err?.response?.data?.message || "Error al usar la versión en la configuración." });
  }
};
const versionStateLabel = (s) => ({ draft: "Borrador", published: "Publicada", retired: "Retirada" }[String(s)] || String(s || ""));
// Señal de salud del drawer: la config usa una versión NO publicada de este entregable. No alarma el caso normal
// "config borrador + versión borrador" (se publica al activar). Sí avisa retiradas y activas no publicadas.
const drawerHealthWarning = computed(() => {
  const td = templateDetail.value;
  if (!td || !Array.isArray(td.versions)) return null;
  const pinned = td.versions.find((v) => String(v.id) === String(td.pinnedArtifactId));
  if (!pinned || pinned.lifecycle_state === "published") return null;
  if (td.configStatus === "draft" && pinned.lifecycle_state === "draft") return null;
  const publishedVersion = td.versions.find((v) => v.lifecycle_state === "published") || null;
  return { pinnedLabel: versionStateLabel(pinned.lifecycle_state).toLowerCase(), publishedVersion };
});
const versionStateClass = (s) => ({
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  retired: "bg-slate-100 text-slate-500 ring-slate-200"
}[String(s)] || "bg-slate-100 text-slate-500 ring-slate-200");
const formatVersionDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value);
  }
};

// --- Acciones desde el toolbar de los nodos de configuración y entregable (un modal a la vez) ---
const cfgPayload = (cfg, extra = {}) => {
  const proc = rawProcessById(cfg.process_id);
  return { processId: cfg.process_id, definition: { ...cfg, process_name: proc?.name }, ...extra };
};
// Config: agregar entregable → gestor de plantillas de ESTA configuración (modal enfocado, no el wizard).
const addTemplateToConfig = (cfg) => {
  closeDetail();
  const proc = rawProcessById(cfg.process_id);
  emit("add-template", { definition: { ...cfg, process_name: proc?.name } });
};
// Config: versionar → wizard de nueva versión (clona la definición).
const versionConfig = (cfg) => {
  closeDetail();
  emit("version-config", cfgPayload(cfg));
};
// Config: agregar hermana → nueva configuración del mismo proceso.
const addSiblingConfig = (cfg) => {
  closeDetail();
  const proc = rawProcessById(cfg.process_id);
  emit("open-config-wizard", { processId: cfg.process_id, processName: proc?.name });
};
// Entregable: versionar (solo ad_hoc; el botón ya se oculta en oficiales).
const versionTemplate = (tpl) => {
  if (!tpl?.template_artifact_id) return;
  emit("version-template", { templateArtifactId: tpl.template_artifact_id, displayName: tpl.display_name, templateCode: tpl.template_code });
};
// Entregable: agregar hermano → gestor de plantillas de su misma configuración.
const addSiblingTemplate = (tpl) => {
  const cfg = (rawGraph.value.configs || []).find((c) => String(c.definition_id) === String(tpl.definition_id));
  if (!cfg) return;
  closeDetail();
  const proc = rawProcessById(cfg.process_id);
  emit("add-template", { definition: { ...cfg, process_name: proc?.name } });
};
// Entregable: crear uno nuevo a partir del actual (clona nombre/semilla/campos/flujos en modo creación).
const cloneTemplate = (tpl) => {
  if (!tpl?.template_artifact_id) return;
  closeDetail();
  emit("clone-template", { templateArtifactId: tpl.template_artifact_id, definitionId: tpl.definition_id });
};
// Entregable bajo config ACTIVA: actualización guiada (versiona plantilla + config y las publica/activa juntas).
const guidedUpdateTemplate = (tpl) => {
  if (!tpl?.template_artifact_id || !tpl?.definition_id) return;
  emit("guided-update-template", {
    definitionId: tpl.definition_id,
    templateArtifactId: tpl.template_artifact_id,
    displayName: tpl.display_name,
    templateCode: tpl.template_code,
    storageVersion: tpl.storage_version
  });
};
// El ✎ del hover (o el botón del drawer) abre el modal de edición de datos generales.
const editProcess = (processId) => openEditModal(processId);

// Opciones de proceso padre (todos menos el que se está editando; el backend bloquea ciclos).
const parentOptions = computed(() =>
  (rawGraph.value.nodes || [])
    .filter((p) => String(p.id) !== String(editingProcess.value?.id))
    .map((p) => ({ id: p.id, name: p.name }))
);

const openEditModal = (processId) => {
  if (!props.editable) return;
  const p = rawProcessById(processId);
  if (!p) return;
  editingProcess.value = { id: p.id, name: p.name };
  editForm.value = {
    name: p.name || "",
    slug: p.slug || "",
    parent_id: p.parent_id ? String(p.parent_id) : "",
    is_active: Number(p.is_active) === 1
  };
};
const closeEditModal = () => { editingProcess.value = null; };
const saveProcessEdit = async () => {
  const ep = editingProcess.value;
  if (!ep?.id || !editForm.value.name.trim()) return;
  savingEdit.value = true;
  try {
    await adminSqlService.update(
      "processes",
      { id: ep.id },
      {
        name: editForm.value.name.trim(),
        slug: editForm.value.slug.trim(),
        is_active: editForm.value.is_active ? 1 : 0
      }
    );
    const current = rawProcessById(ep.id);
    const nextParent = editForm.value.parent_id ? Number(editForm.value.parent_id) : null;
    if (Number(current?.parent_id || 0) !== Number(nextParent || 0)) {
      await adminSqlService.setProcessParent(ep.id, nextParent);
    }
    setFeedback("success", "Proceso actualizado.");
    editingProcess.value = null;
    await loadGraph();
    if (detailProcess.value?.id === ep.id) await openProcessDetail(ep.id, detailTab.value);
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo actualizar el proceso.");
  } finally {
    savingEdit.value = false;
  }
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
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo cargar el detalle del proceso.");
    detailProcess.value = null;
  } finally {
    detailLoading.value = false;
  }
};
const closeDetail = () => { detailProcess.value = null; };

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
  // Solo se anidan procesos entre sí (ignora arrastres hacia/desde nodos de configuración).
  if (!isProcessId(source) || !isProcessId(target)) return;
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
  if (!isProcessId(source) || !isProcessId(target)) return;
  try {
    await adminSqlService.setProcessParent(Number(target), Number(source));
    setFeedback("success", "Relación reasignada.");
    await loadGraph();
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo reasignar la relación.");
    await loadGraph();
  }
};

// Toggles de niveles (segmented control de la barra): expanden/colapsan todos a la vez.
const toggleConfigsView = () => {
  showConfigs.value = !showConfigs.value;
  expandAllConfigs(showConfigs.value);
};
const toggleTemplatesView = () => {
  showTemplates.value = !showTemplates.value;
  expandAllTemplates(showTemplates.value);
};

const exportPng = async () => {
  const target = document.querySelector(".unit-graph-canvas .vue-flow")
    || document.querySelector(".unit-graph-canvas .vue-flow__viewport");
  if (!target) {
    setFeedback("error", "No se encontró el lienzo para exportar.");
    return;
  }
  exporting.value = true;
  try {
    // toBlob es más robusto que un data-URL grande. Reintento sin incrustar fuentes: la incrustación de
    // webfonts (fetch) es la causa más común de fallo de html-to-image (CORS/caché), normalmente en la 1ª vez.
    const opts = { backgroundColor: "#ffffff", pixelRatio: 2, cacheBust: true };
    let blob = null;
    try {
      blob = await toBlob(target, opts);
    } catch {
      blob = await toBlob(target, { ...opts, skipFonts: true });
    }
    if (!blob) {
      throw new Error("el lienzo no devolvió imagen");
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = "mapa-procesos.png";
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback("success", "Mapa de procesos exportado.");
  } catch (e) {
    setFeedback("error", `No se pudo exportar la imagen: ${e?.message || e}`);
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
.proc-toggle {
  padding: 0.25rem 0.6rem;
  border-radius: 0.45rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #64748b;
  transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}
.proc-toggle:hover {
  color: #334155;
}
.proc-toggle--on {
  background: #fff;
  color: #4f46e5;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
}
</style>
