<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Izquierda: regresar y ayuda -->
      <div class="flex items-center gap-2">
        <AppButton variant="neutral-outline" icon-only title="Regresar" aria-label="Regresar" @click="$emit('go-back')">
          <IconArrowLeft class="h-4 w-4" />
        </AppButton>
        <!-- Sin el rótulo «Mapa de procesos · N procesos · N relaciones»: repetía la pestaña en la que
             ya se está. Y la ayuda es un botón del mismo alto que sus vecinos, como en el organigrama. -->
        <AppInfoTip as-button placement="bottom-start" aria-label="Ayuda del mapa de procesos">
          <template v-if="editable">
            Jerarquía padre→hijo de procesos (procesos macro y sub-procesos). Pulsa un proceso para abrirlo; pasa el
            cursor sobre él para agregarle hijos, o arrastra desde su punto inferior al superior de otro para
            anidarlo. Usa el botón de la relación para desvincular (el hijo queda como raíz).
          </template>
          <template v-else>
            Jerarquía padre→hijo de procesos (procesos macro y sub-procesos). Vista de solo lectura: no tienes
            permisos para editar.
          </template>
        </AppInfoTip>
      </div>
      <!-- Derecha: niveles a mostrar (segmented) + refrescar + exportar + crear -->
      <div class="flex flex-wrap items-center gap-2">
        <AppButton variant="neutral-outline" icon-only :disabled="loading" title="Refrescar" aria-label="Refrescar" @click="loadGraph">
          <IconRefresh class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />
        </AppButton>
        <AppButton variant="neutral-outline" icon-only :disabled="exporting" title="Exportar PNG" aria-label="Exportar PNG" @click="exportPng">
          <IconDownload class="h-4 w-4" />
        </AppButton>
        <!-- Los dos botones con rótulo miden LO MISMO, y no porque se les fije un ancho: van en una
             rejilla de columnas iguales y cada uno llena la suya. Así el ancho lo decide el más
             largo de los dos, y un botón no lleva estilo por fuera. -->
        <div class="grid auto-cols-fr grid-flow-col gap-2">
          <AppCheckMenu v-model="vistaActiva" label="Mostrar" :options="OPCIONES_DE_VISTA" />
          <AppButton v-if="editable" variant="primary-outline" :disabled="loading" title="Crear proceso raíz" @click="openCreateProcess('root', null, '')">
            <IconPlus class="mr-1 h-4 w-4" /> Proceso
          </AppButton>
        </div>
      </div>
    </div>

    <AppAlert v-if="feedback.message" :variant="feedback.kind === 'error' ? 'danger' : 'success'">
      {{ feedback.message }}
    </AppAlert>

    <div ref="graphCanvas" class="deasy-card graph-canvas">
      <div v-if="loading" class="flex h-full items-center justify-center text-sm text-muted">Cargando mapa de procesos…</div>
      <div v-else-if="error" class="flex h-full items-center justify-center px-6 text-center text-sm text-danger">{{ error }}</div>
      <AppEmpty class="h-full" v-else-if="!nodes.length">No hay procesos para mostrar.</AppEmpty>
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
    <NodeMoverModal :mover="moverProceso" :acto-options="vigencia.actoOptions.value" />

    <AppModalShell
      v-if="Boolean(selectedEdge)"
      controlled
      :open="Boolean(selectedEdge)" title="Desvincular proceso" content-class="max-w-md" @close="selectedEdge = null">
      <p class="m-0 text-sm text-icon">
        ¿Desvincular <strong>{{ selectedEdgeLabel }}</strong>? El sub-proceso quedará como proceso raíz (sin padre).
      </p>
      <template #footer>
        <AppButton variant="danger-outline" @click="selectedEdge = null">Cancelar</AppButton>
        <AppButton variant="danger-outline" @click="confirmDeleteEdge">Desvincular</AppButton>
      </template>
    </AppModalShell>

    <!-- Crear proceso (raíz / hijo / hermano) -->
    <AppModalShell
      v-if="Boolean(createContext)"
      controlled
      :open="Boolean(createContext)" :title="createDialogTitle" content-class="max-w-md" @close="createContext = null">
      <p class="m-0 mb-3 text-sm text-icon">{{ createDialogHint }}</p>
      <div class="flex flex-col gap-3">
        <label class="deasy-form-label">
          Nombre
          <input v-model="createForm.name" type="text" class="deasy-control" placeholder="Nombre del proceso" />
        </label>
        <label class="deasy-form-label">
          Identificador (slug) <span class="font-normal text-muted">(opcional)</span>
          <input v-model="createForm.slug" type="text" class="deasy-control" placeholder="se deriva del nombre" />
        </label>
      </div>
      <template #footer>
        <AppButton variant="danger-outline" @click="createContext = null">Cancelar</AppButton>
        <AppButton variant="primary-outline" :disabled="!createForm.name.trim()" @click="confirmCreateProcess">Crear</AppButton>
      </template>
    </AppModalShell>

    <!-- EL PROCESO, EN UN SOLO MODAL CON PESTAÑAS (2026-11-23). Eran dos sitios: un panel lateral
         con el detalle y, aparte, un modal de edición al que se llegaba por un lápiz flotante sobre
         el nodo o por otro lápiz dentro del panel. Ahora pulsar el nodo abre esto, y editar es una
         pestaña más. Los errores salen DENTRO: antes salían en la página, por detrás del modal. -->
    <AppModalShell
      v-if="Boolean(detailProcess)"
      controlled
      :open="Boolean(detailProcess)" :title="detailProcess.name || 'Proceso'" content-class="deasy-dialog-panel--viewport max-w-3xl" body-class="flex min-h-0 flex-col" footer-class="shrink-0" @close="closeDetail">
      <!-- EL MODAL NO CRECE MÁS QUE LA PANTALLA, y lo que se desplaza es el contenido de la pestaña:
           las pestañas, el aviso y los botones se quedan siempre a la vista. Sin esto, una pestaña
           larga (diez puestos) empujaba la cabecera fuera de la pantalla y no había forma de volver. -->
      <div class="deasy-inline-tabs shrink-0" role="tablist">
        <button
          v-for="pestana in PESTANAS_DEL_PROCESO"
          :key="pestana.id"
          type="button"
          role="tab"
          class="deasy-inline-tab"
          :class="detailTab === pestana.id ? 'deasy-inline-tab--active' : ''"
          :aria-selected="detailTab === pestana.id"
          @click="detailTab = pestana.id"
        >
          <component :is="pestana.icono" class="h-4 w-4" />
          {{ pestana.rotulo }}
        </button>
      </div>

      <AppAlert v-if="modalError" variant="danger" class="mt-3 shrink-0">{{ modalError }}</AppAlert>

      <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
        <!-- Pestaña: Datos — identidad y vigencia -->
        <div v-show="detailTab === 'datos'" class="flex flex-col gap-3">
          <label class="deasy-form-label">
            Nombre
            <input v-model="editForm.name" type="text" class="deasy-control" placeholder="Nombre del proceso" :disabled="!editable" />
          </label>
          <label class="deasy-form-label">
            Identificador (slug)
            <input v-model="editForm.slug" type="text" class="deasy-control" placeholder="identificador" :disabled="!editable" />
          </label>
          <label class="deasy-form-label">
            Proceso padre
            <select v-model="editForm.parent_id" class="deasy-control deasy-control--select" :disabled="!editable">
              <option value="">— Sin padre (raíz) —</option>
              <option v-for="opt in parentOptions" :key="opt.id" :value="String(opt.id)">{{ opt.name }}</option>
            </select>
          </label>
          <AppAlert v-if="cambioProgramado" variant="info">{{ cambioProgramado }}</AppAlert>
        </div>

        <div v-if="detailLoading" v-show="detailTab !== 'datos'" class="text-sm text-muted">Cargando…</div>
        <template v-else>
          <!-- Pestaña: Vigencia — las vidas del proceso (frente 27, D-03). La pieza es la misma
               que usa el organigrama. -->
          <NodeVigenciaPanel
            v-show="detailTab === 'vigencia'"
            :vigencia="vigencia"
            :estado="detailProcess.estado"
            sujeto="Proceso"
            :editable="editable"
            @reactivar="empezarVidaNueva"
            @descartar="descartarVida"
          />

