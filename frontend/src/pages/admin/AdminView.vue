<template>
  <div class="admin-page admin-typography">
    <s-header :menu-open="vmenu" @onclick="onClick('Menu')">
      <div class="header-left">
        <button class="nav-link text-white fw-semibold admin-home-link" type="button" @click="goAdminHome">
          Administrador
        </button>
        <router-link to="/dashboard" class="nav-link text-white fw-semibold">
          Dashboard
        </router-link>
        <router-link to="/perfil" class="nav-link text-white fw-semibold">
          Perfil
        </router-link>
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
              @click="onGroupTitleClick(group)"
            >
              <span class="menu-title-left">
                <font-awesome-icon :icon="iconForGroup(group)" class="menu-title-icon" />
                <span>{{ group.label }}</span>
              </span>
            </button>
            <div v-show="openCategories[group.label]" class="menu-section-body">
              <template v-if="isAcademiaGroup(group)">
                <div class="list-group list-group-flush">
                  <button
                    v-for="item in academyMenuItems"
                    :key="item.key"
                    class="list-group-item list-group-item-action"
                    :class="{ active: isAcademyItemActive(item) }"
                    type="button"
                    @click="openAcademyItem(item)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="item.icon" class="menu-item-icon" />
                      <span>{{ item.label }}</span>
                    </span>
                  </button>
                </div>
              </template>
              <template v-else-if="isGestionGroup(group)">
                <div class="list-group list-group-flush">
                  <button
                    v-for="item in gestionMenuItems"
                    :key="item.key"
                    class="list-group-item list-group-item-action"
                    :class="{ active: isGestionItemActive(item) }"
                    type="button"
                    @click="openGestionItem(item)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="item.icon" class="menu-item-icon" />
                      <span>{{ item.label }}</span>
                    </span>
                  </button>
                </div>
              </template>
              <template v-else-if="isUsuariosGroup(group)">
                <div class="list-group list-group-flush">
                  <button
                    v-for="item in usersMenuItems"
                    :key="item.key"
                    class="list-group-item list-group-item-action"
                    :class="{ active: isUsersItemActive(item) }"
                    type="button"
                    @click="openUsersItem(item)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="item.icon" class="menu-item-icon" />
                      <span>{{ item.label }}</span>
                    </span>
                  </button>
                </div>
              </template>
              <template v-else-if="isContratosGroup(group)">
                <div class="list-group list-group-flush">
                  <button
                    v-for="item in contractsMenuItems"
                    :key="item.key"
                    class="list-group-item list-group-item-action"
                    :class="{ active: isContractsItemActive(item) }"
                    type="button"
                    @click="openContractsItem(item)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="item.icon" class="menu-item-icon" />
                      <span>{{ item.label }}</span>
                    </span>
                  </button>
                </div>
              </template>
              <template v-else-if="isSeguridadGroup(group)">
                <div class="list-group list-group-flush">
                  <button
                    v-for="item in securityMenuItems"
                    :key="item.key"
                    class="list-group-item list-group-item-action"
                    :class="{ active: isSecurityItemActive(item) }"
                    type="button"
                    @click="openSecurityItem(item)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="item.icon" class="menu-item-icon" />
                      <span>{{ item.label }}</span>
                    </span>
                  </button>
                </div>
              </template>
              <template v-else>
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
              </template>
            </div>
          </div>
        </div>
      </s-menu>

      <s-body :showmenu="vmenu" :shownotify="vnotify">
        <div v-if="showAcademyCrudIndex" class="admin-home academia-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon :icon="selectedAcademyCrudItem?.icon || 'map-marked-alt'" />
                  </div>
                  <div>
                    <h2 class="mb-1">{{ selectedAcademyCrudItem?.label || "Academia" }}</h2>
                    <p class="mb-0 admin-home-subtitle">
                      {{ selectedAcademyCrudItem?.description || "Gestiona el CRUD de catálogos y relaciones." }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="academyCrudTables.length" class="admin-home-grid">
                <button
                  v-for="table in academyCrudTables"
                  :key="table.table"
                  class="admin-home-btn"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForTable(table.table)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ table.label }}</strong>
                    <span class="admin-home-btn-meta">Gestionar</span>
                  </span>
                  <span :class="['admin-home-btn-pill', adminTagForTable(table).className]">
                    {{ adminTagForTable(table).label }}
                  </span>
                </button>
              </div>
              <p v-else class="text-muted mb-0">No hay tablas disponibles para este subgrupo.</p>
            </div>
          </div>
        </div>

        <div v-else-if="showAcademiaIndex" class="admin-home academia-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon icon="map-marked-alt" />
                  </div>
                  <div>
                    <h2 class="mb-1">Academia</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Accesos principales para administrar Unidades, Periodos y Cargos.
                    </p>
                  </div>
                </div>
              </div>

              <div class="admin-home-grid">
                <button
                  v-for="item in academyMenuItems"
                  :key="item.key"
                  class="admin-home-btn"
                  type="button"
                  @click="openAcademyItem(item)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="item.icon" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ item.label }}</strong>
                    <span class="admin-home-btn-meta">{{ item.tableCount }} tablas</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showGestionCrudIndex" class="admin-home gestiones-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon :icon="selectedGestionCrudItem?.icon || 'check-double'" />
                  </div>
                  <div>
                    <h2 class="mb-1">{{ selectedGestionCrudItem?.label || "Gestiones" }}</h2>
                    <p class="mb-0 admin-home-subtitle">
                      {{ selectedGestionCrudItem?.description || "Gestiona tablas relacionadas al subgrupo." }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="gestionCrudTables.length" class="admin-home-grid">
                <button
                  v-for="table in gestionCrudTables"
                  :key="table.table"
                  class="admin-home-btn"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForTable(table.table)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ table.label }}</strong>
                    <span class="admin-home-btn-meta">Gestionar</span>
                  </span>
                  <span :class="['admin-home-btn-pill', adminTagForTable(table).className]">
                    {{ adminTagForTable(table).label }}
                  </span>
                </button>
              </div>
              <p v-else class="text-muted mb-0">No hay tablas disponibles para este subgrupo.</p>
            </div>
          </div>
        </div>

        <div v-else-if="showGestionesIndex" class="admin-home gestiones-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon icon="check-double" />
                  </div>
                  <div>
                    <h2 class="mb-1">Gestiones</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Accesos por subgrupo para administrar procesos, tareas, plantillas, documentos y firmas.
                    </p>
                  </div>
                </div>
              </div>

              <div class="admin-home-grid">
                <button
                  v-for="item in gestionMenuItems"
                  :key="item.key"
                  class="admin-home-btn"
                  type="button"
                  @click="openGestionItem(item)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="item.icon" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ item.label }}</strong>
                    <span class="admin-home-btn-meta">{{ item.tableCount }} tablas</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showUsersCrudIndex" class="admin-home usuarios-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon :icon="selectedUsersCrudItem?.icon || 'user'" />
                  </div>
                  <div>
                    <h2 class="mb-1">{{ selectedUsersCrudItem?.label || "Usuarios" }}</h2>
                    <p class="mb-0 admin-home-subtitle">
                      {{ selectedUsersCrudItem?.description || "Gestiona tablas relacionadas al subgrupo." }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="usersCrudTables.length" class="admin-home-grid">
                <button
                  v-for="table in usersCrudTables"
                  :key="table.table"
                  class="admin-home-btn"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForTable(table.table)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ table.label }}</strong>
                    <span class="admin-home-btn-meta">Gestionar</span>
                  </span>
                  <span :class="['admin-home-btn-pill', adminTagForTable(table).className]">
                    {{ adminTagForTable(table).label }}
                  </span>
                </button>
              </div>
              <p v-else class="text-muted mb-0">No hay tablas disponibles para este subgrupo.</p>
            </div>
          </div>
        </div>

        <div v-else-if="showUsersIndex" class="admin-home usuarios-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon icon="user" />
                  </div>
                  <div>
                    <h2 class="mb-1">Usuarios</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Accesos por subgrupo para administrar personas del sistema.
                    </p>
                  </div>
                </div>
              </div>

              <div class="admin-home-grid">
                <button
                  v-for="item in usersMenuItems"
                  :key="item.key"
                  class="admin-home-btn"
                  type="button"
                  @click="openUsersItem(item)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="item.icon" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ item.label }}</strong>
                    <span class="admin-home-btn-meta">{{ item.tableCount }} tablas</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showContractsCrudIndex" class="admin-home contratos-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon :icon="selectedContractsCrudItem?.icon || 'certificate'" />
                  </div>
                  <div>
                    <h2 class="mb-1">{{ selectedContractsCrudItem?.label || "Contratos" }}</h2>
                    <p class="mb-0 admin-home-subtitle">
                      {{ selectedContractsCrudItem?.description || "Gestiona tablas relacionadas al subgrupo." }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="contractsCrudTables.length" class="admin-home-grid">
                <button
                  v-for="table in contractsCrudTables"
                  :key="table.table"
                  class="admin-home-btn"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForTable(table.table)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ table.label }}</strong>
                    <span class="admin-home-btn-meta">Gestionar</span>
                  </span>
                  <span :class="['admin-home-btn-pill', adminTagForTable(table).className]">
                    {{ adminTagForTable(table).label }}
                  </span>
                </button>
              </div>
              <p v-else class="text-muted mb-0">No hay tablas disponibles para este subgrupo.</p>
            </div>
          </div>
        </div>

        <div v-else-if="showContractsIndex" class="admin-home contratos-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon icon="certificate" />
                  </div>
                  <div>
                    <h2 class="mb-1">Contratos</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Accesos por subgrupo para administrar vacantes, contratos y orígenes.
                    </p>
                  </div>
                </div>
              </div>

              <div class="admin-home-grid">
                <button
                  v-for="item in contractsMenuItems"
                  :key="item.key"
                  class="admin-home-btn"
                  type="button"
                  @click="openContractsItem(item)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="item.icon" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ item.label }}</strong>
                    <span class="admin-home-btn-meta">{{ item.tableCount }} tablas</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showSecurityCrudIndex" class="admin-home seguridad-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon :icon="selectedSecurityCrudItem?.icon || 'lock'" />
                  </div>
                  <div>
                    <h2 class="mb-1">{{ selectedSecurityCrudItem?.label || "Seguridad" }}</h2>
                    <p class="mb-0 admin-home-subtitle">
                      {{ selectedSecurityCrudItem?.description || "Gestiona tablas relacionadas al subgrupo." }}
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="securityCrudTables.length" class="admin-home-grid">
                <button
                  v-for="table in securityCrudTables"
                  :key="table.table"
                  class="admin-home-btn"
                  type="button"
                  @click="selectTable(table)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForTable(table.table)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ table.label }}</strong>
                    <span class="admin-home-btn-meta">Gestionar</span>
                  </span>
                  <span :class="['admin-home-btn-pill', adminTagForTable(table).className]">
                    {{ adminTagForTable(table).label }}
                  </span>
                </button>
              </div>
              <p v-else class="text-muted mb-0">No hay tablas disponibles para este subgrupo.</p>
            </div>
          </div>
        </div>

        <div v-else-if="showSecurityIndex" class="admin-home seguridad-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon icon="lock" />
                  </div>
                  <div>
                    <h2 class="mb-1">Seguridad</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Accesos por subgrupo para administrar roles y permisos.
                    </p>
                  </div>
                </div>
              </div>

              <div class="admin-home-grid">
                <button
                  v-for="item in securityMenuItems"
                  :key="item.key"
                  class="admin-home-btn"
                  type="button"
                  @click="openSecurityItem(item)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="item.icon" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ item.label }}</strong>
                    <span class="admin-home-btn-meta">{{ item.tableCount }} tablas</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="showGroupCrudIndex" class="admin-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon :icon="iconForGroup(selectedGroup)" />
                  </div>
                  <div>
                    <h2 class="mb-1">{{ selectedGroup?.label || "Administración" }}</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Gestiona el CRUD de las tablas del grupo.
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="selectedGroupCrudTables.length" class="admin-home-grid">
                <button
                  v-for="item in selectedGroupCrudTables"
                  :key="item.table"
                  class="admin-home-btn"
                  type="button"
                  @click="selectTable(item)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForTable(item.table)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ item.label }}</strong>
                    <span class="admin-home-btn-meta">{{ item.bucket }}</span>
                  </span>
                  <span :class="['admin-home-btn-pill', adminTagForTable(item).className]">
                    {{ adminTagForTable(item).label }}
                  </span>
                </button>
              </div>
              <p v-else class="text-muted mb-0">No hay tablas disponibles en este grupo.</p>
            </div>
          </div>
        </div>

        <div v-else-if="!selectedTable" class="admin-home container-fluid py-4">
          <div class="card admin-home-card">
            <div class="card-body">
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="admin-home-avatar" aria-hidden="true">
                    <font-awesome-icon icon="lock" />
                  </div>
                  <div>
                    <h2 class="mb-1">Panel de administración</h2>
                    <p class="mb-0 admin-home-subtitle">
                      Accesos organizados para crear, editar, leer y eliminar datos del sistema.
                    </p>
                  </div>
                </div>
              </div>

              <div v-if="loadingMeta" class="text-muted">Cargando catálogos...</div>
              <div v-else-if="metaError" class="text-danger">{{ metaError }}</div>
              <div v-else class="admin-home-grid">
                <button
                  v-for="group in homeGroups"
                  :key="group.key"
                  class="admin-home-btn"
                  type="button"
                  @click="openGroupFromHome(group)"
                >
                  <span class="admin-home-btn-icon">
                    <font-awesome-icon :icon="iconForGroup(group)" />
                  </span>
                  <span class="admin-home-btn-content">
                    <strong class="admin-home-btn-title">{{ group.label }}</strong>
                    <span class="admin-home-btn-meta">{{ tablesCountForGroup(group) }} tablas</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <AdminTableManager
          v-else
          ref="adminManager"
          :table="selectedTable"
          :all-tables="tables"
          @go-back="handleManagerGoBack"
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
const selectedSection = ref("");
const selectedAcademyItem = ref("");
const selectedGestionItem = ref("");
const selectedUsuarioItem = ref("");
const selectedContratoItem = ref("");
const selectedSeguridadItem = ref("");
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
    main: ["unit_types", "units", "relation_unit_types", "unit_relations", "cargos", "unit_positions", "position_assignments", "term_types", "terms"],
    support: []
  },
  {
    key: "procesos",
    label: "Gestiones",
    main: [
      "processes",
      "process_definition_versions",
      "process_target_rules",
      "tasks",
      "task_assignments",
      "template_artifacts",
      "process_definition_templates",
      "documents",
      "document_versions"
    ],
    support: ["signature_flow_templates", "signature_flow_steps", "signature_flow_instances", "signature_requests", "document_signatures", "signature_types", "signature_statuses", "signature_request_statuses"]
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
    main: ["vacancies", "vacancy_visibility", "aplications", "offers", "contracts"],
    support: ["contract_origins", "contract_origin_recruitment", "contract_origin_renewal"]
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
      "role_permissions",
      "actions",
      "resources"
    ],
    support: []
  },
];

