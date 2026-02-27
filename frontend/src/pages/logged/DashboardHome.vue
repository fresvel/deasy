<template>
  <div class="dashboard-page dashboard-typography">
    <s-header :menu-open="showMenu" @onclick="handleHeaderToggle">
      <div class="header-left">
        <button class="nav-link text-white p-0" type="button" @click="handleUserIconClick" title="Ir al perfil">
          <img class="avatar" :src="userPhoto" alt="Perfil" />
        </button>

        <div v-if="unitGroups.length" class="group-menu">
          <div
            class="group-item"
            :class="{ active: selectedGroupId === null }"
            role="button"
            tabindex="0"
            @click="selectConsolidated"
            @keydown.enter="selectConsolidated"
          >
            <span class="group-icon">
              <font-awesome-icon icon="globe" />
            </span>
            <div class="group-content">
              <div class="group-title">Consolidado</div>
            </div>
          </div>

          <div
            v-for="group in unitGroups"
            :key="group.id"
            class="group-item"
            :class="{ active: group.id === selectedGroupId }"
            role="button"
            tabindex="0"
            @click="selectGroup(group)"
            @keydown.enter="selectGroup(group)"
          >
            <span class="group-icon">
              <font-awesome-icon :icon="iconForUnitGroup(group)" />
            </span>
            <div class="group-content">
              <div class="group-title" :title="group.name">
                {{ group.label || group.name }}
              </div>
            </div>
          </div>
        </div>
        <span v-if="!userUnits.length && !menuLoading" class="nav-link text-white-50">
          Sin unidades
        </span>
      </div>

      <div class="header-right">
        <router-link to="/logout" class="nav-link text-white p-0 ms-lg-3" title="Cerrar sesión">
          <img class="avatar" src="/images/logout.svg" alt="Cerrar sesión" />
        </router-link>

        <button class="nav-link text-white p-0" type="button" @click="navigateTo('firmar')" title="Firmar documentos">
          <img class="avatar" src="/images/pen_line.svg" alt="Firmar" />
        </button>

        <button class="nav-link text-white p-0" type="button" @click="toggleNotify" title="Notificaciones">
          <font-awesome-icon icon="bell" class="avatar" />
        </button>
      </div>
    </s-header>

    <div class="row g-3">
      <s-menu :show="showMenu">
        <div class="admin-menu">
          <UserProfile :photo="userPhoto" :username="userFullName" />
          <div class="menu-context text-white">
            {{ menuContextLabel }}
          </div>

          <div v-if="menuLoading" class="menu-feedback text-white">
            Cargando menú...
          </div>
          <div v-else-if="menuError" class="menu-feedback text-white">
            {{ menuError }}
          </div>
          <div v-else-if="!menuCargos.length" class="menu-feedback text-white">
            No hay cargos asignados para mostrar.
          </div>

          <div v-else>
            <div v-for="cargo in menuCargos" :key="cargo.id" class="menu-section">
              <button
                class="menu-section-title text-white w-100"
                type="button"
                :class="{ 'is-open': cargo.open }"
                @click="toggleCargo(cargo)"
              >
                <span class="menu-title-left">
                  <font-awesome-icon :icon="iconForCargo(cargo.name)" class="menu-title-icon" />
                  <span>{{ cargo.name }}</span>
                </span>
              </button>

              <div v-show="cargo.open" class="menu-section-body">
                <div class="list-group list-group-flush">
                  <button
                    v-for="process in cargo.processes"
                    :key="process.id"
                    class="list-group-item list-group-item-action"
                    type="button"
                    @click="handleProcessSelect(process, cargo)"
                  >
                    <span class="menu-item-content">
                      <font-awesome-icon :icon="iconForProcess(process.name)" class="menu-item-icon" />
                      <span>{{ process.name }}</span>
                    </span>
                  </button>
                  <div v-if="!cargo.processes.length" class="menu-empty">
                    Sin procesos asignados.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </s-menu>

      <s-body :showmenu="showMenu" :shownotify="showNotify">
        <section class="overview-card">
          <div>
            <h1>Bienvenido(a), {{ userFullName }}</h1>
            <p>
              Este es tu panel general. Revisa el estado de tus módulos, firmas pendientes y completa tu perfil académico.
            </p>
          </div>
          <button class="primary-btn" @click="navigateTo('perfil')">
            Ir a mi perfil
          </button>
        </section>

        <section class="summary-grid">
          <article class="summary-card" v-for="card in summaryCards" :key="card.title">
            <header>
              <h3>{{ card.title }}</h3>
              <span :class="['status-pill', card.statusClass]">{{ card.status }}</span>
            </header>
            <p>{{ card.description }}</p>
            <footer>
              <span class="summary-count">{{ card.count }}</span>
              <button class="link-btn" @click="navigateTo(card.route)">
                {{ card.action }} →
              </button>
            </footer>
          </article>
        </section>

        <section class="table-card">
          <header>
            <h2>Resumen rápido</h2>
            <button class="secondary-btn" @click="navigateTo('perfil')">
              Gestionar perfil
            </button>
          </header>

          <table class="table table-institutional table-striped table-hover align-middle">
            <thead>
              <tr>
                <th>Sección</th>
                <th>Registros</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in summaryRows" :key="row.section">
                <td>{{ row.section }}</td>
                <td>{{ row.count }}</td>
                <td>
                  <span :class="['status-pill', row.statusClass]">{{ row.status }}</span>
                </td>
                <td>
                  <button class="tiny-btn" @click="navigateTo(row.route)">
                    Gestionar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </s-body>

      <s-message :show="showNotify" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SHeader from '@/layouts/SHeader.vue';
