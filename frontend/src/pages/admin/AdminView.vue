<template>
  <div class="admin-page admin-typography">
    <s-header @onclick="onClick('Menu')">
      <div class="header-left">
        <span class="nav-link text-white fw-semibold">Administrador</span>
      </div>
      <div class="header-right">
        <router-link to="/logout" class="nav-link text-white p-0">
          <img class="avatar" src="/images/logout.svg" alt="Cerrar sesion" />
        </router-link>
        <button class="nav-link text-white p-0" type="button" @click="onClick('Message')">
          <font-awesome-icon icon="bell" class="avatar" />
        </button>
      </div>
    </s-header>

    <div class="row g-3">
      <s-menu :show="vmenu">
        <div class="admin-menu">
          <UserProfile :photo="userPhoto" :username="userFullName" />

          <div v-for="group in groupedTables" :key="group.key" class="menu-section">
            <button
              class="menu-section-title text-white w-100"
              type="button"
              :class="{ 'is-open': openCategories[group.label] }"
              @click="toggleCategory(group.label)"
            >
              <span class="menu-title-left">
                <font-awesome-icon :icon="iconForGroup(group)" class="menu-title-icon" />
                <span>{{ group.label }}</span>
              </span>
            </button>
            <div v-show="openCategories[group.label]" class="menu-section-body">
              <div class="list-group list-group-flush">
                <button
                  v-for="table in group.mainTables"
                  :key="table.table"
                  class="list-group-item list-group-item-action"
                  :class="{ active: selectedTable?.table === table.table }"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="menu-item-content">
                    <font-awesome-icon :icon="iconForTable(table.table)" class="menu-item-icon" />
                    <span>{{ table.label }}</span>
                  </span>
                </button>
              </div>
              <div v-if="group.supportTables.length" class="menu-section-label small">
                Relaciones y soporte
              </div>
              <div v-if="group.supportTables.length" class="list-group list-group-flush">
                <button
                  v-for="table in group.supportTables"
                  :key="table.table"
                  class="list-group-item list-group-item-action"
                  :class="{ active: selectedTable?.table === table.table }"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="menu-item-content">
                    <font-awesome-icon :icon="iconForTable(table.table)" class="menu-item-icon" />
                    <span>{{ table.label }}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </s-menu>

      <s-body :showmenu="vmenu" :shownotify="vnotify">
        <div class="container-fluid py-4">
          <div v-if="activeGroup?.key !== 'procesos'" class="profile-section-header">
            <div>
              <h2 class="text-start profile-section-title">Panel de administracion</h2>
              <p class="profile-section-subtitle">
                Accesos organizados para crear, editar, leer y eliminar datos del sistema.
              </p>
            </div>
          </div>

          <div v-if="loadingMeta" class="text-muted">Cargando catalogos...</div>
          <div v-else-if="metaError" class="text-danger">{{ metaError }}</div>
          <div v-else>
            <div v-if="activeGroup?.key !== 'procesos'" class="row g-4 mb-4">
              <div
                v-for="table in categoryTables"
                :key="table.table"
                class="col-12 col-md-6 col-xl-4"
              >
                <div class="card shadow-sm h-100">
                  <div class="card-body d-flex flex-column">
                    <h3 class="text-start mb-2">{{ table.label }}</h3>
                    <p class="text-muted mb-4">Tabla: {{ table.table }}</p>
                    <button
                      type="button"
                      class="btn btn-primary btn-lg w-100 mt-auto"
                      @click="selectTable(table)"
                    >
                      Gestionar
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeGroup?.key !== 'procesos' && supportTables.length" class="row g-3 mb-4">
              <div class="col-12">
                <div class="card shadow-sm">
                  <div class="card-body">
                    <h3 class="text-start mb-3">Relaciones y soporte</h3>
                    <div class="row g-2">
                      <div
                        v-for="table in supportTables"
                        :key="table.table"
                        class="col-12 col-md-6 col-xl-4"
                      >
                        <div class="d-flex align-items-center justify-content-between border rounded p-2">
                          <span>{{ table.label }}</span>
                          <button
                            type="button"
                            class="btn btn-outline-primary btn-sm"
                            @click="selectTable(table)"
                          >
                            Gestionar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AdminTableManager
          ref="adminManager"
          :table="selectedTable"
          :all-tables="tables"
        />
      </s-body>

      <s-message :show="vnotify" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import axios from "axios";
