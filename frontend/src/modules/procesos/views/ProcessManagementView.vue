<template>
  <AppWorkspaceShell
    :menu-open="menuOpen"
    :show-notify="showNotify"
    current-section="processes"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Gestión de procesos"
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="router.push({ name: 'home-signatures' })"
    @primary-nav="revealSidebarForNav"
  >
    <template #header>
      <AppContextHeader :title="shellHeaderTitle" :subtitle="shellHeaderSubtitle" />
    </template>

    <template #sidebar>
      <div class="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-14rem)] custom-scrollbar custom-scrollbar--dark">
        <div class="deasy-nav-shell">
          <div class="deasy-nav-section">
            <button
              type="button"
              class="deasy-nav-item"
              :class="isHomeActive ? 'deasy-nav-item--active' : ''"
              @click="goProcessHome"
            >
              <span class="deasy-nav-item__icon">
                <IconHome class="h-4.5 w-4.5 shrink-0" />
              </span>
              <span>Inicio</span>
            </button>
          </div>

          <div class="deasy-nav-section">
            <button
              v-for="item in processMenuItems"
              :key="item.key"
              type="button"
              class="deasy-nav-item"
              :class="isProcessItemActive(item) ? 'deasy-nav-item--active' : ''"
              @click="openProcessItem(item)"
            >
              <span
                class="deasy-nav-item__icon"
                :class="workspaceIconToneClass(resolveIconMeta(item.icon, item.label).tone)"
              >
                <component :is="resolveIconMeta(item.icon, item.label).icon" class="h-4.5 w-4.5 shrink-0" />
              </span>
              <span>{{ item.label }}</span>
            </button>

            <div v-if="!loadingMeta && !processMenuItems.length" class="deasy-nav-feedback deasy-nav-feedback--muted my-2">
              No hay gestiones disponibles.
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!selectedTable" class="w-full max-w-6xl mx-auto space-y-6">
      <div class="deasy-section-card flex flex-col min-h-100">
        <div v-if="loadingMeta" class="flex-1 flex items-center justify-center">
          <div class="inline-flex items-center gap-3">
            <div class="deasy-spinner deasy-spinner--lg text-info"></div>
            <span class="text-muted font-medium">Cargando catálogos...</span>
          </div>
        </div>

        <AppAlert class="text-center" v-else-if="metaError">
          {{ metaError }}
        </AppAlert>

        <template v-else>
          <AppPageHeader size="hero" shell-class="mb-8" :overline="heroKicker" :title="heroTitle" :description="heroDescription">
            <template #media><component :is="heroIcon" class="h-10 w-10" /></template>
            <template #actions>
              <AppButton variant="neutral-outline" @click="handleHeroBack">
          <IconArrowLeft class="h-4.5 w-4.5" />
          <span>Volver</span>
        </AppButton>
            </template>
          </AppPageHeader>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 items-start">
            <template v-if="showProcessCrudIndex">
              <AppNavCard
                v-for="table in processCrudTables"
                :key="table.table"
                layout="stacked"
                :title="table.label"
                meta="Gestionar"
                :description="table.description || 'Configura la estructura, relaciones y permisos propios de este submódulo.'"
                :icon="tableIconMeta(table.table).icon"
                show-arrow
                class-name="min-h-[170px]"
                @click="selectTable(table)"
              />
              <AppNavCard
                v-if="selectedProcessItem?.key === 'plantillas' && canCreateAdminTable('template_artifacts', currentUser)"
                layout="stacked"
                title="Nueva plantilla de documento"
                meta=""
                description="Crear desde una semilla o archivos"
                :icon="IconPlus"
                badge="Acción especial"
                badge-variant="info"
                class-name="min-h-[170px] bg-gradient-to-br from-blue-light-50 to-white border-blue-light-200 hover:border-blue-light-400"
                icon-wrapper-class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--info group-hover:border-blue-light-300 group-hover:bg-blue-light-50 group-hover:text-info transition-colors"
                title-class="text-info group-hover:text-info"
                @click="openTemplateArtifactDraftFromHome"
              />
              <AppEmpty class="col-span-full" v-if="!processCrudTables.length">
                No hay tablas disponibles para este subgrupo.
              </AppEmpty>
            </template>

            <template v-else>
              <div class="col-span-full">
                <AdminOperationSummary :stats="operationStats" />
              </div>
              <AppNavCard
                v-for="item in processMenuItems"
                :key="item.key"
                layout="stacked"
                :title="item.label"
                :description="item.description || 'Administra y configura los datos de esta sección.'"
                :icon="resolveIconMeta(item.icon, item.label).icon"
                show-arrow
                class-name="min-h-[140px]"
                @click="openProcessItem(item)"
              />
              <div v-if="traceabilityTables.length" class="col-span-full mt-2">
                <button
                  type="button"
                  class="deasy-picker deasy-picker--flat justify-between"
                  @click="traceabilityOpen = !traceabilityOpen"
                >
                  <span>
                    <span class="block text-sm font-bold text-body">Trazabilidad y soporte</span>
                    <span class="block text-xs text-muted">Registros técnicos generados durante la ejecución de tareas, entregas y firmas. Disponibles para consulta, diagnóstico y soporte.</span>
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
              <AppEmpty class="col-span-full" v-if="!processMenuItems.length && !traceabilityTables.length">
                No tienes permisos para gestionar procesos.
              </AppEmpty>
            </template>
          </div>
        </template>
      </div>
    </div>

    <div v-else class="w-full flex-1 overflow-hidden relative flex flex-col min-h-0">
      <div class="deasy-typography w-full h-full relative overflow-y-auto">
        <AdminTableManager
          ref="adminManager"
          :table="selectedTable"
          :sibling-tabs="currentSiblingTabs"
          :active-sibling-tab="selectedTable?.table || ''"
          :all-tables="tables"
          :initial-filters="pendingTableFilters"
          @select-sibling-tab="handleSiblingTabChange"
          @go-back="handleManagerGoBack"
        />
      </div>
    </div>

    <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
  </AppWorkspaceShell>