<!-- Pestaña: Configuraciones -->
        <div v-show="detailTab === 'configuraciones'">
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="deasy-overline">Configuraciones</p>
            <AppButton v-if="editable" variant="primary-outline" @click="createConfiguration">+ Nueva configuración</AppButton>
          </div>
          <AppEmpty v-if="!detailConfigurations.length">
            Este proceso no tiene configuraciones.
          </AppEmpty>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="cfg in detailConfigurations" :key="cfg.definition_id" class="rounded-xl border border-line px-3 py-2.5">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold text-strong" :title="cfg.definition_name">{{ cfg.definition_name }}</span>
                <AppTag :variant="tonoCicloVida(cfg.status)" outlined class-name="ml-auto">{{ configStatusLabel(cfg.status) }}</AppTag>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-2 text-theme-xs text-muted">
                <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 ring-1 ring-line">{{ cfg.rules_count }} reglas</span>
                <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 ring-1 ring-line">{{ cfg.templates_count }} plantillas</span>
                <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 ring-1 ring-line">{{ cfg.runs_count }} corridas</span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-theme-xs">
                <template v-if="editable && cfg.status === 'draft'">
                  <button type="button" class="deasy-inline-action deasy-inline-action--primary" @click="editConfiguration(cfg, 'definition')">Editar</button>
                  <span class="text-gray-300">·</span>
                  <button type="button" class="deasy-inline-action deasy-inline-action--neutral" @click="editConfiguration(cfg, 'rules')">Reglas</button>
                  <button type="button" class="deasy-inline-action deasy-inline-action--neutral" @click="editConfiguration(cfg, 'triggers')">Disparadores</button>
                  <button type="button" class="deasy-inline-action deasy-inline-action--neutral" @click="editConfiguration(cfg, 'packages')">Plantillas</button>
                </template>
                <template v-else>
                  <button type="button" class="deasy-inline-action deasy-inline-action--primary" @click="editConfiguration(cfg, 'definition')">Ver</button>
                  <button v-if="editable && cfg.status === 'active'" type="button" class="deasy-inline-action deasy-inline-action--success" @click="launchConfiguration(cfg)">Lanzar</button>
                </template>
              </div>
            </li>
          </ul>
        </div>

        <!-- Pestaña: Sub-procesos -->
        <div v-show="detailTab === 'subprocesos'">
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="deasy-overline">Sub-procesos</p>
            <AppButton v-if="editable" variant="neutral-outline" @click="addChildFromModal">+ Sub-proceso</AppButton>
          </div>
          <AppEmpty v-if="!detailChildren.length">
            Este proceso no tiene sub-procesos.
          </AppEmpty>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="ch in detailChildren" :key="ch.id" class="rounded-xl border border-line px-3 py-2.5">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold text-strong">{{ ch.name }}</span>
                <AppTag v-if="ch.estado !== 'vigente'" :variant="tonoVigencia(ch.estado)" outlined>{{ etiquetaVigencia(ch.estado) }}</AppTag>
                <AppTag
                  class-name="ml-auto"
                  outlined
                  :variant="ch.active_count ? 'success' : (ch.definitions_count ? 'warning' : 'neutral')"
                >{{ ch.definitions_count ? `${ch.active_count}/${ch.definitions_count} config.` : "Sin config." }}</AppTag>
              </div>
              <div class="mt-1.5 flex items-center gap-2 text-xs">
                <span class="truncate text-muted">{{ ch.slug }}</span>
                <div class="ml-auto flex items-center gap-2">
                  <AppButton
                    variant="info-soft"
                    icon-only
                    title="Abrir el sub-proceso"
                    aria-label="Abrir el sub-proceso"
                    @click="openProcessDetail(ch.id)"
                  >
                    <IconEye class="h-5 w-5" />
                  </AppButton>
                  <AppButton
                    v-if="editable"
                    variant="danger-soft"
                    icon-only
                    title="Desvincular del proceso padre"
                    aria-label="Desvincular del proceso padre"
                    @click="detachChild(ch.id)"
                  >
                    <IconUnlink class="h-5 w-5" />
                  </AppButton>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Pestaña: Lanzamientos / corridas -->
        <div v-show="detailTab === 'corridas'">
          <p class="deasy-overline mb-3">Lanzamientos / corridas</p>
          <AppEmpty v-if="!detailRuns.length">
            Este proceso no tiene corridas registradas.
          </AppEmpty>
          <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="run in detailRuns" :key="run.id" class="rounded-xl border border-line px-3 py-2.5">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold text-strong">{{ run.term_name || "Sin periodo" }}</span>
                <AppTag :variant="tonoCorrida(run.status)" outlined class-name="ml-auto capitalize">{{ run.status }}</AppTag>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span class="truncate">{{ run.definition_name }}</span>
                <span class="inline-flex items-center rounded-xl bg-surface px-2 py-0.5 font-semibold text-icon ring-1 ring-line">{{ run.run_mode === "automatic" ? "Automática" : "Manual" }}</span>
                <span v-if="run.source_run_id" class="italic text-muted">relanzamiento</span>
              </div>
            </li>
          </ul>
          <p class="m-0 mt-3 text-theme-xs leading-snug text-muted">El lanzamiento de nuevas corridas se habilitará en el siguiente paso.</p>
        </div>
        </template>
      </div>

      <template #footer>
        <template v-if="detailTab === 'datos' && editable">
          <AppButton variant="danger-outline" :disabled="savingEdit" @click="closeDetail">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingEdit || !editForm.name.trim()" @click="saveProcessEdit">{{ savingEdit ? "Guardando…" : "Guardar" }}</AppButton>
        </template>
        <template v-else-if="detailTab === 'vigencia' && editable && vigencia.vidaModo.value !== 'cerrada'">
          <AppButton variant="danger-outline" :disabled="savingEdit" @click="closeDetail">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="savingEdit || !vigencia.sePuedeGuardar.value" @click="saveVida">{{ savingEdit ? "Guardando…" : vigencia.etiquetaDeGuardarVida.value }}</AppButton>
        </template>
        <AppButton v-else variant="neutral-outline" @click="closeDetail">Cerrar</AppButton>
      </template>
    </AppModalShell>

    <!-- Drawer: versiones del entregable (plantilla) -->
    <div v-if="templateDetail" class="deasy-drawer-overlay" @click.self="closeTemplateVersions">
      <aside class="deasy-drawer">
        <div class="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
          <div class="min-w-0">
            <p class="deasy-overline text-primary">Entregable · versiones</p>
            <h3 class="deasy-title deasy-title--block mt-0.5 truncate">{{ templateDetail.displayName || templateDetail.templateCode }}</h3>
            <p class="m-0 mt-0.5 truncate text-xs text-muted">
              {{ templateDetail.templateCode }}<span v-if="templateDetail.configName"> · en {{ templateDetail.configName }}</span>
            </p>
          </div>
          <AppCloseButton @click="closeTemplateVersions" />
        </div>
        <div v-if="editable" class="flex flex-wrap gap-2 border-b border-line px-4 py-2.5">
          <AppButton variant="neutral-outline" @click="versionFromDrawer">+ Nueva versión</AppButton>
          <AppButton v-if="templateDetail.configStatus === 'active'" variant="primary-outline" @click="guidedFromDrawer">Actualizar (publicar + activar)</AppButton>
        </div>
        <!-- Señal de salud: la config usa una versión NO publicada de este entregable. -->
        <AppAlert variant="warning" class="border-b" v-if="drawerHealthWarning">
          <p class="m-0 font-semibold">⚠ La configuración usa una versión {{ drawerHealthWarning.pinnedLabel }} de este entregable.</p>
          <p class="m-0 mt-0.5">
            <template v-if="drawerHealthWarning.publishedVersion && editable">
              Debería usar la versión publicada
              <button type="button" class="deasy-inline-action deasy-inline-action--primary" @click="useVersionInConfig(drawerHealthWarning.publishedVersion)">v{{ drawerHealthWarning.publishedVersion.storage_version }}</button>.
            </template>
            <template v-else-if="!drawerHealthWarning.publishedVersion">Este entregable no tiene ninguna versión publicada. Publica una o crea una nueva versión.</template>
          </p>
        </AppAlert>
        <div class="flex-1 overflow-y-auto px-4 py-3">
          <div v-if="templateDetail.loading" class="text-sm text-muted">Cargando…</div>
          <ul v-else-if="templateDetail.versions.length" class="m-0 flex list-none flex-col gap-2 p-0">
            <li
              v-for="v in templateDetail.versions"
              :key="v.id"
              class="deasy-elegible cursor-pointer rounded-xl px-3 py-2.5"
              :class="[String(v.id) === String(templateDetail.pinnedArtifactId) ? 'deasy-elegible--activa' : '']"
              role="button"
              tabindex="0"
              :title="v.lifecycle_state === 'draft' ? 'Abrir para editar' : 'Abrir (solo lectura)'"
              @click="openVersionFromDrawer(v)"
              @keydown.enter="openVersionFromDrawer(v)"
              @keydown.space.prevent="openVersionFromDrawer(v)"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-strong">v{{ v.storage_version }}</span>
                <AppTag :variant="tonoCicloVida(v.lifecycle_state)" outlined>{{ versionStateLabel(v.lifecycle_state) }}</AppTag>
                <AppTag v-if="String(v.id) === String(templateDetail.pinnedArtifactId)" variant="accent" title="Versión vinculada a esta configuración">Vinculada aquí</AppTag>
                <span class="ml-auto text-theme-xs font-semibold text-primary">{{ v.lifecycle_state === 'draft' ? 'Editar' : 'Ver' }} →</span>
              </div>
              <div class="mt-1 flex items-center justify-between gap-2">
                <span class="text-theme-xs text-muted">{{ formatVersionDate(v.created_at) }}</span>
                <AppButton
                  v-if="editable && v.lifecycle_state !== 'retired' && String(v.id) !== String(templateDetail.pinnedArtifactId)"
                  variant="primary-outline"
                  :title="templateDetail.configStatus === 'active' ? 'Prepara un borrador de la configuración con esta versión' : 'La configuración (borrador) usará esta versión'"
                  @click.stop="useVersionInConfig(v)"
                >Usar en esta config</AppButton>
              </div>
            </li>
          </ul>
          <AppEmpty v-else :icon="false">Sin versiones.</AppEmpty>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import NodeVigenciaPanel from "./NodeVigenciaPanel.vue";