import SMenu from "@/layouts/SMenu.vue";
import SMessage from "@/layouts/SNotify.vue";
import SBody from "@/layouts/SBody.vue";
import SHeader from "@/layouts/SHeader.vue";
import UserProfile from "@/components/UserProfile.vue";
import AdminTableManager from "./AdminTableManager.vue";
import { API_ROUTES } from "@/services/apiConfig";

const vmenu = ref(true);
const vnotify = ref(false);
const tables = ref([]);
const loadingMeta = ref(false);
const metaError = ref("");
const selectedTable = ref(null);
const openCategories = ref({});
const adminManager = ref(null);

const currentUser = ref(null);
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
    main: ["unit_types", "units", "relation_unit_types", "unit_relations", "cargos", "unit_positions", "position_assignments", "terms"],
    support: []
  },
  {
    key: "procesos",
    label: "Gestiones",
    main: ["processes", "process_versions", "tasks", "task_assignments", "templates", "template_versions", "documents", "document_versions"],
    support: ["signature_flow_templates", "signature_flow_steps", "signature_flow_instances", "signature_requests", "document_signatures", "signature_types", "signature_statuses", "signature_request_statuses"]
  },
  {
    key: "usuarios",
    label: "Usuarios",
    main: ["persons", "roles", "permissions", "role_assignments"],
    support: ["role_permissions", "cargo_role_map", "resources", "actions"]
  },
  {
    key: "contratacion",
    label: "Contratacion",
    main: ["vacancies", "aplications", "offers", "contracts"],
    support: ["contract_origins", "contract_origin_recruitment", "contract_origin_renewal"]
  },
  {
    key: "seguridad",
    label: "Seguridad",
    main: [],
    support: []
  },
];

const hiddenTables = new Set([]);
const visibleTables = computed(() => tables.value.filter((table) => !hiddenTables.has(table.table)));
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

const activeGroup = computed(() => {
  if (selectedTable.value) {
    return groupedTables.value.find((group) =>
      [...group.mainTables, ...group.supportTables].some((table) => table.table === selectedTable.value.table)
    );
  }
  return groupedTables.value[0] || null;
});

const categoryTables = computed(() => activeGroup.value?.mainTables || []);
const supportTables = computed(() => activeGroup.value?.supportTables || []);

const groupIconMap = {
  estructura_academico: "map-marked-alt",
  procesos: "check-double",
  usuarios: "user",
  contratacion: "id-card",
  seguridad: "lock",
  otros: "circle"
};

const iconForGroup = (group) => groupIconMap[group?.key] || "circle";

const iconForTable = (tableName = "") => {
  const normalized = tableName.toLowerCase();
  if (/person|user|role|permission/.test(normalized)) return "user";
  if (/unit|cargo|position|term|relation/.test(normalized)) return "id-card";
  if (/process|task|template|document|signature/.test(normalized)) return "square-check";
  if (/contract|vacanc|offer|aplication/.test(normalized)) return "certificate";
  if (/security|resource|action/.test(normalized)) return "lock";
  return "info-circle";
};

const toggleCategory = (category) => {
  openCategories.value[category] = !openCategories.value[category];
};

const selectTable = (table) => {
  if (!table) {
    return;
  }
  selectedTable.value = table;
  if (activeGroup.value && !openCategories.value[activeGroup.value.label]) {
    openCategories.value[activeGroup.value.label] = true;
  }
};

const onClick = (item) => {
  if (item === "Message") {
    vnotify.value = !vnotify.value;
    return;
  }
  vmenu.value = !vmenu.value;
};

const fetchMeta = async () => {
  loadingMeta.value = true;
  metaError.value = "";
  try {
    const response = await axios.get(API_ROUTES.ADMIN_SQL_META);
    tables.value = response.data?.tables || [];
    if (tables.value.length && !selectedTable.value) {
      selectedTable.value = tables.value[0];
    }
    groupedTables.value.forEach((group) => {
      if (openCategories.value[group.label] === undefined) {
        openCategories.value[group.label] = false;
      }
    });
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
    } catch (error) {
      currentUser.value = null;
    }
  }
  fetchMeta();
});
</script>