import SMenu from '@/layouts/SMenu.vue';
import SBody from '@/layouts/SBody.vue';
import SMessage from '@/layouts/SNotify.vue';
import UserProfile from '@/components/UserProfile.vue';
import UserMenuService from '@/services/logged/UserMenuService.js';
import { API_ROUTES } from '@/services/apiConfig';

const router = useRouter();
const menuService = new UserMenuService();

const currentUser = ref(null);
const userPhoto = ref('/images/avatar.png');

const showMenu = ref(true);
const showNotify = ref(false);

const menuLoading = ref(false);
const menuError = ref('');
const userUnits = ref([]);
const unitGroups = ref([]);
const consolidatedCargos = ref([]);
const menuCargos = ref([]);
const selectedGroupId = ref(null);

const userFullName = computed(() => {
  if (!currentUser.value) return 'Usuario';
  const firstName = currentUser.value.first_name ?? '';
  const lastName = currentUser.value.last_name ?? '';
  return `${firstName} ${lastName}`.trim() || 'Usuario';
});

const menuContextLabel = computed(() => {
  if (selectedGroupId.value) {
    const group = unitGroups.value.find((item) => item.id === selectedGroupId.value);
    return group ? `Área: ${group.label || group.name}` : 'Área seleccionada';
  }
  return 'Cargos consolidados';
});

const quickStats = ref([
  { label: 'Formación', count: 0, route: 'perfil' },
  { label: 'Experiencia', count: 0, route: 'perfil' },
  { label: 'Referencias', count: 0, route: 'perfil' },
  { label: 'Capacitación', count: 0, route: 'perfil' },
  { label: 'Certificación', count: 0, route: 'perfil' }
]);

const summaryCards = ref([
  {
    title: 'Perfil profesional',
    description: 'Completa la información de formación y experiencia para habilitar todos los módulos.',
    status: 'En progreso',
    statusClass: 'status--warning',
    count: '60%',
    action: 'Completar perfil',
    route: 'perfil'
  },
  {
    title: 'Documentos por firmar',
    description: 'Tienes documentos pendientes en la bandeja de firmas electrónicas.',
    status: 'Pendiente',
    statusClass: 'status--danger',
    count: quickStats.value[0].count,
    action: 'Ir a firmas',
    route: 'firmar'
  },
  {
    title: 'Tutorías y seguimiento',
    description: 'Consulta tutorías, reuniones y actividades asignadas.',
    status: 'Al día',
    statusClass: 'status--success',
    count: 0,
    action: 'Ver tutorías',
    route: 'perfil'
  }
]);

