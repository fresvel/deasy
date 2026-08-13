<template>
  <AppWorkspaceShell
    :menu-open="vmenu"
    :show-notify="vnotify"
    current-section="admin"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Administración"
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="isSigningView = !isSigningView"
    @primary-nav="revealSidebarForNav"
  >

      <template #header>
        <div class="deasy-context-header">
          <div class="deasy-context-header__copy">
            <div class="deasy-context-header__title">{{ adminShellHeaderTitle }}</div>
            <div v-if="adminShellHeaderSubtitle" class="deasy-context-header__subtitle">
              {{ adminShellHeaderSubtitle }}
            </div>
          </div>
        </div>
      </template>

      <template #sidebar>

          <div class="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-14rem)] custom-scrollbar custom-scrollbar--dark">
            <div class="deasy-nav-shell">
              <div class="deasy-nav-section">
                <button 
                  type="button" 
                  @click="goAdminHome" 
                  class="deasy-nav-item"
                  :class="isHomeActive ? 'deasy-nav-item--active' : ''"
                >
                  <span class="deasy-nav-item__icon deasy-nav-item__icon--direct">
                    <IconHome class="h-4.5 w-4.5 shrink-0" />
                  </span>
                  <span>Inicio</span>
                </button>
              </div>

            <div v-for="group in groupedTables" :key="group.key" class="deasy-nav-section">
              <button
                class="deasy-nav-group-title"
                :class="{ 'deasy-nav-item--subtle-active': openCategories[group.label] }"
                type="button"
                @click="onGroupTitleClick(group)"
              >
                <div class="flex items-center gap-3.5">
                  <span class="deasy-nav-glyph" :class="workspaceIconToneClass(groupIconMeta(group).tone, 'deasy-nav-glyph')">
                    <component :is="groupIconMeta(group).icon" class="h-5 w-5 shrink-0" />
                  </span>
                  <span>{{ group.label }}</span>
                </div>
                <IconChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': openCategories[group.label] }" />
              </button>

              <div v-show="openCategories[group.label]" class="deasy-nav-tree">
                <template v-if="isAcademiaGroup(group)">
                  <button
                    v-for="item in academyMenuItems"
                    :key="item.key"
                    class="deasy-nav-item"
                    :class="[isAcademyItemActive(item) ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="openAcademyItem(item)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)">
                      <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isGestionGroup(group)">
                  <button
                    v-for="item in gestionMenuItems"
                    :key="item.key"
                    class="deasy-nav-item"
                    :class="[isGestionItemActive(item) ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="openGestionItem(item)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)">
                      <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isUsuariosGroup(group)">
                  <button
                    v-for="item in usersMenuItems"
                    :key="item.key"
                    class="deasy-nav-item"
                    :class="[isUsersItemActive(item) ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="openUsersItem(item)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)">
                      <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isContratosGroup(group)">
                  <button
                    v-for="item in contractsMenuItems"
                    :key="item.key"
                    class="deasy-nav-item"
                    :class="[isContractsItemActive(item) ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="openContractsItem(item)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)">
                      <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else-if="isSeguridadGroup(group)">
                  <button
                    v-for="item in securityMenuItems"
                    :key="item.key"
                    class="deasy-nav-item"
                    :class="[isSecurityItemActive(item) ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="openSecurityItem(item)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)">
                      <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ item.label }}</span>
                  </button>
                </template>
                <template v-else>
                  <button
                    v-for="table in group.mainTables"
                    :key="table.table"
                    class="deasy-nav-item"
                    :class="[selectedTable?.table === table.table ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="selectTable(table)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(tableIconMeta(table.table).tone)">
                      <component :is="tableIconMeta(table.table).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ table.label }}</span>
                  </button>
                  <div v-if="group.supportTables.length" class="pl-4 pt-2 pb-1 text-[0.65rem] font-bold uppercase tracking-widest text-muted">
                    Relaciones y soporte
                  </div>
                  <button
                    v-for="table in group.supportTables"
                    :key="table.table"
                    class="deasy-nav-item"
                    :class="[selectedTable?.table === table.table ? 'deasy-nav-item--active' : '']"
                    type="button"
                    @click="selectTable(table)"
                  >
                    <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(tableIconMeta(table.table).tone)">
                      <component :is="tableIconMeta(table.table).icon" class="h-4.5 w-4.5 shrink-0" />
                    </span>
                    <span>{{ table.label }}</span>
                  </button>
                </template>
              </div>
            </div>
            </div>
          </div>
      </template>

        <template v-if="isSigningView">
          <FirmarPdf />
        </template>
        <template v-else>
        <div v-if="!selectedTable" class="w-full max-w-6xl mx-auto space-y-6">
          <div class="deasy-section-card flex flex-col min-h-100">
            <div v-if="loadingMeta" class="flex-1 flex items-center justify-center">
               <div class="inline-flex items-center gap-3">
                 <div class="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                 <span class="text-slate-500 font-medium">Cargando catálogos...</span>
               </div>
            </div>
            <div v-else-if="metaError" class="text-red-500 font-medium text-center p-6 bg-red-50/50 rounded-2xl border border-red-100">{{ metaError }}</div>
            <template v-else>
               <section class="deasy-hero-shell mb-8">
                 <div class="deasy-hero-layout">
                  <div class="deasy-hero-main deasy-hero-main--with-media">
                    <div class="deasy-hero-media">
                      <div class="deasy-hero-media-card">
                      <component :is="adminHeroIcon" class="h-10 w-10" />
                      </div>
                    </div>
                    <div class="deasy-hero-copy sm:pt-0">
                      <div class="deasy-hero-kicker">{{ adminHeroKicker }}</div>
                      <h2 class="deasy-hero-title">{{ adminHeroTitle }}</h2>
                      <p class="deasy-hero-description">{{ adminHeroDescription }}</p>
                    </div>
                  </div>
                  <div class="deasy-hero-side">
                    <button type="button" class="deasy-hero-back-button" @click="handleHeroBack">
                      <span class="deasy-hero-back-button__icon">
                        <IconArrowLeft class="h-4.5 w-4.5" />
                      </span>
                      <span>Volver atrás</span>
                    </button>
                  </div>
                 </div>
               </section>
               
               <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 items-start">
                 <template v-if="showAcademiaIndex">
                    <AppNavCard
                      v-for="item in academyMenuItems"
                      :key="item.key"
                      layout="stacked"
                      :title="item.label"
                      :description="item.description || 'Administra y configura los datos de esta sección.'"
                      :icon="resolveIconMeta(item.icon, item.label).icon"
                      show-arrow
                      class-name="min-h-[140px]"
                      @click="openAcademyItem(item)"
                    />
                 </template>

                 <template v-else-if="showGestionesIndex">
                    <AppNavCard
                      v-for="item in gestionMenuItems"
                      :key="item.key"
                      layout="stacked"
                      :title="item.label"
                      :description="item.description || 'Administra y configura los datos de esta sección.'"
                      :icon="resolveIconMeta(item.icon, item.label).icon"
                      show-arrow
                      class-name="min-h-[140px]"
                      @click="openGestionItem(item)"
                    />
                    <div v-if="traceabilityTables.length" class="col-span-full mt-2">
                      <button
                        type="button"
                        class="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface"
                        @click="traceabilityOpen = !traceabilityOpen"
                      >
                        <span>
                          <span class="block text-sm font-bold text-slate-700">Trazabilidad y soporte</span>
                          <span class="block text-xs text-slate-500">Registros técnicos generados durante la ejecución de tareas, entregas y firmas. Disponibles para consulta, diagnóstico y soporte.</span>
                        </span>
                        <IconChevronDown class="h-4 w-4 shrink-0 transition-transform duration-200" :class="{ 'rotate-180': traceabilityOpen }" />
                      </button>
                      <div v-show="traceabilityOpen" class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                        <AppNavCard
                          v-for="table in traceabilityTables"
                          :key="table.table"
                          layout="stacked"
                          :title="table.label"
                          meta="Consultar"
                          :description="table.description || 'Registro técnico generado por el sistema durante la ejecución.'"
                          :icon="tableIconMeta(table.table).icon"
                          show-arrow
                          class-name="min-h-[140px]"
                          @click="selectTable(table)"
                        />
                      </div>
                    </div>
                 </template>

                 <template v-else-if="showUsersIndex">
                    <AppNavCard
                      v-for="item in usersMenuItems"
                      :key="item.key"
                      layout="stacked"
                      :title="item.label"
                      :description="item.description || 'Administra y configura los datos de esta sección.'"
                      :icon="resolveIconMeta(item.icon, item.label).icon"
                      show-arrow
                      class-name="min-h-[140px]"
                      @click="openUsersItem(item)"
                    />
                 </template>

                 <template v-else-if="showContractsIndex">
                    <AppNavCard
                      v-for="item in contractsMenuItems"
                      :key="item.key"
                      layout="stacked"
                      :title="item.label"
                      :description="item.description || 'Administra y configura los datos de esta sección.'"
                      :icon="resolveIconMeta(item.icon, item.label).icon"
                      show-arrow
                      class-name="min-h-[140px]"
                      @click="openContractsItem(item)"
                    />
                 </template>

                 <template v-else-if="showSecurityIndex">
                    <AppNavCard
                      v-for="item in securityMenuItems"
                      :key="item.key"
                      layout="stacked"
                      :title="item.label"
                      :description="item.description || 'Administra y configura los datos de esta sección.'"
                      :icon="resolveIconMeta(item.icon, item.label).icon"
                      show-arrow
                      class-name="min-h-[140px]"
                      @click="openSecurityItem(item)"
                    />
                 </template>

                 <template v-else>
                    <AppNavCard
                      v-for="group in homeGroups"
                      :key="group.key"
                      layout="stacked"
                      :title="group.label"
                      :description="descriptionForGroup(group)"
                      :icon="groupIconMeta(group).icon"
                      show-arrow
                      class-name="min-h-[140px]"
                      @click="openGroupFromHome(group)"
                    />
                 </template>
               </div>
            </template>
          </div>
        </div>

        <div v-else class="admin-workspace-frame admin-workspace-frame--table w-full flex-1 overflow-hidden relative flex flex-col min-h-0">
          <div class="admin-page admin-typography w-full h-full relative overflow-y-auto">
             <AdminTableManager
               ref="adminManager"
               :table="selectedTable"
               :sibling-tabs="currentSiblingTabs"
               :active-sibling-tab="graphTabActive ? ORG_GRAPH_TAB_KEY : (processGraphTabActive ? PROCESS_GRAPH_TAB_KEY : (selectedTable?.table || ''))"
               :force-graph="graphTabActive"
               :force-process-graph="processGraphTabActive"
               :all-tables="tables"
               :initial-filters="pendingTableFilters"
               @select-sibling-tab="handleSiblingTabChange"
               @go-back="handleManagerGoBack"
             />
          </div>
        </div>
        </template>
  </AppWorkspaceShell>

  <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