</template>

<script setup>
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import { computed, nextTick, onMounted, ref } from "vue";
import AppPageHeader from "@/shared/components/layout/AppPageHeader.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppContextHeader from "@/shared/components/layout/AppContextHeader.vue";
import { useWorkspaceChrome } from "@/shared/composables/useWorkspaceChrome.js";
import { useRouter } from "vue-router";
import axios from "@/core/services/httpClient";
import {
  IconArrowLeft,
  IconChevronDown,
  IconCircle,
  IconHome,
  IconPlus,
} from "@tabler/icons-vue";
import AppWorkspaceShell from "@/layouts/workspace/AppWorkspaceShell.vue";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import WorkspaceChatLauncher from "@/shared/components/widgets/WorkspaceChatLauncher.vue";
import AdminTableManager from "@/modules/admin/components/tables/AdminTableManager.vue";
import AdminOperationSummary from "@/modules/admin/components/tables/AdminOperationSummary.vue";
import { API_ROUTES } from "@/core/config/apiConfig";
import { DEFAULT_USER_PHOTO, resolveUserPhotoUrl } from "@/core/services/userPhotoService.js";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import {
  canCreateAdminTable,
  canReadAdminTable,
  getStoredUser,
  isTraceabilityTable
} from "@/core/utils/accessControl.js";
import {
  resolveWorkspaceAdminGroupIcon,
  resolveWorkspaceAdminTableIcon,
  workspaceIconToneClass
} from "@/shared/utils/workspaceNavIcons.js";