const summaryRows = ref([
  { section: 'Formación', count: 0, status: 'Incompleto', statusClass: 'status--warning', route: 'perfil' },
  { section: 'Experiencia', count: 0, status: 'Pendiente', statusClass: 'status--danger', route: 'perfil' },
  { section: 'Firmas electrónicas', count: 0, status: 'Acción requerida', statusClass: 'status--warning', route: 'firmar' }
]);

const resolvePhotoUrl = (value) => {
  if (!value) {
    return '/images/avatar.png';
  }
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const sanitized = value.replace(/^\/+/, '');
  return `${API_ROUTES.BASE.replace(/\/$/, '')}/${sanitized}`;
};

const applyMenuCargos = (cargos) => {
  menuCargos.value = (cargos ?? []).map((cargo, index) => ({
    ...cargo,
    open: index === 0
  }));
};

const selectConsolidated = () => {
  selectedGroupId.value = null;
  applyMenuCargos(consolidatedCargos.value);
};

const buildGroupCargos = (group) => {
  const cargoMap = new Map();
  (group?.units ?? []).forEach((unit) => {
    (unit.cargos ?? []).forEach((cargo) => {
      if (!cargoMap.has(cargo.id)) {
        cargoMap.set(cargo.id, { id: cargo.id, name: cargo.name, processes: [] });
      }
      const target = cargoMap.get(cargo.id);
      const seen = new Set(target.processes.map((proc) => proc.id));
      (cargo.processes ?? []).forEach((process) => {
        if (!seen.has(process.id)) {
          target.processes.push(process);
          seen.add(process.id);
        }
      });
    });
  });
  const cargos = Array.from(cargoMap.values());
  cargos.forEach((cargo) => {
    cargo.processes.sort((a, b) => a.name.localeCompare(b.name));
  });
  cargos.sort((a, b) => a.name.localeCompare(b.name));
  return cargos;
};

const selectGroup = (group) => {
  selectedGroupId.value = group?.id ?? null;
  applyMenuCargos(buildGroupCargos(group));
  if (!showMenu.value) {
    showMenu.value = true;
  }
};

const toggleCargo = (cargo) => {
  cargo.open = !cargo.open;
};

const iconForCargo = (name = '') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('docen')) return 'certificate';
  if (normalized.includes('coord')) return 'id-card';
  if (normalized.includes('admin')) return 'lock';
  return 'id-card';
};

const iconForProcess = (name = '') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('firma')) return 'check-circle';
  if (normalized.includes('perfil')) return 'user';
  if (normalized.includes('academ')) return 'certificate';
  if (normalized.includes('unidad')) return 'globe';
  return 'square-check';
};

const iconForUnitGroup = (group) => {
  const label = `${group?.label ?? ''} ${group?.name ?? ''}`.toLowerCase();
  if (label.includes('univers')) return 'globe';
  if (label.includes('facult')) return 'map-marked-alt';
  if (label.includes('carrera')) return 'certificate';
  if (label.includes('depart')) return 'id-card';
  return 'id-card';
};

const handleProcessSelect = () => {};

const loadUserMenu = async () => {
  const userId = currentUser.value?.id ?? currentUser.value?._id;
  if (!userId) {
    return;
  }
  menuLoading.value = true;
  menuError.value = '';

  try {
    const data = await menuService.getUserMenu(userId);
    userUnits.value = Array.isArray(data?.units) ? data.units : [];
    unitGroups.value = Array.isArray(data?.unit_groups) ? data.unit_groups : [];
    consolidatedCargos.value = Array.isArray(data?.consolidated) ? data.consolidated : [];

    if (!unitGroups.value.length && userUnits.value.length) {
      unitGroups.value = [
        {
          id: 'units',
          name: 'Unidades',
          label: 'Unidades',
          units: userUnits.value
        }
      ];
    }

    if (consolidatedCargos.value.length) {
      selectConsolidated();
    } else if (unitGroups.value.length) {
      selectGroup(unitGroups.value[0]);
    } else {
      applyMenuCargos([]);
      selectedGroupId.value = null;
    }
  } catch (error) {
    console.error('Error al cargar el menú del usuario:', error);
    menuError.value = 'No se pudo cargar el menú del usuario.';
  } finally {
    menuLoading.value = false;
  }
};