import NodeMoverModal from "./NodeMoverModal.vue";
import { useMoverNodo, fraseDelCambioProgramado } from "@/modules/admin/composables/estructura/useMoverNodo.js";
import { useNodeVigencia } from "@/modules/admin/composables/estructura/useNodeVigencia.js";
import AppCheckMenu from "@/shared/components/forms/AppCheckMenu.vue";
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import { tonoCicloVida, tonoCorrida, etiquetaCicloVida, tonoVigencia, etiquetaVigencia } from "@/shared/utils/estadoTono.js";
import AppCloseButton from "@/shared/components/buttons/AppCloseButton.vue";
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
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppInfoTip from "@/shared/components/widgets/AppInfoTip.vue";
import { IconArrowLeft, IconCalendarEvent, IconDownload, IconEye, IconId, IconPlus, IconRefresh, IconRocket, IconSettings, IconSitemap, IconUnlink } from "@tabler/icons-vue";
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

const NODE_W = 260;
const NODE_H = 64;
const CONFIG_W = 190;
const CONFIG_H = 64;
const TEMPLATE_W = 170;
const TEMPLATE_H = 52;
const EDGE_COLOR = "var(--color-edge-proceso)";
const CONFIG_EDGE_COLOR = "var(--color-edge-config)";
const TEMPLATE_EDGE_COLOR = "var(--color-edge-plantilla)";

