<template>
  <AppWorkspaceShell
    :menu-open="menuOpen"
    :show-notify="showNotify"
    current-section="processes"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Gestión de procesos"
    @menu-toggle="handleHeaderToggle"
    @close-mobile="menuOpen = false"
    @notify="toggleNotify"
    @notify-close="showNotify = false"
    @sign="router.push({ name: 'home-signatures' })"
    @primary-nav="handlePrimaryNavInteraction"
  >
    <template #header>
      <div class="deasy-context-header">
        <div class="deasy-context-header__copy">
          <div class="deasy-context-header__title">{{ shellHeaderTitle }}</div>
          <div v-if="shellHeaderSubtitle" class="deasy-context-header__subtitle">
            {{ shellHeaderSubtitle }}
          </div>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div class="flex flex-col gap-2 flex-1 overflow-y-auto pr-1 xl:max-h-[calc(100vh-14rem)] custom-scrollbar">
        <div class="deasy-nav-shell">
          <div class="deasy-nav-section">
            <button
              type="button"
              class="deasy-nav-item"
              :class="isHomeActive ? 'deasy-nav-item--active' : ''"
              @click="goProcessHome"
            >
              <span class="deasy-nav-item__icon deasy-nav-item__icon--direct">
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
            <div class="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-slate-500 font-medium">Cargando catálogos...</span>
          </div>
        </div>

        <div
          v-else-if="metaError"
          class="text-red-500 font-medium text-center p-6 bg-red-50/50 rounded-2xl border border-red-100"
        >
          {{ metaError }}
        </div>

        <template v-else>
          <section class="deasy-hero-shell mb-8">
            <div class="deasy-hero-layout">
              <div class="deasy-hero-main deasy-hero-main--with-media">
                <div class="deasy-hero-media">
                  <div class="deasy-hero-media-card">
                    <component :is="heroIcon" class="h-10 w-10" />
                  </div>
                </div>
                <div class="deasy-hero-copy sm:pt-0">
                  <div class="deasy-hero-kicker">{{ heroKicker }}</div>
                  <h2 class="deasy-hero-title">{{ heroTitle }}</h2>
                  <p class="deasy-hero-description">{{ heroDescription }}</p>
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
                class-name="min-h-[170px] bg-gradient-to-br from-sky-50 to-white border-sky-200 hover:border-sky-400"
                icon-wrapper-class="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200 group-hover:border-sky-300 group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors"
                title-class="text-sky-900 group-hover:text-sky-700"
                @click="openTemplateArtifactDraftFromHome"
              />
              <div v-if="!processCrudTables.length" class="col-span-full py-10 text-center text-slate-500 font-medium">
                No hay tablas disponibles para este subgrupo.
              </div>
            </template>

            <template v-else>
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
              <div v-if="!processMenuItems.length" class="col-span-full py-10 text-center text-slate-500 font-medium">
                No tienes permisos para gestionar procesos.
              </div>
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
          :active-sibling-tab="selectedTable?.table || ''"
          :all-tables="tables"
          @select-sibling-tab="handleSiblingTabChange"
          @go-back="handleManagerGoBack"
        />
      </div>
    </div>

    <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
  </AppWorkspaceShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import {
  IconArrowLeft,
  IconCircle,
  IconHome,
  IconPlus,
} from "@tabler/icons-vue";
import AppWorkspaceShell from "@/layouts/workspace/AppWorkspaceShell.vue";
import AppNavCard from "@/shared/components/layout/AppNavCard.vue";
import WorkspaceChatLauncher from "@/shared/components/widgets/WorkspaceChatLauncher.vue";
import AdminTableManager from "@/modules/admin/components/tables/AdminTableManager.vue";
import { API_ROUTES } from "@/core/config/apiConfig";
import {
  canCreateAdminTable,
  canReadAdminTable,
  getStoredUser
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
    tables: ["processes", "process_definition_series", "process_definition_versions", "process_definition_triggers", "process_target_rules"]
  },
  {
    key: "plantillas",
    label: "Plantillas",
    icon: "certificate",
    description: "Gestiona seeds, artifacts y plantillas de configuración.",
    tables: ["template_seeds", "template_artifacts", "process_definition_templates"]
  },
  {
    key: "tareas",
    label: "Tareas",
    icon: "square-check",
    description: "Administra corridas, tareas, entregables y asignaciones.",
    tables: ["process_runs", "tasks", "task_items", "task_assignments"]
  },
  {
    key: "documentos",
    label: "Documentos",
    icon: "info-circle",
    description: "Administra documentos y versiones de documentos.",
    tables: ["documents", "document_versions"]
  },
  {
    key: "entrega",
    label: "Entrega",
    icon: "check-double",
    description: "Gestiona flujos, pasos e instancias de entrega documental.",
    tables: ["fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests"]
  },
  {
    key: "firmas",
    label: "Firmas",
    icon: "check",
    description: "Gestiona flujos, solicitudes, estados y firmas documentales.",
    tables: [
      "signature_flow_templates",
      "signature_flow_steps",
      "signature_flow_instances",
      "signature_requests",
      "document_signatures",
      "signature_types",
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

const defaultPhoto = "/images/avatar.png";
const router = useRouter();
const menuOpen = ref(false);
const showNotify = ref(false);
const loadingMeta = ref(false);
const metaError = ref("");
const tables = ref([]);
const selectedTable = ref(null);
const selectedProcessItemKey = ref("");
const adminManager = ref(null);
const currentUser = ref(getStoredUser());

const resolvePhotoUrl = (value) => {
  if (!value || typeof value !== "string") return defaultPhoto;
  if (/^(https?:)?\/\//.test(value) || value.startsWith("/")) return value;
  return defaultPhoto;
};

const userPhoto = computed(() =>
  resolvePhotoUrl(
    currentUser.value?.photoUrl ||
    currentUser.value?.photo_url ||
    currentUser.value?.photo ||
    currentUser.value?.avatar
  )
);

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

const selectTable = (table) => {
  if (!table) return;
  selectedTable.value = table;
};

const handleSiblingTabChange = (tableName) => {
  const targetTable = tableMap.value[tableName];
  if (!targetTable || targetTable.table === selectedTable.value?.table) return;
  selectTable(targetTable);
};

const handleManagerGoBack = () => {
  selectedTable.value = null;
};

const handleHeroBack = () => {
  if (showProcessCrudIndex.value) {
    goProcessHome();
    return;
  }
  router.push({ name: "home" });
};

const openTemplateArtifactDraftFromHome = async () => {
  const templateArtifactsTable = tableMap.value.template_artifacts;
  if (!templateArtifactsTable) return;
  selectTable(templateArtifactsTable);
  await nextTick();
  await nextTick();
  adminManager.value?.openDraftArtifactModal?.();
};

const handleHeaderToggle = () => {
  menuOpen.value = !menuOpen.value;
};

const handlePrimaryNavInteraction = ({ active } = {}) => {
  if (typeof window === "undefined") return;
  if (window.innerWidth >= 1280) {
    menuOpen.value = active ? !menuOpen.value : true;
    return;
  }
  menuOpen.value = true;
};

const toggleNotify = () => {
  showNotify.value = !showNotify.value;
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

onMounted(() => {
  fetchMeta();
});
</script>