const PROCESS_INDEX_ITEMS = [
  {
    key: "procesos",
    label: "Procesos",
    icon: "check-double",
    description: "Gestiona procesos base, configuraciones y reglas de alcance.",
    tables: ["processes", "process_definition_series", "process_definition_versions", "process_definition_period_types", "process_target_rules"]
  },
  {
    key: "plantillas",
    label: "Modelos",
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
    tables: ["fill_flow_templates", "fill_flow_steps"]
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

const TABLE_TAB_LABEL_OVERRIDES = {
  template_seeds: "Semillas",
  template_artifacts: "Plantillas",
  process_definition_templates: "Procesos asignados"
};

const router = useRouter();
// Procesos es la unica vista cuyo menu arranca siempre cerrado; las otras tres lo abren en
// escritorio. Se conserva tal cual: unificarlo es decision de producto, no de este refactor.
const { menuOpen, showNotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome({ menuOpenByDefault: false });
const loadingMeta = ref(false);
const metaError = ref("");
const tables = ref([]);
const selectedTable = ref(null);
const operationStats = ref(null);
const pendingTableFilters = ref(null);
const selectedProcessItemKey = ref("");
const adminManager = ref(null);
const currentUser = ref(getStoredUser());

// La foto se descarga del endpoint autenticado, asi que deja de ser un computed
// sincrono: se resuelve al montar la vista y cae al avatar por defecto si falla.
const userPhoto = ref(DEFAULT_USER_PHOTO);

const userFullName = computed(() => {
  const firstName = currentUser.value?.first_name ?? "";
  const lastName = currentUser.value?.last_name ?? "";
  return `${firstName} ${lastName}`.trim() || currentUser.value?.email || "Usuario";
});

const visibleTables = computed(() =>
  tables.value.filter((table) => canReadAdminTable(table.table, currentUser.value))
);

const tableMap = computed(() =>
  Object.fromEntries(visibleTables.value.map((table) => [table.table, table]))
);

const processMenuItems = computed(() =>
  PROCESS_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  }).filter((item) => item.availableTables.length)
);

const selectedProcessItem = computed(() =>
  processMenuItems.value.find((item) => item.key === selectedProcessItemKey.value) || null
);

const processCrudTables = computed(() => selectedProcessItem.value?.availableTables || []);

// Bloque secundario "Trazabilidad y soporte": tablas runtime ya filtradas por permiso de lectura.
const traceabilityOpen = ref(false);
const traceabilityTables = computed(() =>
  visibleTables.value.filter((table) => isTraceabilityTable(table.table))
);

const showProcessCrudIndex = computed(() =>
  Boolean(selectedProcessItemKey.value) && !selectedTable.value
);

const currentSiblingSourceItem = computed(() => {
  const tableName = selectedTable.value?.table;
  if (!tableName) return null;
  return processMenuItems.value.find((item) =>
    item.availableTables.some((table) => table.table === tableName)
  ) || null;
});

const currentSiblingTabs = computed(() => {
  if (!selectedTable.value || !currentSiblingSourceItem.value) return [];
  const availableTables = currentSiblingSourceItem.value.availableTables || [];
  if (availableTables.length < 2) return [];
  return availableTables.map((table) => ({
    key: table.table,
    label: TABLE_TAB_LABEL_OVERRIDES[table.table] || table.label || table.table
  }));
});

const isHomeActive = computed(() =>
  !selectedTable.value && !selectedProcessItemKey.value
);

const heroIcon = computed(() =>
  showProcessCrudIndex.value
    ? resolveIconMeta(selectedProcessItem.value?.icon || "check-double", selectedProcessItem.value?.label).icon
    : resolveWorkspaceAdminGroupIcon("procesos").icon
);

const heroTitle = computed(() =>
  showProcessCrudIndex.value
    ? selectedProcessItem.value?.label || "Procesos"
    : "Procesos"
);

const heroDescription = computed(() =>
  showProcessCrudIndex.value
    ? selectedProcessItem.value?.description || "Gestiona tablas relacionadas al subgrupo."
    : "Accesos por subgrupo para administrar procesos, tareas, plantillas, documentos, entrega y firmas."
);

const heroKicker = computed(() =>
  showProcessCrudIndex.value ? "Índice de gestión" : "Gestión de procesos"
);

const shellHeaderTitle = computed(() =>
  selectedTable.value ? selectedTable.value.label || heroTitle.value : heroTitle.value
);

const shellHeaderSubtitle = computed(() =>
  selectedTable.value ? "" : heroDescription.value
);

const tableIconMeta = (tableName = "") => resolveWorkspaceAdminTableIcon(tableName);

const resolveIconMeta = (iconName, label = "") => {
  switch (iconName) {
    case "check-double":
    case "square-check":
    case "check":
      return resolveWorkspaceAdminGroupIcon("procesos");
    case "certificate":
      return resolveWorkspaceAdminGroupIcon("contratacion");
    case "info-circle":
      return resolveWorkspaceAdminTableIcon(label || "documents");
    case "circle":
      return { icon: IconCircle, tone: "slate" };
    default:
      return resolveWorkspaceAdminGroupIcon("procesos");
  }
};

const openProcessItem = (item) => {
  if (!item?.availableTables?.length) return;
  selectedProcessItemKey.value = item.key;
  selectedTable.value = null;
};

const isProcessItemActive = (item) => {
  if (selectedProcessItemKey.value === item.key && !selectedTable.value) return true;
  return item.tables.includes(selectedTable.value?.table || "");
};

const goProcessHome = () => {
  selectedTable.value = null;
  selectedProcessItemKey.value = "";
};

const selectTable = (table, filters = null) => {
  if (!table) return;
  pendingTableFilters.value = filters;
  selectedTable.value = table;
};

const handleSiblingTabChange = (tableName) => {
  const targetTable = tableMap.value[tableName];
  if (!targetTable || targetTable.table === selectedTable.value?.table) return;
  selectTable(targetTable);
};

const handleManagerGoBack = () => {
  selectedTable.value = null;
  pendingTableFilters.value = null;
};

const handleHeroBack = () => {
  // Subir un nivel: si hay un subgrupo abierto (índice CRUD), volver al índice de procesos; si ya
  // estamos en el índice, ir al home global.
  if (selectedProcessItemKey.value) {
    goProcessHome();
    return;
  }
  router.push("/home");
};

const openTemplateArtifactDraftFromHome = async () => {
  const templateArtifactsTable = tableMap.value.template_artifacts;
  if (!templateArtifactsTable) return;
  selectTable(templateArtifactsTable);
  await nextTick();
  await nextTick();
  adminManager.value?.openDraftArtifactModal?.();
};

const fetchMeta = async () => {
  loadingMeta.value = true;
  metaError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_META);
    tables.value = response.data?.tables || [];
  } catch (error) {
    metaError.value = error?.response?.data?.message || "No se pudo cargar el catálogo.";
  } finally {
    loadingMeta.value = false;
  }
};

// Resumen de operación: conteos agregados (solo lectura). Si falla, el bloque no se muestra.
const fetchOperationStats = async () => {
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_OPERATION_STATS);
    operationStats.value = response.data || null;
  } catch {
    operationStats.value = null;
  }
};

onMounted(async () => {
  fetchMeta();
  fetchOperationStats();
  userPhoto.value = await resolveUserPhotoUrl(currentUser.value);
});
</script>