</template>

<script setup>

import { computed, onMounted, ref } from "vue";
import { useWorkspaceChrome } from "@/shared/composables/useWorkspaceChrome.js";

import { 
  IconLock,
  IconCircle,
  IconInfoCircle,
  IconPlus,
  IconBell,
  IconArrowLeft,
  IconChevronDown,
  IconHome,
} from '@tabler/icons-vue'

import axios from "@/core/services/httpClient";
import { useRoute, useRouter } from "vue-router";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import AppWorkspaceShell from "@/layouts/workspace/AppWorkspaceShell.vue";
import WorkspaceChatLauncher from "@/shared/components/widgets/WorkspaceChatLauncher.vue";
import AdminTableManager from "@/modules/admin/components/tables/AdminTableManager.vue";
import FirmarPdf from "@/modules/firmas/components/FirmarPdf.vue";
import { API_ROUTES } from "@/core/config/apiConfig";
import {
  resolveWorkspaceAdminGroupIcon,
  resolveWorkspaceAdminTableIcon,
  resolveWorkspaceProfileMenuIcon,
  workspaceIconToneClass,
} from "@/shared/utils/workspaceNavIcons.js";
import { canReadAdminTable, isTraceabilityTable } from "@/core/utils/accessControl.js";

const { menuOpen: vmenu, showNotify: vnotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome();
const isSigningView = ref(false);
const tables = ref([]);
const loadingMeta = ref(false);
const metaError = ref("");
const pendingTableFilters = ref(null);
// Organigrama como pestaña hermana de las tablas de Unidades (no una tabla real).
const ORG_GRAPH_TAB_KEY = "__unit_graph__";
// Mapa de procesos como pestaña hermana de las tablas de Procesos (no una tabla real).
const PROCESS_GRAPH_TAB_KEY = "__process_graph__";
// selectedTable / selectedSection / los cinco item / los dos grafos NO son refs: se DERIVAN de la
// URL (fase 3.5, cierre). Ver el bloque "Estado derivado de la URL" más abajo.
const openCategories = ref({});
const adminManager = ref(null);

const currentUser = ref(null);
const router = useRouter();
const route = useRoute();
const defaultPhoto = "/images/avatar.png";
const userPhoto = ref(defaultPhoto);
const userFullName = computed(() => {
  if (currentUser.value) {
    const firstName = currentUser.value.first_name ?? "";
    const lastName = currentUser.value.last_name ?? "";
    return `${firstName} ${lastName}`.trim() || "Administrador";
  }
  return "Administrador";
});

const GROUP_DEFS = [
  {
    key: "estructura_academico",
    label: "Academia",
    main: ["unit_types", "units", "relation_unit_types", "unit_relations", "cargos", "unit_positions", "position_assignments", "term_types", "terms"],
    support: []
  },
  {
    key: "procesos",
    label: "Gestiones",
    main: [
      "processes",
      "process_definition_series",
      "process_definition_period_types",
      "process_definition_versions",
      "process_target_rules",
      "process_runs",
      "tasks",
      "task_items",
      "task_assignments",
      "template_seeds",
      "template_artifacts",
      "process_definition_templates",
      "documents",
      "document_versions"
    ],
    support: ["signature_flow_templates", "signature_flow_steps", "signature_flow_instances", "signature_requests", "document_signatures", "signature_statuses", "signature_request_statuses"]
      .concat(["fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests"])
  },
  {
    key: "usuarios",
    label: "Usuarios",
    main: ["persons"],
    support: []
  },
  {
    key: "contratacion",
    label: "Contratos",
    main: ["vacancies", "vacancy_visibility", "contracts"],
    support: []
  },
  {
    key: "seguridad",
    label: "Seguridad",
    main: [
      "roles",
      "role_assignments",
      "cargo_role_map",
      "role_assignment_relation_types",
      "permissions",
      "role_permissions"
    ],
    support: []
  },
];

// Slugs de URL para la seccion (3.5b): la URL usa el nombre humano en vez de la clave interna, para
// no exponer "estructura_academico" ni chocar con la ruta /procesos (la seccion "Gestiones" tiene
// key="procesos"). Se derivan de la etiqueta para no mantener un mapa a mano. item y table ya son
// legibles y se quedan como estan.
const slugifySection = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const SECTION_SLUG_BY_KEY = Object.fromEntries(GROUP_DEFS.map((group) => [group.key, slugifySection(group.label)]));
const SECTION_KEY_BY_SLUG = Object.fromEntries(GROUP_DEFS.map((group) => [slugifySection(group.label), group.key]));

const ACADEMY_GROUP_KEY = "estructura_academico";
const ACADEMY_INDEX_ITEMS = [
  {
    key: "unidades",
    label: "Unidades",
    icon: "id-card",
    description: "Gestiona el CRUD de catálogos y relaciones de unidades.",
    tables: ["unit_types", "units", "relation_unit_types", "unit_relations"]
  },
  {
    key: "cargos",
    label: "Cargos",
    icon: "user",
    description: "Gestiona el catálogo de cargos, puestos y ocupaciones.",
    tables: ["cargos", "unit_positions", "position_assignments"]
  },
  {
    key: "periodos",
    label: "Periodos",
    icon: "square-check",
    description: "Gestiona catálogos y periodos académicos.",
    tables: ["term_types", "terms"]
  }
];
const GESTION_GROUP_KEY = "procesos";
const GESTION_INDEX_ITEMS = [
  {
    key: "procesos",
    label: "Procesos",
    icon: "check-double",
    description: "Gestiona procesos base, configuraciones y reglas de alcance.",
    tables: ["processes", "process_definition_series", "process_definition_versions", "process_definition_period_types", "process_target_rules"]
  },
  {
    key: "plantillas",
    label: "Entregables",
    icon: "certificate",
    description: "Gestiona semillas, plantillas y su asignación a procesos.",
    tables: ["template_seeds", "template_artifacts", "process_definition_templates"]
  },
  {
    key: "tareas",
    label: "Tareas",
    icon: "square-check",
    description: "Administra corridas y tareas del proceso.",
    tables: ["process_runs", "tasks"]
  },
  {
    key: "documentos",
    label: "Documentos",
    icon: "info-circle",
    description: "Consulta y administra documentos.",
    tables: ["documents"]
  },
  {
    key: "entrega",
    label: "Entrega",
    icon: "check-double",
    description: "Configura flujos y pasos de entrega documental.",
    tables: [
      "fill_flow_templates",
      "fill_flow_steps"
    ]
  },
  {
    key: "firmas",
    label: "Firmas",
    icon: "check",
    description: "Configura flujos de firma y sus catálogos de estados.",
    tables: [
      "signature_flow_templates",
      "signature_flow_steps",
      "signature_statuses",
      "signature_request_statuses"
    ]
  }
];
const USERS_GROUP_KEY = "usuarios";
const USERS_INDEX_ITEMS = [
  {
    key: "personas",
    label: "Personas",
    icon: "user",
    description: "Gestiona personas registradas en el sistema.",
    tables: ["persons"]
  }
];
const CONTRACT_GROUP_KEY = "contratacion";
const CONTRACT_INDEX_ITEMS = [
  {
    key: "vacantes",
    label: "Vacantes",
    icon: "id-card",
    description: "Gestiona vacantes y su visibilidad.",
    tables: ["vacancies", "vacancy_visibility"]
  },
  {
    key: "contratos",
    label: "Contratos",
    icon: "certificate",
    description: "Gestiona contratos del sistema.",
    tables: ["contracts"]
  }
];
const SECURITY_GROUP_KEY = "seguridad";
const SECURITY_INDEX_ITEMS = [
  {
    key: "roles",
    label: "Roles",
    icon: "lock",
    description: "Gestiona roles y asignaciones de rol.",
    tables: ["roles", "role_assignments", "cargo_role_map", "role_assignment_relation_types"]
  },
  {
    key: "permisos",
    label: "Permisos",
    icon: "square-check",
    description: "Gestiona permisos y su asignación a roles.",
    tables: ["permissions", "role_permissions"]
  }
];

// Índices de sección indexados por su clave de grupo. Sustituye a las cinco copias de cada
// resolver / opener / flag "por sección": el orden de las claves ES el orden de resolución que
// tenía la cadena if/else de selectTable (academia → gestiones → usuarios → contratos → seguridad).
const SECTION_INDEX_ITEMS = {
  [ACADEMY_GROUP_KEY]: ACADEMY_INDEX_ITEMS,
  [GESTION_GROUP_KEY]: GESTION_INDEX_ITEMS,
  [USERS_GROUP_KEY]: USERS_INDEX_ITEMS,
  [CONTRACT_GROUP_KEY]: CONTRACT_INDEX_ITEMS,
  [SECURITY_GROUP_KEY]: SECURITY_INDEX_ITEMS,
};

const TABLE_TAB_LABEL_OVERRIDES = {
  template_seeds: "Semillas",
  template_artifacts: "Plantillas",
  process_definition_templates: "Procesos asignados"
};

const hiddenTables = new Set([]);
const visibleTables = computed(() =>
  tables.value.filter((table) =>
    !hiddenTables.has(table.table) && canReadAdminTable(table.table, currentUser.value)
  )
);
const tableMap = computed(() =>
  Object.fromEntries(visibleTables.value.map((table) => [table.table, table]))
);

const groupedTables = computed(() => {
  const knownTables = new Set();
  const groups = GROUP_DEFS.map((group) => {
    const mainTables = group.main.map((name) => tableMap.value[name]).filter(Boolean);
    const supportTables = group.support.map((name) => tableMap.value[name]).filter(Boolean);
    mainTables.forEach((table) => knownTables.add(table.table));
    supportTables.forEach((table) => knownTables.add(table.table));
    return {
      ...group,
      mainTables,
      supportTables
    };
  });

  const orphanTables = visibleTables.value.filter((table) => !knownTables.has(table.table));
  if (orphanTables.length) {
    groups.push({
      key: "otros",
      label: "Otros",
      mainTables: orphanTables,
      supportTables: []
    });
  }

  return groups;
});

const homeGroups = computed(() =>
  groupedTables.value.filter((group) => (group.mainTables.length + group.supportTables.length) > 0)
);

// Una tarjeta solo se muestra si el backend expone al menos una de sus tablas: sin ninguna no tiene a dónde
// navegar y el clic no haría nada. El filtro va aquí, no en el template, para cubrir los dos v-for de cada grupo.
const buildIndexMenuItems = (indexItems) =>
  indexItems
    .map((item) => {
      const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
      return {
        ...item,
        availableTables,
        tableCount: availableTables.length
      };
    })
    .filter((item) => item.tableCount > 0);

const academyMenuItems = computed(() => buildIndexMenuItems(ACADEMY_INDEX_ITEMS));
const gestionMenuItems = computed(() => buildIndexMenuItems(GESTION_INDEX_ITEMS));
const usersMenuItems = computed(() => buildIndexMenuItems(USERS_INDEX_ITEMS));
const contractsMenuItems = computed(() => buildIndexMenuItems(CONTRACT_INDEX_ITEMS));
const securityMenuItems = computed(() => buildIndexMenuItems(SECURITY_INDEX_ITEMS));

// --- Estado derivado de la URL (fase 3.5, cierre) -----------------------------------------------
// /admin/:section?/:item?/:table? ES el estado de navegación: no hay copia local que sincronizar.
// Antes convivían refs locales (selectedTable, selectedSection y los cinco selectedXItem, más los
// dos flags de grafo) con route.params: un watch empujaba de los refs a la URL (syncAdminUrl) y
// hydrateFromRoute empujaba de vuelta al montar. Ese doble origen de verdad es lo que obligaba a
// repetir el mismo bloque de asignaciones cinco veces, una por sección.
// Ahora todo se DERIVA de route.params y navegar es un router.push. App.vue re-monta la vista por
// route.fullPath, así que cada navegación reconstruye la vista desde la URL — igual que un F5.
// La firma (isSigningView) sigue siendo overlay modal, NO ruta (por diseño).

// El grafo se muestra SOBRE la tabla units/processes (force-graph); en la URL es su propio :table.
const UNIT_GRAPH_SLUG = "organigrama";
const PROCESS_GRAPH_SLUG = "mapa";

const findTableByName = (name) => {
  for (const group of groupedTables.value) {
    const match = [...(group.mainTables || []), ...(group.supportTables || [])]
      .find((candidate) => candidate.table === name);
    if (match) return match;
  }
  return null;
};

// A qué sección/ítem pertenece una tabla. Es la cadena if/else de la antigua selectTable, sin repetir.
const resolveSectionByTable = (tableName) => {
  for (const [sectionKey, items] of Object.entries(SECTION_INDEX_ITEMS)) {
    if (items.some((item) => item.tables.includes(tableName))) return sectionKey;
  }
  const group = groupedTables.value.find((candidate) =>
    [...candidate.mainTables, ...candidate.supportTables].some((item) => item.table === tableName)
  );
  return group?.key || "";
};

const resolveItemByTable = (tableName) => {
  for (const items of Object.values(SECTION_INDEX_ITEMS)) {
    const match = items.find((item) => item.tables.includes(tableName));
    if (match) return match.key;
  }
  return "";
};

const routeTableSlug = computed(() => route.params.table || "");
const graphTabActive = computed(() => routeTableSlug.value === UNIT_GRAPH_SLUG);
const processGraphTabActive = computed(() => routeTableSlug.value === PROCESS_GRAPH_SLUG);

const selectedTable = computed(() => {
  const tableName = graphTabActive.value
    ? "units"
    : processGraphTabActive.value
      ? "processes"
      : routeTableSlug.value;
  return tableName ? findTableByName(tableName) : null;
});

// Con tabla, la sección y el ítem los manda la tabla (la URL puede traer un slug obsoleto); sin
// tabla, los manda el slug de la URL. El "-" es el marcador posicional de ítem vacío.
const selectedSection = computed(() => {
  const table = selectedTable.value;
  if (table) return resolveSectionByTable(table.table);
  const slug = route.params.section || "";
  // hasOwn y no un acceso a secas: el slug viene de la URL y "constructor"/"toString" darían un valor
  // heredado del prototipo, que aquí pasaría por una sección válida.
  return Object.hasOwn(SECTION_KEY_BY_SLUG, slug) ? SECTION_KEY_BY_SLUG[slug] : "";
});

const activeItemKey = computed(() => {
  const table = selectedTable.value;
  if (table) return resolveItemByTable(table.table);
  const itemSlug = route.params.item || "";
  return itemSlug === "-" ? "" : itemSlug;
});

const currentSiblingSourceItem = computed(() => {
  const tableName = selectedTable.value?.table;
  if (!tableName) {
    return null;
  }

  return [
    ...academyMenuItems.value,
    ...gestionMenuItems.value,
    ...usersMenuItems.value,
    ...contractsMenuItems.value,
    ...securityMenuItems.value
  ].find((item) => item.availableTables.some((table) => table.table === tableName)) || null;
});

const currentSiblingTabs = computed(() => {
  if (!selectedTable.value || !currentSiblingSourceItem.value) {
    return [];
  }

  const availableTables = currentSiblingSourceItem.value.availableTables || [];
  if (availableTables.length < 2) {
    return [];
  }

  const tabs = availableTables.map((table) => ({
    key: table.table,
    label: TABLE_TAB_LABEL_OVERRIDES[table.table] || table.label || table.table
  }));
  // Pestaña hermana "Organigrama" para el grupo que contiene unidades.
  if (availableTables.some((table) => table.table === "units")) {
    tabs.push({ key: ORG_GRAPH_TAB_KEY, label: "Organigrama" });
  }
  // Pestaña hermana "Mapa de procesos" para el grupo que contiene procesos.
  if (availableTables.some((table) => table.table === "processes")) {
    tabs.push({ key: PROCESS_GRAPH_TAB_KEY, label: "Mapa de procesos" });
  }
  return tabs;
});

// Índices de sección (landing por grupo con sus ítems). El antiguo "índice CRUD por ítem" se eliminó porque
// duplicaba las pestañas hermanas (los ítems van directo a la primera tabla con sus pestañas).
const showAcademiaIndex = computed(
  () => selectedSection.value === ACADEMY_GROUP_KEY && !selectedTable.value
);
const showGestionesIndex = computed(
  () => selectedSection.value === GESTION_GROUP_KEY && !selectedTable.value
);
// Tablas runtime (registros materializados por los flujos). Se muestran aparte, en el bloque colapsable
// "Trazabilidad y soporte", ya filtradas por permiso de lectura (visibleTables).
const traceabilityOpen = ref(false);
const traceabilityTables = computed(() =>
  visibleTables.value.filter((table) => isTraceabilityTable(table.table))
);
const showUsersIndex = computed(
  () => selectedSection.value === USERS_GROUP_KEY && !selectedTable.value
);
const showContractsIndex = computed(
  () => selectedSection.value === CONTRACT_GROUP_KEY && !selectedTable.value
);
const showSecurityIndex = computed(
  () => selectedSection.value === SECURITY_GROUP_KEY && !selectedTable.value
);

const adminHeroIcon = computed(() =>
  showAcademiaIndex.value ? resolveIconMeta('map-marked-alt', 'Academia').icon
  : showGestionesIndex.value ? resolveIconMeta('check-double', 'Gestiones').icon
  : showUsersIndex.value ? resolveIconMeta('user', 'Usuarios').icon
  : showContractsIndex.value ? resolveIconMeta('certificate', 'Contratos').icon
  : showSecurityIndex.value ? resolveIconMeta('lock', 'Seguridad').icon
  : IconLock
);

const adminHeroTitle = computed(() =>
  showAcademiaIndex.value ? 'Academia'
  : showGestionesIndex.value ? 'Gestiones'
  : showUsersIndex.value ? 'Usuarios'
  : showContractsIndex.value ? 'Contratos'
  : showSecurityIndex.value ? 'Seguridad'
  : 'Panel de administración'
);

const adminHeroDescription = computed(() =>
  showAcademiaIndex.value ? 'Accesos principales para administrar unidades, periodos y cargos institucionales.'
  : showGestionesIndex.value ? 'Accesos por subgrupo para administrar procesos, tareas, plantillas, documentos y firmas.'
  : showUsersIndex.value ? 'Accesos por subgrupo para administrar personas del sistema.'
  : showContractsIndex.value ? 'Accesos por subgrupo para administrar vacantes y contratos.'
  : showSecurityIndex.value ? 'Accesos por subgrupo para administrar roles y permisos.'
  : 'Accesos organizados para crear, editar, leer y eliminar datos del sistema.'
);

const adminHeroKicker = computed(() =>
  selectedTable.value ? 'Tabla activa' : 'Administración'
);

const adminShellHeaderTitle = computed(() =>
  selectedTable.value
    ? (selectedTable.value.label || adminHeroTitle.value)
    : adminHeroTitle.value
);

const adminShellHeaderSubtitle = computed(() =>
  selectedTable.value
    ? ""
    : adminHeroDescription.value
);

// Los grafos son un :table propio en la URL, así que cambiar de pestaña hermana es siempre navegar:
// el guard de navigateAdmin sustituye al antiguo "si ya es la tabla activa, no hagas nada" (que con
// los flags de grafo como refs había que combinar a mano).
const handleSiblingTabChange = (tableName) => {
  if (tableName === ORG_GRAPH_TAB_KEY) {
    if (tableMap.value.units) navigateToTable("units", UNIT_GRAPH_SLUG);
    return;
  }
  if (tableName === PROCESS_GRAPH_TAB_KEY) {
    if (tableMap.value.processes) navigateToTable("processes", PROCESS_GRAPH_SLUG);
    return;
  }
  const targetTable = tableMap.value[tableName];
  if (targetTable) selectTable(targetTable);
};

const handleHeroBack = () => {
  // El índice de sección vuelve al panel principal de administración; desde el home, sale a /home.
  if (selectedSection.value) {
    goAdminHome();
    return;
  }
  router.push('/home');
};

const groupIconMap = {
  estructura_academico: "map-marked-alt",
  procesos: "check-double",
  usuarios: "user",
  contratacion: "id-card",
  seguridad: "lock",
  otros: "circle"
};


const resolveIconMeta = (iconName, label = "") => {
  switch (iconName) {
    case 'map-marked-alt':
      return resolveWorkspaceAdminGroupIcon('estructura_academico');
    case 'check-double':
    case 'square-check':
      return resolveWorkspaceAdminGroupIcon('procesos');
    case 'user':
      return resolveWorkspaceAdminGroupIcon('usuarios');
    case 'id-card':
    case 'certificate':
      return resolveWorkspaceAdminGroupIcon('contratacion');
    case 'lock':
      return resolveWorkspaceAdminGroupIcon('seguridad');
    case 'plus':
      return { icon: IconPlus, tone: 'emerald' };
    case 'bell':
      return { icon: IconBell, tone: 'amber' };
    case 'circle':
      return { icon: IconCircle, tone: 'slate' };
    case 'info-circle':
      return { icon: IconInfoCircle, tone: 'slate' };
    default:
      return resolveWorkspaceProfileMenuIcon(iconName, label);
  }
};
const groupIconMeta = (group) => resolveWorkspaceAdminGroupIcon(group?.key || "");
const tableIconMeta = (tableName = "") => resolveWorkspaceAdminTableIcon(tableName);

const groupDescMap = {
  'estructura_academico': 'Administración de facultades, carreras, currículos y periodos académicos.',
  'procesos': 'Configuración y control de flujos de trabajo, tareas complejas y plantillas doc.',
  'usuarios': 'Gestión de personas, perfiles, autenticación y cuenta de ingreso.',
  'contratacion': 'Manejo de requerimientos de vacantes, contratos y registros de origen.',
  'seguridad': 'Auditoría de roles, asignaciones de permisos, recursos y control de acceso.'
};
const descriptionForGroup = (group) => groupDescMap[group?.key] || 'Gestión segura de módulos del sistema.';



const isAcademiaGroup = (group) => group?.key === ACADEMY_GROUP_KEY;
const isGestionGroup = (group) => group?.key === GESTION_GROUP_KEY;
const isUsuariosGroup = (group) => group?.key === USERS_GROUP_KEY;
const isContratosGroup = (group) => group?.key === CONTRACT_GROUP_KEY;
const isSeguridadGroup = (group) => group?.key === SECURITY_GROUP_KEY;

// Un ítem del índice está activo si es el de la URL dentro de su sección, o si contiene la tabla
// abierta. Las cinco funciones que el template llama por nombre son ya un alias de esta.
const isSectionItemActive = (sectionKey, item) => {
  if (!item) {
    return false;
  }
  if (selectedSection.value === sectionKey && activeItemKey.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isAcademyItemActive = (item) => isSectionItemActive(ACADEMY_GROUP_KEY, item);
const isGestionItemActive = (item) => isSectionItemActive(GESTION_GROUP_KEY, item);
const isUsersItemActive = (item) => isSectionItemActive(USERS_GROUP_KEY, item);
const isContractsItemActive = (item) => isSectionItemActive(CONTRACT_GROUP_KEY, item);
const isSecurityItemActive = (item) => isSectionItemActive(SECURITY_GROUP_KEY, item);

const openGroupIndex = (group) => {
  if (!group) {
    return;
  }
  if (SECTION_INDEX_ITEMS[group.key]) {
    navigateAdmin({ section: group.key });
    return;
  }
  // Grupos sin índice de sección propio (p. ej. "Otros"): ir directo a su primera tabla.
  const firstTable = [...(group.mainTables || []), ...(group.supportTables || [])][0];
  openCategories.value[group.label] = true;
  if (firstTable) {
    selectTable(firstTable);
  }
};

const onGroupTitleClick = (group) => {
  isSigningView.value = false;
  if (!group) {
    return;
  }
  const isOpen = Boolean(openCategories.value[group.label]);
  openCategories.value[group.label] = !isOpen;
  if (!isOpen) {
    openGroupIndex(group);
  }
};

// --- Navegación: escribir en la URL ---------------------------------------------------------
// Toda acción de navegación acaba aquí. Antes cada opener asignaba los siete refs y un watch
// traducía el resultado a una URL; ahora se construye la URL directamente y el estado se re-deriva.
const buildAdminParams = ({ section = "", item = "", table = "" }) => {
  const params = {};
  if (section) params.section = SECTION_SLUG_BY_KEY[section] || section;
  // El item es posicional: si hay tabla sin item resuelto, se usa "-" como marcador de hueco.
  if (params.section && (item || table)) params.item = item || "-";
  if (table) params.table = table;
  return params;
};

const navigateAdmin = (target = {}) => {
  isSigningView.value = false;
  const params = buildAdminParams(target);
  const current = route.params;
  if ((current.section || "") === (params.section || "")
    && (current.item || "") === (params.item || "")
    && (current.table || "") === (params.table || "")) {
    return;
  }
  // push (no replace): cada accion de navegacion crea UNA entrada de historial para que el boton
  // atras recorra tabla -> indice -> inicio.
  router.push({ name: "admin", params }).catch(() => {});
};

// Navega a una tabla resolviendo su seccion/item. `slug` permite abrir un grafo (organigrama/mapa),
// que en la URL es su propio :table sobre la misma tabla base.
const navigateToTable = (tableName, slug = tableName) => {
  navigateAdmin({
    section: resolveSectionByTable(tableName),
    item: resolveItemByTable(tableName),
    table: slug,
  });
};

const selectTable = (table, filters = null) => {
  if (!table) {
    return;
  }
  pendingTableFilters.value = filters;
  navigateToTable(table.table);
};

// Un item del indice va DIRECTO a las pestanas (sin menu intermedio): abre su primera tabla.
const openSectionItem = (sectionKey, item) => {
  if (!item) {
    return;
  }
  navigateAdmin({
    section: sectionKey,
    item: item.key,
    table: item.availableTables?.[0]?.table || "",
  });
};

const openAcademyItem = (item) => {
  if (!item) {
    return;
  }
  // Unico desvio del camino generico: si el subgrupo tiene unidades, abre el Organigrama por defecto.
  if (item.availableTables?.some((table) => table.table === "units")) {
    navigateAdmin({ section: ACADEMY_GROUP_KEY, item: item.key, table: UNIT_GRAPH_SLUG });
    return;
  }
  openSectionItem(ACADEMY_GROUP_KEY, item);
};
const openGestionItem = (item) => openSectionItem(GESTION_GROUP_KEY, item);
const openUsersItem = (item) => openSectionItem(USERS_GROUP_KEY, item);
const openContractsItem = (item) => openSectionItem(CONTRACT_GROUP_KEY, item);
const openSecurityItem = (item) => openSectionItem(SECURITY_GROUP_KEY, item);

const openGroupFromHome = (group) => {
  if (!group) {
    return;
  }
  openGroupIndex(group);
};

const handleManagerGoBack = () => {
  if (!selectedTable.value) {
    return;
  }
  // Volver de una tabla cae en el indice de seccion (sus items), no en el indice por item (que era
  // identico a las pestanas y se elimino). Sin seccion, cae en el inicio de administracion.
  pendingTableFilters.value = null;
  navigateAdmin({ section: selectedSection.value });
};

// Sin tabla, sin seccion y sin item no hay nada abierto: los cinco showXIndex derivan de la seccion,
// asi que comprobarlos aparte era redundante.
const isHomeActive = computed(() =>
  !selectedTable.value && !selectedSection.value && !activeItemKey.value
);

const goAdminHome = () => {
  Object.keys(openCategories.value).forEach((key) => {
    openCategories.value[key] = false;
  });
  navigateAdmin();
};


const fetchMeta = async () => {
  loadingMeta.value = true;
  metaError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_META);
    tables.value = response.data?.tables || [];
    groupedTables.value.forEach((group) => {
      if (openCategories.value[group.label] === undefined) {
        openCategories.value[group.label] = false;
      }
    });
    // El acordeon del aside NO vive en la URL (es chrome, no navegacion): se abre la categoria de la
    // seccion activa. Es exactamente el estado en que quedaba tras hydrateFromRoute, que re-ejecutaba
    // los openers en cada remontaje (App.vue re-monta la vista por route.fullPath).
    const activeGroup = groupedTables.value.find((group) => group.key === selectedSection.value);
    if (activeGroup) {
      openCategories.value[activeGroup.label] = true;
    }
  } catch (error) {
    metaError.value = error?.response?.data?.message || "No se pudo cargar el catalogo.";
  } finally {
    loadingMeta.value = false;
  }
};

onMounted(() => {
  const userDataString = localStorage.getItem("user");
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
    } catch {
      // Se ignora a propósito: el `user` de localStorage es un dato del cliente que puede
      // estar corrupto o venir de una versión anterior. Quedarse sin usuario en memoria es
      // la degradación correcta (la vista lo trata como no cargado); no hay nada que
      // diagnosticar en el servidor ni nada que contarle al usuario.
      currentUser.value = null;
    }
  }
  fetchMeta();
});

</script>