onMounted(async () => {
  const userDataString = localStorage.getItem('user');
  if (userDataString) {
    try {
      currentUser.value = JSON.parse(userDataString);
      userPhoto.value = resolvePhotoUrl(currentUser.value?.photoUrl);
    } catch (error) {
      console.error('Error al cargar datos del usuario:', error);
    }
  }
  await loadUserMenu();
});

const navigateTo = (destination) => {
  switch (destination) {
    case 'dashboard':
      router.push('/dashboard');
      break;
    case 'firmar':
      router.push('/firmar');
      break;
    case 'perfil':
    default:
      router.push('/perfil');
      break;
  }
};

const handleHeaderToggle = (target) => {
  if (target === 'User') {
    navigateTo('dashboard');
    selectConsolidated();
    showMenu.value = !showMenu.value;
  }
};

const handleUserIconClick = () => {
  showMenu.value = !showMenu.value;
  navigateTo('perfil');
};

const toggleNotify = () => {
  showNotify.value = !showNotify.value;
};
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: #f1f5fb;
}

.header-left {
  min-width: 0;
}

.group-menu {
  display: flex;
  align-items: stretch;
  gap: 0.52rem;
  overflow-x: auto;
  padding: 0.12rem 0.2rem;
  scrollbar-width: thin;
}

.group-menu::-webkit-scrollbar {
  height: 6px;
}

.group-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 999px;
}

.group-item {
  display: inline-flex;
  align-items: center;
  gap: 0.58rem;
  min-width: 198px;
  padding: 0.46rem 0.72rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  color: rgba(255, 255, 255, 0.94);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
}

.group-item:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.2);
}

.group-item.active {
  background: rgba(255, 255, 255, 0.96);
  color: var(--brand-primary);
  box-shadow: 0 10px 20px rgba(var(--brand-primary-rgb), 0.26);
}

.group-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.18);
  border: none;
  font-size: 1rem;
  flex: 0 0 auto;
}

.group-item.active .group-icon {
  background: rgba(var(--color-puce-light-rgb), 0.12);
}

.group-content {
  min-width: 0;
  display: block;
}

.group-title {
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.2;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
}

.overview-card {
  background: var(--brand-gradient);
  color: var(--brand-white);
  border-radius: 22px;
  padding: 2rem;
  margin-bottom: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  box-shadow: var(--brand-shadow-strong);
}

.overview-card h1 {
  font-size: 1.9rem;
  margin-bottom: 0.5rem;
}

.overview-card p {
  max-width: 540px;
  font-size: 1rem;
  opacity: 0.9;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: var(--brand-white);
  padding: 1.5rem;
  border-radius: 18px;
  box-shadow: var(--brand-shadow);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 170px;
}

.summary-card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-card footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-count {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--brand-navy);
}

.table-card {
  background: var(--brand-white);
  border-radius: 18px;
  padding: 1.75rem;
  box-shadow: var(--brand-shadow);
}

.table-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.status-pill {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
}

.status--warning {
  background: var(--state-warning);
}

.status--danger {
  background: var(--state-danger);
}

.status--success {
  background: var(--state-success);
}

.primary-btn {
  background: var(--brand-gradient);
  color: var(--brand-white);
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(var(--brand-primary-rgb), 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(var(--brand-primary-rgb), 0.28);
}

.secondary-btn {
  background: rgba(var(--brand-primary-rgb), 0.08);
  color: var(--brand-navy);
  border: none;
  border-radius: 999px;
  padding: 0.5rem 1.25rem;
  font-weight: 600;
  cursor: pointer;
}

.tiny-btn {
  background: var(--brand-gradient);
  color: var(--brand-white);
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.link-btn {
  background: transparent;
  color: var(--brand-accent);
  border: none;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.center {
  text-align: center !important;
}

.menu-context {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  opacity: 0.85;
}

.menu-feedback {
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.menu-empty {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  color: var(--brand-white);
  font-size: 0.85rem;
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
}

@media (max-width: 960px) {
  .overview-card {
    flex-direction: column;
  }
}
</style>