const nodes = ref([]);
const edges = ref([]);
const rawGraph = ref({ nodes: [], edges: [], configs: [], templates: [] });
const expandedConfigIds = ref(new Set());
const expandedTemplateIds = ref(new Set());
const showConfigs = ref(false);
const showTemplates = ref(false);
const loading = ref(false);
const error = ref("");
// QUÉ SE MUESTRA, como una lista de casillas: los cuatro estados del proceso —activos, borradores,
// programados y suprimidos— y las dos capas que cuelgan de él. Son interruptores independientes; el
// control segmentado que había los hacía parecer una elección excluyente, y sólo sabía ocultar los
// suprimidos.
const ESTADOS_CON_CASILLA = ["vigente", "borrador", "programado", "suprimido"];
const estadosVisibles = ref(new Set(ESTADOS_CON_CASILLA));
const OPCIONES_DE_VISTA = [
  { value: "vigente", label: "Procesos activos" },
  { value: "borrador", label: "Borradores" },
  { value: "programado", label: "Programados" },
  { value: "suprimido", label: "Procesos suprimidos" },
  { value: "configuraciones", label: "Configuraciones" },
  { value: "entregables", label: "Entregables" }
];
const vistaActiva = computed({
  get: () => [
    ...ESTADOS_CON_CASILLA.filter((estado) => estadosVisibles.value.has(estado)),
    showConfigs.value && "configuraciones",
    showTemplates.value && "entregables"
  ].filter(Boolean),
  // Las dos capas disparan la MISMA función que disparaba su botón: mostrar entregables arrastra
  // las configuraciones, y eso lo saben `toggleConfigsView` y `toggleTemplatesView`, no este setter.
  set: (marcados) => {
    const quiere = new Set(marcados);
    estadosVisibles.value = new Set(ESTADOS_CON_CASILLA.filter((estado) => quiere.has(estado)));
    if (quiere.has("configuraciones") !== showConfigs.value) toggleConfigsView();
    if (quiere.has("entregables") !== showTemplates.value) toggleTemplatesView();
  }
});
const selectedEdge = ref(null);
const createContext = ref(null);
const createForm = ref({ name: "", slug: "" });
const highlightId = ref("");
const collapsedIds = ref(new Set());
const exporting = ref(false);
const feedback = ref({ kind: "", message: "" });
let feedbackTimer = null;