const ACADEMY_GROUP_KEY = "estructura_academico";
const ACADEMY_GROUP_LABEL = "Academia";
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
const GESTION_GROUP_LABEL = "Gestiones";
const GESTION_INDEX_ITEMS = [
  {
    key: "procesos",
    label: "Procesos",
    icon: "check-double",
    description: "Gestiona procesos base, definiciones y reglas de alcance.",
    tables: ["processes", "process_definition_versions", "process_target_rules"]
  },
  {
    key: "plantillas",
    label: "Plantillas",
    icon: "certificate",
    description: "Gestiona artifacts publicados y plantillas de definicion.",
    tables: ["template_artifacts", "process_definition_templates"]
  },
  {
    key: "tareas",
    label: "Tareas",
    icon: "square-check",
    description: "Administra tareas y asignaciones de tareas.",
    tables: ["tasks", "task_assignments"]
  },
  {
    key: "documentos",
    label: "Documentos",
    icon: "info-circle",
    description: "Administra documentos y versiones de documentos.",
    tables: ["documents", "document_versions"]
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
const USERS_GROUP_KEY = "usuarios";
const USERS_GROUP_LABEL = "Usuarios";
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
const CONTRACT_GROUP_LABEL = "Contratos";
const CONTRACT_INDEX_ITEMS = [
  {
    key: "vacantes",
    label: "Vacantes",
    icon: "id-card",
    description: "Gestiona vacantes, postulaciones y ofertas.",
    tables: ["vacancies", "vacancy_visibility", "aplications", "offers"]
  },
  {
    key: "contratos",
    label: "Contratos",
    icon: "certificate",
    description: "Gestiona contratos del sistema.",
    tables: ["contracts"]
  },
  {
    key: "origenes",
    label: "Origenes",
    icon: "check-double",
    description: "Gestiona catálogos y relaciones de origen contractual.",
    tables: ["contract_origins", "contract_origin_recruitment", "contract_origin_renewal"]
  }
];
const SECURITY_GROUP_KEY = "seguridad";
const SECURITY_GROUP_LABEL = "Seguridad";
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
    description: "Gestiona permisos, recursos y acciones.",
    tables: ["permissions", "role_permissions", "actions", "resources"]
  }
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

const homeGroups = computed(() =>
  groupedTables.value.filter((group) => (group.mainTables.length + group.supportTables.length) > 0)
);

const academyMenuItems = computed(() =>
  ACADEMY_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const gestionMenuItems = computed(() =>
  GESTION_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const usersMenuItems = computed(() =>
  USERS_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const contractsMenuItems = computed(() =>
  CONTRACT_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);
const securityMenuItems = computed(() =>
  SECURITY_INDEX_ITEMS.map((item) => {
    const availableTables = item.tables.map((tableName) => tableMap.value[tableName]).filter(Boolean);
    return {
      ...item,
      availableTables,
      tableCount: availableTables.length
    };
  })
);

const showAcademiaIndex = computed(
  () => selectedSection.value === ACADEMY_GROUP_KEY
    && !selectedAcademyItem.value
    && !selectedTable.value
);
const showAcademyCrudIndex = computed(
  () => selectedSection.value === ACADEMY_GROUP_KEY
    && Boolean(selectedAcademyItem.value)
    && !selectedTable.value
);
const selectedAcademyCrudItem = computed(() =>
  academyMenuItems.value.find((item) => item.key === selectedAcademyItem.value) || null
);
const academyCrudTables = computed(() =>
  selectedAcademyCrudItem.value?.availableTables || []
);
const showGestionesIndex = computed(
  () => selectedSection.value === GESTION_GROUP_KEY
    && !selectedGestionItem.value
    && !selectedTable.value
);
const showGestionCrudIndex = computed(
  () => selectedSection.value === GESTION_GROUP_KEY
    && Boolean(selectedGestionItem.value)
    && !selectedTable.value
);
const selectedGestionCrudItem = computed(() =>
  gestionMenuItems.value.find((item) => item.key === selectedGestionItem.value) || null
);
const gestionCrudTables = computed(() =>
  selectedGestionCrudItem.value?.availableTables || []
);
const showUsersIndex = computed(
  () => selectedSection.value === USERS_GROUP_KEY
    && !selectedUsuarioItem.value
    && !selectedTable.value
);
const showUsersCrudIndex = computed(
  () => selectedSection.value === USERS_GROUP_KEY
    && Boolean(selectedUsuarioItem.value)
    && !selectedTable.value
);
const selectedUsersCrudItem = computed(() =>
  usersMenuItems.value.find((item) => item.key === selectedUsuarioItem.value) || null
);
const usersCrudTables = computed(() =>
  selectedUsersCrudItem.value?.availableTables || []
);
const showContractsIndex = computed(
  () => selectedSection.value === CONTRACT_GROUP_KEY
    && !selectedContratoItem.value
    && !selectedTable.value
);
const showContractsCrudIndex = computed(
  () => selectedSection.value === CONTRACT_GROUP_KEY
    && Boolean(selectedContratoItem.value)
    && !selectedTable.value
);
const selectedContractsCrudItem = computed(() =>
  contractsMenuItems.value.find((item) => item.key === selectedContratoItem.value) || null
);
const contractsCrudTables = computed(() =>
  selectedContractsCrudItem.value?.availableTables || []
);
const showSecurityIndex = computed(
  () => selectedSection.value === SECURITY_GROUP_KEY
    && !selectedSeguridadItem.value
    && !selectedTable.value
);
const showSecurityCrudIndex = computed(
  () => selectedSection.value === SECURITY_GROUP_KEY
    && Boolean(selectedSeguridadItem.value)
    && !selectedTable.value
);
const selectedSecurityCrudItem = computed(() =>
  securityMenuItems.value.find((item) => item.key === selectedSeguridadItem.value) || null
);
const securityCrudTables = computed(() =>
  selectedSecurityCrudItem.value?.availableTables || []
);
const selectedGroup = computed(() =>
  groupedTables.value.find((group) => group.key === selectedSection.value) || null
);
const showGroupCrudIndex = computed(
  () => Boolean(selectedGroup.value)
    && selectedGroup.value.key !== ACADEMY_GROUP_KEY
    && selectedGroup.value.key !== GESTION_GROUP_KEY
    && selectedGroup.value.key !== USERS_GROUP_KEY
    && selectedGroup.value.key !== CONTRACT_GROUP_KEY
    && selectedGroup.value.key !== SECURITY_GROUP_KEY
    && !selectedTable.value
);
const selectedGroupCrudTables = computed(() => {
  if (!selectedGroup.value) {
    return [];
  }
  const mainTables = selectedGroup.value.mainTables.map((table) => ({ ...table, bucket: "Principal" }));
  const supportTables = selectedGroup.value.supportTables.map((table) => ({ ...table, bucket: "Soporte" }));
  return [...mainTables, ...supportTables];
});

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

const adminTagForTable = (table) => {
  const tableName = String(table?.table || "").toLowerCase();
  if (!tableName) {
    return { label: "Base", className: "is-success" };
  }
  if (/artifact|signature_type|signature_status|request_status|resource|action/.test(tableName)) {
    return { label: "Soporte", className: "is-danger" };
  }
  if (/version|assignment|template|map|relation|origin/.test(tableName)) {
    return { label: "Relacion", className: "is-warning" };
  }
  return { label: "Base", className: "is-success" };
};

const tablesCountForGroup = (group) => (group?.mainTables?.length ?? 0) + (group?.supportTables?.length ?? 0);

const isAcademiaGroup = (group) => group?.key === ACADEMY_GROUP_KEY;
const isGestionGroup = (group) => group?.key === GESTION_GROUP_KEY;
const isUsuariosGroup = (group) => group?.key === USERS_GROUP_KEY;
const isContratosGroup = (group) => group?.key === CONTRACT_GROUP_KEY;
const isSeguridadGroup = (group) => group?.key === SECURITY_GROUP_KEY;

const resolveAcademyItemByTable = (tableName) =>
  ACADEMY_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveGestionItemByTable = (tableName) =>
  GESTION_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveUsersItemByTable = (tableName) =>
  USERS_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveContractsItemByTable = (tableName) =>
  CONTRACT_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";
const resolveSecurityItemByTable = (tableName) =>
  SECURITY_INDEX_ITEMS.find((item) => item.tables.includes(tableName))?.key || "";

const isAcademyItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedAcademyItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isGestionItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedGestionItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isUsersItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedUsuarioItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isContractsItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedContratoItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};
const isSecurityItemActive = (item) => {
  if (!item) {
    return false;
  }
  if (selectedSeguridadItem.value === item.key) {
    return true;
  }
  return item.tables.includes(selectedTable.value?.table || "");
};

const openGroupIndex = (group) => {
  if (!group) {
    return;
  }
  if (group.key === ACADEMY_GROUP_KEY) {
    openAcademyIndex();
    return;
  }
  if (group.key === GESTION_GROUP_KEY) {
    openGestionIndex();
    return;
  }
  if (group.key === USERS_GROUP_KEY) {
    openUsersIndex();
    return;
  }
  if (group.key === CONTRACT_GROUP_KEY) {
    openContractsIndex();
    return;
  }
  if (group.key === SECURITY_GROUP_KEY) {
    openSecurityIndex();
    return;
  }
  selectedSection.value = group.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[group.label] = true;
};

const onGroupTitleClick = (group) => {
  if (!group) {
    return;
  }
  const isOpen = Boolean(openCategories.value[group.label]);
  openCategories.value[group.label] = !isOpen;
  if (!isOpen) {
    openGroupIndex(group);
  }
};

const selectTable = (table) => {
  if (!table) {
    return;
  }
  selectedTable.value = table;
  const group = groupedTables.value.find((candidate) =>
    [...candidate.mainTables, ...candidate.supportTables].some((item) => item.table === table.table)
  );
  const academyItemKey = resolveAcademyItemByTable(table.table);
  const gestionItemKey = resolveGestionItemByTable(table.table);
  const usersItemKey = resolveUsersItemByTable(table.table);
  const contractsItemKey = resolveContractsItemByTable(table.table);
  const securityItemKey = resolveSecurityItemByTable(table.table);
  if (academyItemKey) {
    selectedSection.value = ACADEMY_GROUP_KEY;
    selectedAcademyItem.value = academyItemKey;
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (gestionItemKey) {
    selectedSection.value = GESTION_GROUP_KEY;
    selectedGestionItem.value = gestionItemKey;
    selectedAcademyItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (usersItemKey) {
    selectedSection.value = USERS_GROUP_KEY;
    selectedUsuarioItem.value = usersItemKey;
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (contractsItemKey) {
    selectedSection.value = CONTRACT_GROUP_KEY;
    selectedContratoItem.value = contractsItemKey;
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedSeguridadItem.value = "";
  } else if (securityItemKey) {
    selectedSection.value = SECURITY_GROUP_KEY;
    selectedSeguridadItem.value = securityItemKey;
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
  } else {
    selectedSection.value = group?.key || "";
    selectedAcademyItem.value = "";
    selectedGestionItem.value = "";
    selectedUsuarioItem.value = "";
    selectedContratoItem.value = "";
    selectedSeguridadItem.value = "";
  }
  if (group && !openCategories.value[group.label]) {
    openCategories.value[group.label] = true;
  }
};

const openAcademyIndex = () => {
  selectedSection.value = ACADEMY_GROUP_KEY;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[ACADEMY_GROUP_LABEL] = true;
};

const openAcademyItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = ACADEMY_GROUP_KEY;
  selectedAcademyItem.value = item.key;
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[ACADEMY_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openGestionIndex = () => {
  selectedSection.value = GESTION_GROUP_KEY;
  selectedGestionItem.value = "";
  selectedAcademyItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[GESTION_GROUP_LABEL] = true;
};
const openGestionItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = GESTION_GROUP_KEY;
  selectedGestionItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[GESTION_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openUsersIndex = () => {
  selectedSection.value = USERS_GROUP_KEY;
  selectedUsuarioItem.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[USERS_GROUP_LABEL] = true;
};
const openUsersItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = USERS_GROUP_KEY;
  selectedUsuarioItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[USERS_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openContractsIndex = () => {
  selectedSection.value = CONTRACT_GROUP_KEY;
  selectedContratoItem.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedSeguridadItem.value = "";
  selectedTable.value = null;
  openCategories.value[CONTRACT_GROUP_LABEL] = true;
};
const openContractsItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = CONTRACT_GROUP_KEY;
  selectedContratoItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedSeguridadItem.value = "";
  openCategories.value[CONTRACT_GROUP_LABEL] = true;
  selectedTable.value = null;
};
const openSecurityIndex = () => {
  selectedSection.value = SECURITY_GROUP_KEY;
  selectedSeguridadItem.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedTable.value = null;
  openCategories.value[SECURITY_GROUP_LABEL] = true;
};
const openSecurityItem = (item) => {
  if (!item) {
    return;
  }
  selectedSection.value = SECURITY_GROUP_KEY;
  selectedSeguridadItem.value = item.key;
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  openCategories.value[SECURITY_GROUP_LABEL] = true;
  selectedTable.value = null;
};

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
  selectedTable.value = null;
  if (!selectedSection.value) {
    goAdminHome();
  }
};

const goAdminHome = () => {
  selectedTable.value = null;
  selectedSection.value = "";
  selectedAcademyItem.value = "";
  selectedGestionItem.value = "";
  selectedUsuarioItem.value = "";
  selectedContratoItem.value = "";
  selectedSeguridadItem.value = "";
  Object.keys(openCategories.value).forEach((key) => {
    openCategories.value[key] = false;
  });
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

<style scoped>
.admin-home-card {
  border: 0;
  border-radius: var(--radius-lg);
}

.admin-home-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-puce-light-rgb), 0.12);
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.2);
  color: var(--color-puce-light);
  font-size: 1.65rem;
  flex: 0 0 auto;
}

.admin-home-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}

.admin-home-subtitle {
  color: var(--brand-ink);
  opacity: 0.9;
  font-size: 1rem;
  line-height: 1.45;
}

.admin-home-btn {
  border: 1px solid rgba(var(--brand-primary-rgb), 0.15);
  border-radius: 12px;
  background: #fff;
  padding: 1.45rem 1.5rem;
  text-align: left;
  display: grid;
  grid-template-columns: 3.35rem minmax(0, 1fr);
  column-gap: 1rem;
  row-gap: 0.95rem;
  align-items: start;
  color: var(--brand-navy);
  font-size: 0.95rem;
  min-height: 188px;
  box-shadow: var(--brand-shadow-soft);
}

.admin-home-btn-icon {
  width: 3.35rem;
  height: 3.35rem;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--color-puce-light-rgb), 0.1);
  border: 1px solid rgba(var(--color-puce-light-rgb), 0.2);
  color: var(--color-puce-light);
  flex: 0 0 auto;
  font-size: 1.28rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.admin-home-btn-content {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  min-width: 0;
  width: 100%;
  align-self: start;
}

.admin-home-btn-title {
  font-size: 1.08rem;
  line-height: 1.28;
  color: var(--brand-navy);
}

.admin-home-btn-pill {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  grid-column: 1 / -1;
  width: 100%;
  padding: 0.6rem 0.85rem;
  border-radius: 12px;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.1;
  white-space: nowrap;
  margin-top: auto;
}

.admin-home-btn-pill.is-success {
  background: rgba(40, 167, 69, 0.14);
  color: #1d7b35;
}

.admin-home-btn-pill.is-warning {
  background: rgba(253, 126, 20, 0.16);
  color: #b85e11;
}

.admin-home-btn-pill.is-danger {
  background: rgba(220, 53, 69, 0.14);
  color: #b32638;
}

.admin-home-btn-meta {
  font-size: 0.84rem;
  opacity: 0.88;
  line-height: 1.35;
}

.admin-home-btn:hover {
  border-color: rgba(var(--brand-primary-rgb), 0.3);
  color: var(--brand-navy);
  background: linear-gradient(
    90deg,
    rgba(var(--brand-primary-rgb), 0.18) 0%,
    var(--color-puce-soft) 100%
  );
  box-shadow: 0 16px 28px rgba(var(--brand-primary-rgb), 0.1);
}

.admin-home-btn:hover .admin-home-btn-title,
.admin-home-btn:hover .admin-home-btn-meta {
  color: var(--brand-navy);
}

.admin-home-btn:hover .admin-home-btn-icon {
  background: rgba(var(--brand-primary-rgb), 0.16);
  border-color: rgba(var(--brand-primary-rgb), 0.28);
  color: var(--brand-primary);
}

.admin-home-link {
  border: 0;
  background: transparent;
  padding: 0;
}

@media (max-width: 991px) {
  .admin-home-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 575px) {
  .admin-home-grid {
    grid-template-columns: 1fr;
  }
}
</style>