// El proceso abierto: un modal con pestañas (datos, configuraciones, sub-procesos, lanzamientos).
const detailProcess = ref(null);
const detailTab = ref("datos");
// El error de lo que se intenta DENTRO del modal se enseña dentro: en la página quedaba tapado.
const modalError = ref("");
const PESTANAS_DEL_PROCESO = [
  { id: "datos", rotulo: "Datos", icono: IconId },
  { id: "vigencia", rotulo: "Vigencia", icono: IconCalendarEvent },
  { id: "configuraciones", rotulo: "Configuraciones", icono: IconSettings },
  { id: "subprocesos", rotulo: "Sub-procesos", icono: IconSitemap },
  { id: "corridas", rotulo: "Lanzamientos", icono: IconRocket }
];
const detailLoading = ref(false);
const detailConfigurations = ref([]);
const detailChildren = ref([]);
const detailRuns = ref([]);
const editForm = ref({ name: "", slug: "", parent_id: "" });
// LAS VIDAS del proceso abierto (frente 27, D-03): el estado de la pestaña «Vigencia». Lo lleva un
// composable compartido con el organigrama; aquí sólo se le dice qué tabla y qué clave son las suyas.
const vigencia = useNodeVigencia({ tabla: "process_vigencias", claveDelNodo: "process_id" });
const empezarVidaNueva = () => {
  vigencia.empezarVidaNueva();
  modalError.value = "";
};
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
    (p) => estadosVisibles.value.has(p.estado) && !hidden.has(String(p.id))
  );
  const visibleIds = new Set(apiNodes.map((p) => String(p.id)));
  const rawNodes = apiNodes.map((p) => ({
    id: String(p.id),
    type: "process",
    position: { x: 0, y: 0 },
    data: {
      ...p,
      editable: props.editable,
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

// Clic en nodo proceso → su modal; clic en nodo configuración → abre el wizard de esa configuración.
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
    pinnedArtifactId: tpl.edicion_id,
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
  if (!tpl?.edicion_id) return;
  emit("version-template", { templateArtifactId: tpl.edicion_id, displayName: tpl.display_name, templateCode: tpl.template_code });
};
// Entregable: agregar hermano → gestor de plantillas de su misma configuración.
const addSiblingTemplate = (tpl) => {
  const cfg = (rawGraph.value.configs || []).find((c) => String(c.definition_id) === String(tpl.definition_id));
  if (!cfg) return;
  closeDetail();
  const proc = rawProcessById(cfg.process_id);
  emit("add-template", { definition: { ...cfg, process_name: proc?.name } });
};
// Entregable: crear uno nuevo a partir del actual (clona nombre/generador/campos/flujos en modo creación).
const cloneTemplate = (tpl) => {
  if (!tpl?.edicion_id) return;
  closeDetail();
  emit("clone-template", { templateArtifactId: tpl.edicion_id, definitionId: tpl.definition_id });
};
// Entregable bajo config ACTIVA: actualización guiada (versiona plantilla + config y las publica/activa juntas).
const guidedUpdateTemplate = (tpl) => {
  if (!tpl?.edicion_id || !tpl?.definition_id) return;
  emit("guided-update-template", {
    definitionId: tpl.definition_id,
    templateArtifactId: tpl.edicion_id,
    displayName: tpl.display_name,
    templateCode: tpl.template_code,
    storageVersion: tpl.storage_version
  });
};

// Opciones de proceso padre (todos menos el que se está editando; el backend bloquea ciclos).
const parentOptions = computed(() =>
  (rawGraph.value.nodes || [])
    .filter((p) => String(p.id) !== String(detailProcess.value?.id))
    .map((p) => ({ id: p.id, name: p.name }))
);

const saveProcessEdit = async () => {
  const ep = detailProcess.value;
  if (!props.editable || !ep?.id || !editForm.value.name.trim()) return;
  savingEdit.value = true;
  modalError.value = "";
  try {
    await adminSqlService.update(
      "processes",
      { id: ep.id },
      {
        name: editForm.value.name.trim(),
        slug: editForm.value.slug.trim()
      }
    );
    const current = rawProcessById(ep.id);
    const nextParent = editForm.value.parent_id ? Number(editForm.value.parent_id) : null;
    if (Number(current?.parent_id || 0) !== Number(nextParent || 0)) {
      // Si se cancela el «desde cuándo», los datos ya se guardaron pero el modal no se cierra.
      if (!(await cambiarPadre(ep.id, nextParent))) {
        await loadGraph();
        return;
      }
    }
    // Al guardar bien se cierra: el aviso de éxito va en la página, que vuelve a estar a la vista.
    setFeedback("success", "Proceso actualizado.");
    detailProcess.value = null;
    await loadGraph();
  } catch (e) {
    modalError.value = e?.response?.data?.message || "No se pudo actualizar el proceso.";
  } finally {
    savingEdit.value = false;
  }
};

const openProcessDetail = async (processId, tab = "datos") => {
  const p = rawProcessById(processId);
  detailProcess.value = p
    ? { id: p.id, name: p.name, slug: p.slug, parent_id: p.parent_id, estado: p.estado }
    : { id: processId, name: "" };
  editForm.value = {
    name: p?.name || "",
    slug: p?.slug || "",
    parent_id: p?.parent_id ? String(p.parent_id) : ""
  };
  // La pestaña «Vigencia» se prepara ya con lo que trae el grafo, y se afina cuando llega el detalle.
  vigencia.prepararVida(p, []);
  modalError.value = "";
  if (props.editable) vigencia.cargarActos();
  detailTab.value = tab;
  detailLoading.value = true;
  try {
    const { data } = await adminSqlService.getProcessDetail(processId);
    detailProcess.value = data.process || detailProcess.value;
    vigencia.prepararVida(detailProcess.value, data.vigencias || []);
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

// Guarda la vida que enseña la pestaña «Vigencia»: abre una nueva (poner en vigor o reactivar) o
// modifica la que está en curso (moverle las fechas, ponerle fin). Las reglas las impone la base,
// y lo que rechace se dice dentro del modal.
const saveVida = async () => {
  const proceso = detailProcess.value;
  if (!props.editable || !proceso?.id || !vigencia.sePuedeGuardar.value) return;
  savingEdit.value = true;
  modalError.value = "";
  try {
    await vigencia.guardarVida(proceso.id);
    setFeedback("success", "Vigencia actualizada.");
    detailProcess.value = null;
    await loadGraph();
  } catch (e) {
    modalError.value = e?.response?.data?.message || "No se pudo guardar la vigencia.";
  } finally {
    savingEdit.value = false;
  }
};

// Descarta la vida programada del proceso: aún no ha empezado, así que se borra entera.
const descartarVida = async () => {
  if (!props.editable || !vigencia.sePuedeDescartar.value) return;
  savingEdit.value = true;
  modalError.value = "";
  try {
    await vigencia.descartarVida();
    setFeedback("success", "Vida programada descartada.");
    detailProcess.value = null;
    await loadGraph();
  } catch (e) {
    modalError.value = e?.response?.data?.message || "No se pudo descartar la vida.";
  } finally {
    savingEdit.value = false;
  }
};

const addChildFromModal = () => {
  if (!detailProcess.value?.id) return;
  openCreateProcess("child", detailProcess.value.id, detailProcess.value.name);
};
const detachChild = async (childId) => {
  try {
    if (!(await cambiarPadre(childId, null))) return;
    setFeedback("success", "Sub-proceso desvinculado.");
    await loadGraph();
    if (detailProcess.value?.id) await openProcessDetail(detailProcess.value.id, "subprocesos");
  } catch (e) {
    setFeedback("error", e?.response?.data?.message || "No se pudo desvincular el sub-proceso.");
  }
};


const configStatusLabel = (status) => etiquetaCicloVida(status);
// Ver `ProcessConfigNode.vue`: el nombre lo trae la línea, no se compone del origen de la serie.


// Acciones de configuración: cierran el modal y delegan en el padre (wizard / lanzar).
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

// CAMBIAR DE PADRE, por cualquiera de los cinco caminos (frente 27, D-04). Si la relación que el
// proceso tiene ya rige, pregunta desde cuándo; si es un borrador, la cambia sin más. Devuelve
// `false` si se canceló.
const moverProceso = useMoverNodo({
  mover: (hijoId, padreId, extras) => adminSqlService.setProcessParent(Number(hijoId), padreId ? Number(padreId) : null, extras)
});
// El cambio de padre que ya tiene fecha, dicho en el modal del proceso: lo que se ve es el padre de hoy.
const cambioProgramado = computed(() => {
  const p = rawProcessById(detailProcess.value?.id);
  if (!p) return "";
  return fraseDelCambioProgramado({
    estado: p.relacion_estado,
    hasta: p.relacion_hasta,
    proximoPadre: p.proximo_padre_id ? nodeNameById.value.get(String(p.proximo_padre_id)) || "" : "",
    proximoDesde: p.proximo_padre_desde
  });
});
const cambiarPadre = (hijoId, padreId) => {
  const hijo = rawProcessById(hijoId);
  if (!vigencia.actoOptions.value.length) vigencia.cargarActos();
  return moverProceso.pedir({
    hijoId: Number(hijoId),
    padreId: padreId ? Number(padreId) : null,
    hijoNombre: hijo?.name || "",
    padreNombre: padreId ? nodeNameById.value.get(String(padreId)) || "" : "",
    estadoDeLaArista: hijo?.relacion_estado,
    estadoDelNodo: hijo?.estado
  });
};

// Conectar source→target = anidar target bajo source (su padre pasa a ser source).
const onConnect = async ({ source, target }) => {
  if (!props.editable || !source || !target || source === target) return;
  // Solo se anidan procesos entre sí (ignora arrastres hacia/desde nodos de configuración).
  if (!isProcessId(source) || !isProcessId(target)) return;
  try {
    if (!(await cambiarPadre(target, source))) return;
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
    if (!(await cambiarPadre(childId, null))) return;
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
    if (!(await cambiarPadre(target, source))) {
      await loadGraph();
      return;
    }
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

const graphCanvas = ref(null);

const exportPng = async () => {
  // Acotado a la raiz propia (no document.*), y esto es CARGA ESTRUCTURAL, no estilo: ProcessGraph y
  // UnitGraph comparten la clase `.graph-canvas`, asi que un querySelector global exportaria el grafo
  // equivocado en cuanto los dos esten montados. El ref es lo que los distingue; no lo cambies por
  // una busqueda por clase.
  const root = graphCanvas.value;
  const target = root?.querySelector(".vue-flow") || root?.querySelector(".vue-flow__viewport");
  if (!target) {
    setFeedback("error", "No se encontró el lienzo para exportar.");
    return;
  }
  exporting.value = true;
  try {
    // toBlob es más robusto que un data-URL grande. Reintento sin incrustar fuentes: la incrustación de
    // webfonts (fetch) es la causa más común de fallo de html-to-image (CORS/caché), normalmente en la 1ª vez.
          /* ⚠️ ESTE BLANCO NO PUEDE SER UN TOKEN, Y NO ES UN OLVIDO DE F8 (2026-08-20).
         `html-to-image` pinta el PNG sobre un lienzo y necesita un COLOR RESUELTO: un
         `var(--color-white)` aqui llegaria como cadena sin resolver y el fondo saldria
         transparente. Es el mismo motivo por el que un color de canvas nunca es CSS.
         Los otros once colores de este grafo si salieron a `tokens.css`. */
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

watch(estadosVisibles, buildGraph);
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
